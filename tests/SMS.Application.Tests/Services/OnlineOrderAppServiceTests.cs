using Microsoft.Extensions.Options;
using SMS.Application.DTOs;
using SMS.Application.DTOs.Online;
using SMS.Application.Interfaces;
using SMS.Application.Services;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Exceptions;
using SMS.Domain.Interfaces;

namespace SMS.Application.Tests.Services;

public class OnlineOrderAppServiceTests
{
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IStockRepository> _stockRepoMock;
    private readonly Mock<IOnlineOrderRepository> _orderRepoMock;
    private readonly Mock<IClientRepository> _clientRepoMock;
    private readonly Mock<IInventoryNotifier> _notifierMock;
    private readonly OnlineOrderAppService _service;

    public OnlineOrderAppServiceTests()
    {
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _stockRepoMock = new Mock<IStockRepository>();
        _orderRepoMock = new Mock<IOnlineOrderRepository>();
        _clientRepoMock = new Mock<IClientRepository>();
        _notifierMock = new Mock<IInventoryNotifier>();

        _unitOfWorkMock.Setup(u => u.Stock).Returns(_stockRepoMock.Object);
        _unitOfWorkMock.Setup(u => u.OnlineOrders).Returns(_orderRepoMock.Object);
        _unitOfWorkMock.Setup(u => u.Clients).Returns(_clientRepoMock.Object);

        var loyaltyOptions = Options.Create(new LoyaltySettings());
        _service = new OnlineOrderAppService(_unitOfWorkMock.Object, _notifierMock.Object, loyaltyOptions);
    }

    private static StockItem MakeStockItem(int variantId, int onHand, int reserved = 0) => new()
    {
        ProductVariantId = variantId,
        QuantityOnHand = onHand,
        QuantityReserved = reserved,
        ReorderLevel = 5,
        ProductVariant = new ProductVariant
        {
            Id = variantId,
            Sku = $"SKU-{variantId}",
            Product = new Product { Id = 1, Name = "Shoe A", Price = 100m },
            Color = new Color { Name = "Red" },
            Size = new Size { Value = "42" }
        }
    };

    [Fact]
    public async Task CreateManualOrderAsync_ValidRequest_ReservesStockWithoutTouchingOnHand()
    {
        var stockItem = MakeStockItem(1, onHand: 20);
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(stockItem);
        _orderRepoMock.Setup(r => r.GenerateOrderNumberAsync(OnlineOrderChannel.WhatsApp, It.IsAny<CancellationToken>()))
            .ReturnsAsync("WA-20260723-001");

        OnlineOrder? added = null;
        _orderRepoMock.Setup(r => r.AddAsync(It.IsAny<OnlineOrder>(), It.IsAny<CancellationToken>()))
            .Callback<OnlineOrder, CancellationToken>((o, _) => { o.Id = 1; added = o; })
            .Returns(Task.CompletedTask);
        _orderRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => added);

        var request = new CreateManualOrderRequest
        {
            Channel = OnlineOrderChannel.WhatsApp,
            CustomerName = "Jane Doe",
            Items = [new CreateOnlineOrderItemRequest { ProductVariantId = 1, Quantity = 3 }]
        };

        var result = await _service.CreateManualOrderAsync(request, userId: 1);

