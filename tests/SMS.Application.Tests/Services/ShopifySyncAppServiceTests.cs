using System.Linq.Expressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;
using SMS.Application.Services;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Application.Tests.Services;

public class ShopifySyncAppServiceTests
{
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IStockRepository> _stockRepoMock;
    private readonly Mock<IOnlineOrderRepository> _orderRepoMock;
    private readonly Mock<IClientRepository> _clientRepoMock;
    private readonly Mock<IInventoryNotifier> _notifierMock;
    private readonly Mock<IOnlineOrderService> _onlineOrderServiceMock;
    private readonly Mock<ICityResolverService> _cityResolverMock;
    private readonly ShopifySyncAppService _service;

    public ShopifySyncAppServiceTests()
    {
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _stockRepoMock = new Mock<IStockRepository>();
        _orderRepoMock = new Mock<IOnlineOrderRepository>();
        _clientRepoMock = new Mock<IClientRepository>();
        _notifierMock = new Mock<IInventoryNotifier>();
        _onlineOrderServiceMock = new Mock<IOnlineOrderService>();
        _cityResolverMock = new Mock<ICityResolverService>();
        _cityResolverMock.Setup(r => r.ResolveAsync(It.IsAny<string?>(), It.IsAny<CancellationToken>())).ReturnsAsync((CityResolution?)null);

        _unitOfWorkMock.Setup(u => u.Stock).Returns(_stockRepoMock.Object);
        _unitOfWorkMock.Setup(u => u.OnlineOrders).Returns(_orderRepoMock.Object);
        _unitOfWorkMock.Setup(u => u.Clients).Returns(_clientRepoMock.Object);

        var options = Options.Create(new ShopifyOptions());
        var loyaltyOptions = Options.Create(new SMS.Application.DTOs.LoyaltySettings());
        var logger = new Mock<ILogger<ShopifySyncAppService>>();

        _service = new ShopifySyncAppService(
            _unitOfWorkMock.Object, _notifierMock.Object, _onlineOrderServiceMock.Object, _cityResolverMock.Object,
            options, loyaltyOptions, logger.Object, new Mock<IClientLoyaltyCategoryService>().Object, shopifyClient: null);
    }

