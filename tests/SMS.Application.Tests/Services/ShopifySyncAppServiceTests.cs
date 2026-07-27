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
    private readonly ShopifySyncAppService _service;

    public ShopifySyncAppServiceTests()
    {
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _stockRepoMock = new Mock<IStockRepository>();
        _orderRepoMock = new Mock<IOnlineOrderRepository>();
        _clientRepoMock = new Mock<IClientRepository>();
        _notifierMock = new Mock<IInventoryNotifier>();
        _onlineOrderServiceMock = new Mock<IOnlineOrderService>();

        _unitOfWorkMock.Setup(u => u.Stock).Returns(_stockRepoMock.Object);
        _unitOfWorkMock.Setup(u => u.OnlineOrders).Returns(_orderRepoMock.Object);
        _unitOfWorkMock.Setup(u => u.Clients).Returns(_clientRepoMock.Object);

        var options = Options.Create(new ShopifyOptions());
        var logger = new Mock<ILogger<ShopifySyncAppService>>();

        _service = new ShopifySyncAppService(
            _unitOfWorkMock.Object, _notifierMock.Object, _onlineOrderServiceMock.Object,
            options, logger.Object, shopifyClient: null);
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
}
