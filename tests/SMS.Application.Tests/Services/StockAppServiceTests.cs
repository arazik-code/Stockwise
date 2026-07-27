using SMS.Application.DTOs.Stock;
using SMS.Application.Interfaces;
using SMS.Application.Services;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace SMS.Application.Tests.Services;

public class StockAppServiceTests
{
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IStockRepository> _stockRepoMock;
    private readonly Mock<IInventoryNotifier> _notifierMock;
    private readonly StockAppService _service;

    public StockAppServiceTests()
    {
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _stockRepoMock = new Mock<IStockRepository>();
        _notifierMock = new Mock<IInventoryNotifier>();
        _unitOfWorkMock.Setup(u => u.Stock).Returns(_stockRepoMock.Object);
        _service = new StockAppService(_unitOfWorkMock.Object, _notifierMock.Object, new Mock<ILogger<StockAppService>>().Object);
    }

    [Fact]
    public async Task GetAllStockAsync_ReturnsAllItems()
    {
        var items = new List<StockItem>
        {
            new() { ProductVariantId = 1, QuantityOnHand = 50, ProductVariant = new ProductVariant { Sku = "A001", Product = new Product { Name = "Shoe A" }, Color = new Color { Name = "Red" }, Size = new Size { Value = "42" } } },
            new() { ProductVariantId = 2, QuantityOnHand = 30, ProductVariant = new ProductVariant { Sku = "B001", Product = new Product { Name = "Shoe B" }, Color = new Color { Name = "Blue" }, Size = new Size { Value = "43" } } }
        };

        _stockRepoMock.Setup(r => r.GetAllWithVariantAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(items);

        var result = await _service.GetAllStockAsync();

        Assert.Equal(2, result.Count);
        Assert.Equal(50, result[0].QuantityOnHand);
    }

    [Fact]
    public async Task GetStockByVariantAsync_ExistingVariant_ReturnsStock()
    {
        var item = new StockItem
        {
            ProductVariantId = 1,
            QuantityOnHand = 50,
            QuantityReserved = 10,
            ReorderLevel = 20,
            ProductVariant = new ProductVariant { Sku = "A001", Product = new Product { Name = "Shoe A" }, Color = new Color { Name = "Red" }, Size = new Size { Value = "42" } }
        };

        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(item);

        var result = await _service.GetStockByVariantAsync(1);

        Assert.NotNull(result);
        Assert.Equal(50, result.QuantityOnHand);
        Assert.Equal(20, result.ReorderLevel);
    }

    [Fact]
    public async Task GetStockByVariantAsync_NonExistingVariant_ReturnsNull()
    {
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(999, It.IsAny<CancellationToken>()))
            .ReturnsAsync((StockItem?)null);

        var result = await _service.GetStockByVariantAsync(999);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetLowStockAsync_ReturnsLowStockItems()
    {
        var items = new List<StockItem>
        {
            new() { ProductVariantId = 1, QuantityOnHand = 5, ReorderLevel = 20, ProductVariant = new ProductVariant { Sku = "A001", Product = new Product { Name = "Shoe A" }, Color = new Color { Name = "Red" }, Size = new Size { Value = "42" } } }
        };

        _stockRepoMock.Setup(r => r.GetLowStockAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(items);

        var result = await _service.GetLowStockAsync();

        Assert.Single(result);
        Assert.Equal(5, result[0].QuantityOnHand);
    }

    [Fact]
    public async Task AdjustStockAsync_WithAdjustmentDelta_AdjustsStock()
    {
        var stockItem = new StockItem
        {
            ProductVariantId = 1,
            QuantityOnHand = 50,
            ReorderLevel = 20,
            ProductVariant = new ProductVariant { Sku = "A001", Product = new Product { Name = "Shoe A" }, Color = new Color { Name = "Red" }, Size = new Size { Value = "42" } }
        };

        _stockRepoMock.Setup(r => r.GetByVariantIdWithRowVersionAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(stockItem);

        var request = new AdjustStockRequest
        {
            ProductVariantId = 1,
            AdjustmentDelta = 25,
            Notes = "Manual count"
        };

        await _service.AdjustStockAsync(request, userId: 1);

        Assert.Equal(75, stockItem.QuantityOnHand);
        _stockRepoMock.Verify(r => r.AddMovementAsync(
            It.Is<StockMovement>(m =>
                m.ProductVariantId == 1 &&
                m.Type == StockMovementType.Adjustment &&
                m.QuantityChange == 25 &&
                m.QuantityAfter == 75),
            It.IsAny<CancellationToken>()), Times.Once);
        _notifierMock.Verify(n => n.NotifyStockChangedAsync(1, 75, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AdjustStockAsync_WithNewQuantity_AdjustsStock()
    {
        var stockItem = new StockItem
        {
            ProductVariantId = 1,
            QuantityOnHand = 50,
            ReorderLevel = 20,
            ProductVariant = new ProductVariant { Sku = "A001", Product = new Product { Name = "Shoe A" }, Color = new Color { Name = "Red" }, Size = new Size { Value = "42" } }
        };

        _stockRepoMock.Setup(r => r.GetByVariantIdWithRowVersionAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(stockItem);

        var request = new AdjustStockRequest
        {
            ProductVariantId = 1,
            NewQuantity = 80,
            Notes = "Full recount"
        };

        await _service.AdjustStockAsync(request, userId: 1);

        Assert.Equal(80, stockItem.QuantityOnHand);
        _stockRepoMock.Verify(r => r.AddMovementAsync(
            It.Is<StockMovement>(m =>
                m.ProductVariantId == 1 &&
                m.Type == StockMovementType.Adjustment &&
                m.QuantityChange == 30 &&
                m.QuantityAfter == 80),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AdjustStockAsync_NegativeNewQuantity_ThrowsInvalidOperation()
    {
        var stockItem = new StockItem
        {
            ProductVariantId = 1,
            QuantityOnHand = 50,
            ReorderLevel = 20,
            ProductVariant = new ProductVariant { Sku = "A001", Product = new Product { Name = "Shoe A" }, Color = new Color { Name = "Red" }, Size = new Size { Value = "42" } }
        };

        _stockRepoMock.Setup(r => r.GetByVariantIdWithRowVersionAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(stockItem);

        var request = new AdjustStockRequest
        {
            ProductVariantId = 1,
            AdjustmentDelta = -100,
            Notes = "Too much"
        };

        await Assert.ThrowsAsync<InvalidOperationException>(() => _service.AdjustStockAsync(request));
    }

    [Fact]
    public async Task AdjustStockAsync_NonExistingVariant_ThrowsKeyNotFound()
    {
        _stockRepoMock.Setup(r => r.GetByVariantIdWithRowVersionAsync(999, It.IsAny<CancellationToken>()))
            .ReturnsAsync((StockItem?)null);

        var request = new AdjustStockRequest
        {
            ProductVariantId = 999,
            AdjustmentDelta = 50,
            Notes = "Test"
        };

        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.AdjustStockAsync(request));
    }

    [Fact]
    public async Task GetMovementsAsync_ReturnsMovements()
    {
        var movements = new List<StockMovement>
        {
            new() { Id = 1, ProductVariantId = 1, Type = StockMovementType.Sale, QuantityChange = -2, QuantityAfter = 48, CreatedAt = DateTime.UtcNow },
            new() { Id = 2, ProductVariantId = 1, Type = StockMovementType.Adjustment, QuantityChange = 10, QuantityAfter = 58, CreatedAt = DateTime.UtcNow }
        };

        _stockRepoMock.Setup(r => r.GetMovementsAsync(1, null, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(movements);

        var result = await _service.GetMovementsAsync(1, null, null);

        Assert.Equal(2, result.Count);
    }
}