    private void SetupMappedVariant(long shopifyProductId, long shopifyVariantId, ProductVariant variant, StockItem stock)
    {
        _unitOfWorkMock.Setup(u => u.FindAsync(
                It.IsAny<Expression<Func<ShopifyProduct, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([new ShopifyProduct { ShopifyProductId = shopifyProductId, ShopifyVariantId = shopifyVariantId, LocalProductId = variant.ProductId }]);

        _unitOfWorkMock.Setup(u => u.FindAsync(
                It.IsAny<Expression<Func<ProductVariant, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([variant]);

        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(variant.Id, It.IsAny<CancellationToken>())).ReturnsAsync(stock);
    }

    [Fact]
    public async Task ProcessOrderCreatedAsync_SufficientStock_ReservesAndCreatesProcessingOrder()
    {
        var variant = new ProductVariant { Id = 1, ProductId = 1, Sku = "SKU-1", Product = new Product { Id = 1, Name = "Shoe A" } };
        var stock = new StockItem { ProductVariantId = 1, QuantityOnHand = 10, QuantityReserved = 0, ReorderLevel = 2 };
        SetupMappedVariant(555, 777, variant, stock);

        _orderRepoMock.Setup(r => r.GetByShopifyOrderIdAsync(999, It.IsAny<CancellationToken>())).ReturnsAsync((OnlineOrder?)null);
        _orderRepoMock.Setup(r => r.GenerateOrderNumberAsync(OnlineOrderChannel.Shopify, It.IsAny<CancellationToken>()))
            .ReturnsAsync("SHP-20260723-001");

        OnlineOrder? added = null;
        _orderRepoMock.Setup(r => r.AddAsync(It.IsAny<OnlineOrder>(), It.IsAny<CancellationToken>()))
            .Callback<OnlineOrder, CancellationToken>((o, _) => added = o)
            .Returns(Task.CompletedTask);

        var lineItems = new List<ShopifyLineItemDto>
        {
            new() { ProductId = 555, VariantId = 777, Title = "Shoe A", Quantity = 2, Price = 150m }
        };

        await _service.ProcessOrderCreatedAsync(999, "#1001", "paid", "unfulfilled", 300m, "MAD",
            "client@test.com", "Jane Doe", lineItems, DateTime.UtcNow);

        Assert.NotNull(added);
        Assert.Equal(OrderStatus.Processing, added!.Status);
        Assert.True(added.StockReserved);
        Assert.Equal(999L, added.ShopifyOrderId);
        Assert.Equal(OnlinePaymentStatus.Paid, added.PaymentStatus);
        Assert.Equal(2, stock.QuantityReserved);
        Assert.Equal(10, stock.QuantityOnHand);
        Assert.Single(added.Items);
        Assert.Equal(2, added.Items.First().QuantityReserved);
        _notifierMock.Verify(n => n.NotifyNewOnlineOrderAsync("Shopify", "SHP-20260723-001", 300m, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessOrderCreatedAsync_InsufficientStock_CreatesConflictWithoutReserving()
    {
        var variant = new ProductVariant { Id = 1, ProductId = 1, Sku = "SKU-1", Product = new Product { Id = 1, Name = "Shoe A" } };
        var stock = new StockItem { ProductVariantId = 1, QuantityOnHand = 1, QuantityReserved = 0, ReorderLevel = 2 };
        SetupMappedVariant(555, 777, variant, stock);

        _orderRepoMock.Setup(r => r.GetByShopifyOrderIdAsync(999, It.IsAny<CancellationToken>())).ReturnsAsync((OnlineOrder?)null);
        _orderRepoMock.Setup(r => r.GenerateOrderNumberAsync(OnlineOrderChannel.Shopify, It.IsAny<CancellationToken>()))
            .ReturnsAsync("SHP-20260723-002");

        OnlineOrder? added = null;
        _orderRepoMock.Setup(r => r.AddAsync(It.IsAny<OnlineOrder>(), It.IsAny<CancellationToken>()))
            .Callback<OnlineOrder, CancellationToken>((o, _) => added = o)
            .Returns(Task.CompletedTask);

        var lineItems = new List<ShopifyLineItemDto>
        {
            new() { ProductId = 555, VariantId = 777, Title = "Shoe A", Quantity = 5, Price = 150m }
        };

        await _service.ProcessOrderCreatedAsync(999, "#1002", "pending", "unfulfilled", 750m, "MAD",
            null, "Jane Doe", lineItems, DateTime.UtcNow);

        Assert.NotNull(added);
        Assert.Equal(OrderStatus.InventoryConflict, added!.Status);
        Assert.False(added.StockReserved);
        Assert.Equal(0, stock.QuantityReserved);
        Assert.Equal(0, added.Items.First().QuantityReserved);
    }

    [Fact]
    public async Task ProcessOrderCreatedAsync_AlreadyProcessed_SkipsCreation()
    {
        _orderRepoMock.Setup(r => r.GetByShopifyOrderIdAsync(999, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OnlineOrder { Id = 1, ShopifyOrderId = 999 });

        await _service.ProcessOrderCreatedAsync(999, "#1001", "paid", "unfulfilled", 300m, "MAD",
            null, "Jane Doe", [], DateTime.UtcNow);

        _orderRepoMock.Verify(r => r.AddAsync(It.IsAny<OnlineOrder>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ProcessOrderCancelledAsync_ExistingOrder_DelegatesToOnlineOrderCancel()
    {
        var order = new OnlineOrder { Id = 42, ShopifyOrderId = 999 };
        _orderRepoMock.Setup(r => r.GetByShopifyOrderIdAsync(999, It.IsAny<CancellationToken>())).ReturnsAsync(order);

        await _service.ProcessOrderCancelledAsync(999);

        _onlineOrderServiceMock.Verify(s => s.CancelAsync(42, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessOrderCancelledAsync_UnknownOrder_DoesNothing()
    {
        _orderRepoMock.Setup(r => r.GetByShopifyOrderIdAsync(999, It.IsAny<CancellationToken>())).ReturnsAsync((OnlineOrder?)null);

        await _service.ProcessOrderCancelledAsync(999);

        _onlineOrderServiceMock.Verify(s => s.CancelAsync(It.IsAny<int>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ProcessOrderCreatedAsync_TrulyUnmappedLine_PreservesItemInsteadOfDiscardingIt()
    {
        // The bug this fixes: a Shopify line with no local catalog match at all used to be
        // discarded entirely - only its title went into a free-text Notes string, and no
        // OnlineOrderItem row was ever created. The order ended up with zero line items and was
        // unrecoverable from the UI. Now the line is kept, unmapped, with enough Shopify identity
        // (ShopifyProductId/ShopifyVariantId/Sku) to be resolved later by RematchConflictedOrdersAsync.
        _unitOfWorkMock.Setup(u => u.FindAsync(
                It.IsAny<Expression<Func<ShopifyProduct, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
        _unitOfWorkMock.Setup(u => u.FindAsync(
                It.IsAny<Expression<Func<ProductVariant, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        _orderRepoMock.Setup(r => r.GetByShopifyOrderIdAsync(999, It.IsAny<CancellationToken>())).ReturnsAsync((OnlineOrder?)null);
        _orderRepoMock.Setup(r => r.GenerateOrderNumberAsync(OnlineOrderChannel.Shopify, It.IsAny<CancellationToken>()))
            .ReturnsAsync("SHP-20260723-003");

        OnlineOrder? added = null;
        _orderRepoMock.Setup(r => r.AddAsync(It.IsAny<OnlineOrder>(), It.IsAny<CancellationToken>()))
            .Callback<OnlineOrder, CancellationToken>((o, _) => added = o)
            .Returns(Task.CompletedTask);

        var lineItems = new List<ShopifyLineItemDto>
        {
            new() { ProductId = 888, VariantId = 999, Title = "Basket En Cuir Beige - Taza", Quantity = 1, Price = 439m, Sku = "SHP-999" }
        };

        await _service.ProcessOrderCreatedAsync(999, "#1003", "pending", "unfulfilled", 439m, "MAD",
            null, "Jane Doe", lineItems, DateTime.UtcNow);

        Assert.NotNull(added);
        Assert.Equal(OrderStatus.InventoryConflict, added!.Status);
        Assert.Single(added.Items); // previously: zero items
        var item = added.Items.First();
        Assert.Null(item.ProductVariantId);
        Assert.Equal(888, item.ShopifyProductId);
        Assert.Equal(999, item.ShopifyVariantId);
        Assert.Equal("SHP-999", item.ShopifySku);
        Assert.Equal("Basket En Cuir Beige - Taza", item.ProductNameSnapshot);
        Assert.Contains("Basket En Cuir Beige - Taza", added.Notes);
    }

    [Fact]
    public async Task RematchConflictedOrdersAsync_ResolvesByShopifyVariantId_AndClearsConflict()
    {
        var variant = new ProductVariant { Id = 5, ProductId = 5, Sku = "SKU-5", ShopifyVariantId = 999, Product = new Product { Id = 5, Name = "Basket Taza" } };
        var stock = new StockItem { ProductVariantId = 5, QuantityOnHand = 10, QuantityReserved = 0, ReorderLevel = 2 };

        var conflictedOrder = new OnlineOrder
        {
            Id = 4,
            OrderNumber = "SHP-20260723-003",
            Status = OrderStatus.InventoryConflict,
            Items =
            [
                new OnlineOrderItem { ProductVariantId = null, ShopifyProductId = 888, ShopifyVariantId = 999, Quantity = 1, ProductNameSnapshot = "Basket Taza" }
            ]
        };

        _orderRepoMock.Setup(r => r.GetConflictsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([conflictedOrder]);
        _unitOfWorkMock.Setup(u => u.FindAsync(
                It.IsAny<Expression<Func<ProductVariant, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([variant]);
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(5, It.IsAny<CancellationToken>())).ReturnsAsync(stock);
        _onlineOrderServiceMock.Setup(s => s.UpdateStatusAsync(
                4, OrderStatus.Pending, OrderStatusChangeSource.System, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SMS.Application.DTOs.Online.OnlineOrderDto());

        var result = await _service.RematchConflictedOrdersAsync();

        Assert.Equal(1, result.OrdersResolved);
        Assert.Equal(1, result.ItemsMatched);
        Assert.Equal(0, result.ItemsStillUnresolved);
        Assert.Equal(5, conflictedOrder.Items.First().ProductVariantId);
        Assert.True(conflictedOrder.StockReserved);
        Assert.Equal(1, stock.QuantityReserved);
        _onlineOrderServiceMock.Verify(s => s.UpdateStatusAsync(
            4, OrderStatus.Pending, OrderStatusChangeSource.System, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RematchConflictedOrdersAsync_AllItemsAlreadyResolved_StillClearsConflict()
    {
        // Regression test for a real bug found during live verification: an order whose items
        // were ALL already resolved (e.g. by BackfillMissingLineItemsAsync matching them directly)
        // was skipped entirely by the "any unresolved items?" early-continue, so it stayed stuck
        // in InventoryConflict forever even though it had nothing left to resolve.
        var stock = new StockItem { ProductVariantId = 5, QuantityOnHand = 10, QuantityReserved = 0, ReorderLevel = 2 };
        var order = new OnlineOrder
        {
            Id = 4,
            Status = OrderStatus.InventoryConflict,
            Items = [new OnlineOrderItem { ProductVariantId = 5, Quantity = 1, ProductNameSnapshot = "Basket Taza" }]
        };

        _orderRepoMock.Setup(r => r.GetConflictsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([order]);
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(5, It.IsAny<CancellationToken>())).ReturnsAsync(stock);
        _onlineOrderServiceMock.Setup(s => s.UpdateStatusAsync(
                4, OrderStatus.Pending, OrderStatusChangeSource.System, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SMS.Application.DTOs.Online.OnlineOrderDto());

        var result = await _service.RematchConflictedOrdersAsync();

        Assert.Equal(1, result.OrdersResolved);
        Assert.Equal(0, result.ItemsMatched); // nothing needed matching - it was already resolved
        Assert.True(order.StockReserved);
        _onlineOrderServiceMock.Verify(s => s.UpdateStatusAsync(
            4, OrderStatus.Pending, OrderStatusChangeSource.System, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RematchConflictedOrdersAsync_ZeroItems_SkipsUntilBackfilled()
    {
        var order = new OnlineOrder { Id = 4, Status = OrderStatus.InventoryConflict, Items = [] };
        _orderRepoMock.Setup(r => r.GetConflictsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([order]);

        var result = await _service.RematchConflictedOrdersAsync();

        Assert.Equal(0, result.OrdersResolved);
        _onlineOrderServiceMock.Verify(s => s.UpdateStatusAsync(
            It.IsAny<int>(), It.IsAny<OrderStatus>(), It.IsAny<OrderStatusChangeSource>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RematchConflictedOrdersAsync_NoMatch_LeavesOrderInConflict()
    {
        var conflictedOrder = new OnlineOrder
        {
            Id = 4,
            Status = OrderStatus.InventoryConflict,
            Items = [new OnlineOrderItem { ProductVariantId = null, ShopifyVariantId = 999, Quantity = 1 }]
        };

        _orderRepoMock.Setup(r => r.GetConflictsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([conflictedOrder]);
        _unitOfWorkMock.Setup(u => u.FindAsync(
                It.IsAny<Expression<Func<ProductVariant, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var result = await _service.RematchConflictedOrdersAsync();

        Assert.Equal(0, result.OrdersResolved);
        Assert.Equal(0, result.ItemsMatched);
        Assert.Equal(1, result.ItemsStillUnresolved);
        Assert.Equal(OrderStatus.InventoryConflict, conflictedOrder.Status);
        _onlineOrderServiceMock.Verify(s => s.UpdateStatusAsync(
            It.IsAny<int>(), It.IsAny<OrderStatus>(), It.IsAny<OrderStatusChangeSource>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
