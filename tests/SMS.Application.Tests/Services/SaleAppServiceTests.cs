using SMS.Application.DTOs.Shopify;
using SMS.Application.DTOs.Sales;
using SMS.Application.DTOs;
using SMS.Application.Interfaces;
using SMS.Application.Services;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Exceptions;
using SMS.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SMS.Application.Tests.Services;

public class SaleAppServiceTests
{
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IStockRepository> _stockRepoMock;
    private readonly Mock<ISaleRepository> _saleRepoMock;
    private readonly Mock<IInventoryNotifier> _notifierMock;
    private readonly SaleAppService _service;

    public SaleAppServiceTests()
    {
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _stockRepoMock = new Mock<IStockRepository>();
        _saleRepoMock = new Mock<ISaleRepository>();
        _notifierMock = new Mock<IInventoryNotifier>();

        _unitOfWorkMock.Setup(u => u.Stock).Returns(_stockRepoMock.Object);
        _unitOfWorkMock.Setup(u => u.Sales).Returns(_saleRepoMock.Object);

        var shopifyOptions = Options.Create(new ShopifyOptions());
        var loyaltyOptions = Options.Create(new LoyaltySettings());
        _service = new SaleAppService(_unitOfWorkMock.Object, _notifierMock.Object, shopifyOptions, loyaltyOptions, new Mock<ILogger<SaleAppService>>().Object);
    }

    [Fact]
    public async Task CreateSaleAsync_ValidRequest_CreatesSale()
    {
        var stockItem = new StockItem
        {
            ProductVariantId = 1,
            QuantityOnHand = 50,
            QuantityReserved = 0,
            ProductVariant = new ProductVariant { Id = 1, Sku = "A001", Product = new Product { Id = 1, Name = "Shoe A" }, Color = new Color { Name = "Red" }, Size = new Size { Value = "42" } }
        };

        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(stockItem);

        _saleRepoMock.Setup(r => r.GenerateSaleNumberAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync("POS-20260701-001");

        _saleRepoMock.Setup(r => r.AddAsync(It.IsAny<Sale>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Sale s, CancellationToken _) => { s.Id = 1; return s; });

        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 2, DiscountAmount = 0 }],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 120m,
            TaxRate = 0.1m
        };

        var result = await _service.CreateSaleAsync(request, userId: 1);

        Assert.Equal(1, result.Id);
        Assert.Equal("POS-20260701-001", result.SaleNumber);
        Assert.Equal(48, stockItem.QuantityOnHand);
        _notifierMock.Verify(n => n.NotifyStockChangedAsync(1, It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateSaleAsync_InsufficientStock_ThrowsInsufficientStock()
    {
        var stockItem = new StockItem
        {
            ProductVariantId = 1,
            QuantityOnHand = 5,
            QuantityReserved = 0,
            ProductVariant = new ProductVariant { Id = 1, Sku = "A001", Product = new Product { Id = 1, Name = "Shoe A" }, Color = new Color { Name = "Red" }, Size = new Size { Value = "42" } }
        };

        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(stockItem);

        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 10, DiscountAmount = 0 }],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 600m,
            TaxRate = 0.1m
        };

        await Assert.ThrowsAsync<InsufficientStockException>(() => _service.CreateSaleAsync(request, userId: 1));
    }

    [Fact]
    public async Task CreateSaleAsync_EmptyItems_ThrowsArgument()
    {
        var request = new CreateSaleRequest
        {
            Items = [],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 100m,
            TaxRate = 0.1m
        };

        await Assert.ThrowsAsync<ArgumentException>(() => _service.CreateSaleAsync(request, userId: 1));
    }

    [Fact]
    public async Task CreateSaleAsync_NonExistingProduct_ThrowsKeyNotFound()
    {
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(999, It.IsAny<CancellationToken>()))
            .ReturnsAsync((StockItem?)null);

        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 999, Quantity = 1, DiscountAmount = 0 }],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 100m,
            TaxRate = 0.1m
        };

        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.CreateSaleAsync(request, userId: 1));
    }

    [Fact]
    public async Task GetByIdAsync_ExistingSale_ReturnsSale()
    {
        var sale = new Sale
        {
            Id = 1,
            SaleNumber = "POS-001",
            TotalAmount = 100m,
            Status = OrderStatus.Delivered,
            Items = [new SaleItem { ProductVariantId = 1, Quantity = 2, UnitPrice = 50m, LineTotal = 100m }]
        };

        _saleRepoMock.Setup(r => r.GetWithItemsAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(sale);

        var result = await _service.GetByIdAsync(1);

        Assert.NotNull(result);
        Assert.Equal(1, result.Id);
        Assert.Single(result.Items);
    }

    [Fact]
    public async Task GetByIdAsync_NonExistingSale_ReturnsNull()
    {
        _saleRepoMock.Setup(r => r.GetWithItemsAsync(999, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Sale?)null);

        var result = await _service.GetByIdAsync(999);

        Assert.Null(result);
    }
}