        Assert.Equal("WA-20260723-001", result.OrderNumber);
        Assert.Equal(3, stockItem.QuantityReserved);
        Assert.Equal(20, stockItem.QuantityOnHand); // on-hand must not change on reservation
        Assert.Equal(17, stockItem.QuantityAvailable);
        _notifierMock.Verify(n => n.NotifyNewOnlineOrderAsync("WhatsApp", "WA-20260723-001", It.IsAny<decimal>(), It.IsAny<CancellationToken>()), Times.Once);
        _notifierMock.Verify(n => n.NotifyStockChangedAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateManualOrderAsync_InsufficientStock_ThrowsInsufficientStock()
    {
        var stockItem = MakeStockItem(1, onHand: 2);
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(stockItem);

        var request = new CreateManualOrderRequest
        {
            CustomerName = "Jane Doe",
            Items = [new CreateOnlineOrderItemRequest { ProductVariantId = 1, Quantity = 5 }]
        };

        await Assert.ThrowsAsync<InsufficientStockException>(() => _service.CreateManualOrderAsync(request, userId: 1));
    }

    [Fact]
    public async Task CreateManualOrderAsync_EmptyItems_ThrowsArgument()
    {
        var request = new CreateManualOrderRequest { CustomerName = "Jane Doe", Items = [] };

        await Assert.ThrowsAsync<ArgumentException>(() => _service.CreateManualOrderAsync(request, userId: 1));
    }

    [Fact]
    public async Task UpdateStatusAsync_ToShipped_DeductsStockAndCreatesMovement()
    {
        var stockItem = MakeStockItem(1, onHand: 20, reserved: 3);
        var order = new OnlineOrder
        {
            Id = 1,
            OrderNumber = "WA-20260723-001",
            Status = OrderStatus.Confirmed,
            StockReserved = true,
            Items =
            [
                new OnlineOrderItem { ProductVariantId = 1, ProductNameSnapshot = "Shoe A", QuantityReserved = 3, Quantity = 3 }
            ]
        };

        _orderRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(order);
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(stockItem);

        var result = await _service.UpdateStatusAsync(1, OrderStatus.Shipped);

        Assert.NotNull(result);
        Assert.Equal(17, stockItem.QuantityOnHand);
        Assert.Equal(0, stockItem.QuantityReserved);
        Assert.False(order.StockReserved);
        Assert.NotNull(order.ShippedAt);
        _stockRepoMock.Verify(r => r.AddMovementAsync(
            It.Is<StockMovement>(m => m.Type == StockMovementType.OnlineSale && m.QuantityChange == -3),
            It.IsAny<CancellationToken>()), Times.Once);
        _notifierMock.Verify(n => n.NotifyStockChangedAsync(1, 17, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CancelAsync_PendingOrder_ReleasesReservation()
    {
        var stockItem = MakeStockItem(1, onHand: 20, reserved: 3);
        var order = new OnlineOrder
        {
            Id = 1,
            Status = OrderStatus.Pending,
            StockReserved = true,
            Items = [new OnlineOrderItem { ProductVariantId = 1, QuantityReserved = 3 }]
        };

        _orderRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(order);
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(stockItem);

        var result = await _service.CancelAsync(1, "Client changed their mind");

        Assert.True(result);
        Assert.Equal(0, stockItem.QuantityReserved);
        Assert.Equal(20, stockItem.QuantityOnHand);
        Assert.Equal(OrderStatus.Cancelled, order.Status);
        Assert.False(order.StockReserved);
    }

    [Fact]
    public async Task CancelAsync_AlreadyDelivered_ReturnsFalse()
    {
        var order = new OnlineOrder { Id = 1, Status = OrderStatus.Delivered, Items = [] };
        _orderRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(order);

        var result = await _service.CancelAsync(1, null);

        Assert.False(result);
    }

    [Fact]
    public async Task UpdateStatusAsync_ToDelivered_AwardsLoyaltyPointsOnce()
    {
        var client = new Client { Id = 1, Name = "Jane", Phone = "0600000000", LoyaltyRate = 5, TotalPoints = 0 };
        var order = new OnlineOrder
        {
            Id = 1,
            Status = OrderStatus.Shipped,
            StockReserved = false,
            ClientId = 1,
            SubTotal = 300m,
            Items = [new OnlineOrderItem { ProductVariantId = 1, QuantityFulfilled = 3 }]
        };

        _orderRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(order);
        _clientRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(client);

        var result = await _service.UpdateStatusAsync(1, OrderStatus.Delivered);

        Assert.NotNull(result);
        Assert.Equal(15, client.TotalPoints); // 300 * 5 / 100
        Assert.Equal(15, order.LoyaltyPointsEarned);
        Assert.NotNull(order.DeliveredAt);
    }

    [Fact]
    public async Task GetByIdAsync_NonExisting_ReturnsNull()
    {
        _orderRepoMock.Setup(r => r.GetByIdAsync(999, It.IsAny<CancellationToken>())).ReturnsAsync((OnlineOrder?)null);

        var result = await _service.GetByIdAsync(999);

        Assert.Null(result);
    }
}
