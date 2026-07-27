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
using SMS.Application.DTOs.Shopify;

namespace SMS.Application.Tests.Services;

public class SaleEdgeCaseTests
{
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IStockRepository> _stockRepoMock;
    private readonly Mock<ISaleRepository> _saleRepoMock;
    private readonly Mock<IInventoryNotifier> _notifierMock;
    private readonly SaleAppService _service;

    public SaleEdgeCaseTests()
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

    private StockItem CreateStock(int variantId, int qty, int reorderLevel = 10, decimal price = 50m)
    {
        return new StockItem
        {
            ProductVariantId = variantId,
            QuantityOnHand = qty,
            QuantityReserved = 0,
            ReorderLevel = reorderLevel,
            ProductVariant = new ProductVariant
            {
                Id = variantId,
                Sku = $"SKU-{variantId}",
                Product = new Product { Id = 1, Name = $"Product {variantId}", Price = price, CostPrice = price * 0.6m },
                Color = new Color { Name = "Black" },
                Size = new Size { Value = "42" }
            }
        };
    }

    [Fact]
    public async Task CreateSale_MultipleItems_AllDeductStock()
    {
        var stock1 = CreateStock(1, 50);
        var stock2 = CreateStock(2, 30);
        var stock3 = CreateStock(3, 20);

        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(stock1);
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(2, It.IsAny<CancellationToken>())).ReturnsAsync(stock2);
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(3, It.IsAny<CancellationToken>())).ReturnsAsync(stock3);
        _saleRepoMock.Setup(r => r.GenerateSaleNumberAsync(It.IsAny<CancellationToken>())).ReturnsAsync("POS-20260701-001");
        _saleRepoMock.Setup(r => r.AddAsync(It.IsAny<Sale>(), It.IsAny<CancellationToken>()))
            .Callback<Sale, CancellationToken>((s, _) => s.Id = 1)
            .ReturnsAsync((Sale s, CancellationToken _) => s);

        var request = new CreateSaleRequest
        {
            Items =
            [
                new SaleItemRequest { ProductVariantId = 1, Quantity = 5, DiscountAmount = 0 },
                new SaleItemRequest { ProductVariantId = 2, Quantity = 3, DiscountAmount = 0 },
                new SaleItemRequest { ProductVariantId = 3, Quantity = 2, DiscountAmount = 0 },
            ],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 500m,
            TaxRate = 0.1m
        };

        var result = await _service.CreateSaleAsync(request, userId: 1);

        Assert.Equal(45, stock1.QuantityOnHand);
        Assert.Equal(27, stock2.QuantityOnHand);
        Assert.Equal(18, stock3.QuantityOnHand);
        Assert.Equal(3, result.Items.Count);
    }

    [Fact]
    public async Task CreateSale_ExactStockRemaining_BecomesZero()
    {
        var stock = CreateStock(1, 5);

        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(stock);
        _saleRepoMock.Setup(r => r.GenerateSaleNumberAsync(It.IsAny<CancellationToken>())).ReturnsAsync("POS-001");
        _saleRepoMock.Setup(r => r.AddAsync(It.IsAny<Sale>(), It.IsAny<CancellationToken>()))
            .Callback<Sale, CancellationToken>((s, _) => s.Id = 1)
            .ReturnsAsync((Sale s, CancellationToken _) => s);

        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 5, DiscountAmount = 0 }],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 250m,
            TaxRate = 0
        };

        await _service.CreateSaleAsync(request, userId: 1);

        Assert.Equal(0, stock.QuantityOnHand);
    }

    [Fact]
    public async Task CreateSale_OneItemInsufficient_ThrowsException()
    {
        var stock1 = CreateStock(1, 50);
        var stock2 = CreateStock(2, 2);

        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(stock1);
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(2, It.IsAny<CancellationToken>())).ReturnsAsync(stock2);

        var request = new CreateSaleRequest
        {
            Items =
            [
                new SaleItemRequest { ProductVariantId = 1, Quantity = 5, DiscountAmount = 0 },
                new SaleItemRequest { ProductVariantId = 2, Quantity = 10, DiscountAmount = 0 },
            ],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 1000m,
            TaxRate = 0
        };

        var ex = await Assert.ThrowsAsync<InsufficientStockException>(() => _service.CreateSaleAsync(request, userId: 1));
        Assert.Equal(2, ex.ProductId);
    }

    [Fact]
    public async Task CreateSale_WithDiscount_CalculatesCorrectTotal()
    {
        var stock = CreateStock(1, 50, price: 100m);

        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(stock);
        _saleRepoMock.Setup(r => r.GenerateSaleNumberAsync(It.IsAny<CancellationToken>())).ReturnsAsync("POS-001");
        _saleRepoMock.Setup(r => r.AddAsync(It.IsAny<Sale>(), It.IsAny<CancellationToken>()))
            .Callback<Sale, CancellationToken>((s, _) => s.Id = 1)
            .ReturnsAsync((Sale s, CancellationToken _) => s);

        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 2, DiscountAmount = 20m }],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 200m,
            TaxRate = 0.1m
        };

        var result = await _service.CreateSaleAsync(request, userId: 1);

        Assert.Equal(180m, result.SubTotal);
        Assert.Equal(20m, result.DiscountAmount);
        Assert.Equal(18m, result.TaxAmount);
        Assert.Equal(198m, result.TotalAmount);
    }

    [Fact]
    public async Task CreateSale_TaxCalculations_AreCorrect()
    {
        var stock = CreateStock(1, 50, price: 200m);

        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(stock);
        _saleRepoMock.Setup(r => r.GenerateSaleNumberAsync(It.IsAny<CancellationToken>())).ReturnsAsync("POS-001");
        _saleRepoMock.Setup(r => r.AddAsync(It.IsAny<Sale>(), It.IsAny<CancellationToken>()))
            .Callback<Sale, CancellationToken>((s, _) => s.Id = 1)
            .ReturnsAsync((Sale s, CancellationToken _) => s);

        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 3, DiscountAmount = 0 }],
            PaymentMethod = PaymentMethod.Card,
            AmountPaid = 720m,
            TaxRate = 0.2m
        };

        var result = await _service.CreateSaleAsync(request, userId: 1);

        Assert.Equal(600m, result.SubTotal);
        Assert.Equal(120m, result.TaxAmount);
        Assert.Equal(720m, result.TotalAmount);
        Assert.Equal(0m, result.ChangeGiven);
    }

    [Fact]
    public async Task CreateSale_ExactChange_IsZero()
    {
        var stock = CreateStock(1, 50, price: 100m);

        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(stock);
        _saleRepoMock.Setup(r => r.GenerateSaleNumberAsync(It.IsAny<CancellationToken>())).ReturnsAsync("POS-001");
        _saleRepoMock.Setup(r => r.AddAsync(It.IsAny<Sale>(), It.IsAny<CancellationToken>()))
            .Callback<Sale, CancellationToken>((s, _) => s.Id = 1)
            .ReturnsAsync((Sale s, CancellationToken _) => s);

        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 1, DiscountAmount = 0 }],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 100m,
            TaxRate = 0
        };

        var result = await _service.CreateSaleAsync(request, userId: 1);

        Assert.Equal(0m, result.ChangeGiven);
    }

    [Fact]
    public async Task CreateSale_Overpayment_CalculatesChange()
    {
        var stock = CreateStock(1, 50, price: 100m);

        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(stock);
        _saleRepoMock.Setup(r => r.GenerateSaleNumberAsync(It.IsAny<CancellationToken>())).ReturnsAsync("POS-001");
        _saleRepoMock.Setup(r => r.AddAsync(It.IsAny<Sale>(), It.IsAny<CancellationToken>()))
            .Callback<Sale, CancellationToken>((s, _) => s.Id = 1)
            .ReturnsAsync((Sale s, CancellationToken _) => s);

        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 1, DiscountAmount = 0 }],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 150m,
            TaxRate = 0
        };

        var result = await _service.CreateSaleAsync(request, userId: 1);

        Assert.Equal(50m, result.ChangeGiven);
    }

    [Fact]
    public async Task CreateSale_StockNotification_CalledForEachVariant()
    {
        var stock1 = CreateStock(1, 50);
        var stock2 = CreateStock(2, 30);

        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(stock1);
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(2, It.IsAny<CancellationToken>())).ReturnsAsync(stock2);
        _saleRepoMock.Setup(r => r.GenerateSaleNumberAsync(It.IsAny<CancellationToken>())).ReturnsAsync("POS-001");
        _saleRepoMock.Setup(r => r.AddAsync(It.IsAny<Sale>(), It.IsAny<CancellationToken>()))
            .Callback<Sale, CancellationToken>((s, _) => s.Id = 1)
            .ReturnsAsync((Sale s, CancellationToken _) => s);

        var request = new CreateSaleRequest
        {
            Items =
            [
                new SaleItemRequest { ProductVariantId = 1, Quantity = 2, DiscountAmount = 0 },
                new SaleItemRequest { ProductVariantId = 2, Quantity = 1, DiscountAmount = 0 },
            ],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 200m,
            TaxRate = 0
        };

        await _service.CreateSaleAsync(request, userId: 1);

        _notifierMock.Verify(n => n.NotifyStockChangedAsync(1, 48, It.IsAny<CancellationToken>()), Times.Once);
        _notifierMock.Verify(n => n.NotifyStockChangedAsync(2, 29, It.IsAny<CancellationToken>()), Times.Once);
    }
}
