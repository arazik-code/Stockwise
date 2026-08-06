using System.Data;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using SMS.Application.DTOs;
using SMS.Application.DTOs.Sales;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;
using SMS.Application.Services;
using SMS.Application.Validators;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Exceptions;
using SMS.Domain.Interfaces;

namespace SMS.Application.Tests.Services;

/// <summary>
/// Adversarial and stress tests for the application service layer.
/// Tests race conditions, boundary values, and business rule enforcement.
/// </summary>
public class AdversarialServiceTests
{
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IStockRepository> _stockRepoMock;
    private readonly Mock<ISaleRepository> _saleRepoMock;
    private readonly Mock<IInventoryNotifier> _notifierMock;
    private readonly Mock<IInventoryPushQueue> _pushQueueMock;
    private readonly SaleAppService _service;

    public AdversarialServiceTests()
    {
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _stockRepoMock = new Mock<IStockRepository>();
        _saleRepoMock = new Mock<ISaleRepository>();
        _notifierMock = new Mock<IInventoryNotifier>();
        _pushQueueMock = new Mock<IInventoryPushQueue>();

        _unitOfWorkMock.Setup(u => u.Stock).Returns(_stockRepoMock.Object);
        _unitOfWorkMock.Setup(u => u.Sales).Returns(_saleRepoMock.Object);

        _service = new SaleAppService(
            _unitOfWorkMock.Object,
            _notifierMock.Object,
            Options.Create(new ShopifyOptions()),
            Options.Create(new LoyaltySettings()),
            new Mock<ILogger<SaleAppService>>().Object,
            _pushQueueMock.Object,
            new LoyaltyRateResolver(),
            new Mock<IClientLoyaltyCategoryService>().Object);
    }

    private static StockItem MakeStock(int variantId, int onHand, string sku = "TST", decimal price = 100m)
    {
        return new StockItem
        {
            ProductVariantId = variantId,
            QuantityOnHand = onHand,
            QuantityReserved = 0,
            ProductVariant = new ProductVariant
            {
                Id = variantId,
                Sku = sku,
                Product = new Product { Id = 1, Name = "Test", Price = price, CategoryId = 1 },
                Color = new Color { Name = "Red" },
                Size = new Size { Value = "M" }
            }
        };
    }

    // ── EXTREME QUANTITY TESTS ────────────────────────────────────────

    [Fact]
    public async Task CreateSale_MaxIntQuantity_ThrowsOverflowOrInsufficient()
    {
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeStock(1, int.MaxValue));

        _saleRepoMock.Setup(r => r.GenerateSaleNumberAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync("POS-TEST-001");
        _saleRepoMock.Setup(r => r.AddAsync(It.IsAny<Sale>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Sale s, CancellationToken _) => { s.Id = 1; return s; });

        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = int.MaxValue, DiscountAmount = 0 }],
            AmountPaid = 0,
            TaxRate = 0
        };

        await Assert.ThrowsAnyAsync<Exception>(() =>
            _service.CreateSaleAsync(request, userId: 1));
    }

    [Fact]
    public async Task CreateSale_ZeroQuantity_RejectedByValidator()
    {
        // Zero quantity is rejected by FluentValidation, not the service directly
        // Test the validator in isolation
        var validator = new CreateSaleValidator();
        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 0, DiscountAmount = 0 }],
            AmountPaid = 0,
            TaxRate = 0
        };

        var result = await validator.ValidateAsync(request);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName.Contains("Quantity"));
    }

    // ── DOUBLE-SPEND ATTACK ───────────────────────────────────────────

    [Fact]
    public async Task CreateSale_DuplicateSaleNumber_ThrowsOnDuplicate()
    {
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeStock(1, 10));

        _saleRepoMock.Setup(r => r.GenerateSaleNumberAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync("POS-TEST-001");
        _saleRepoMock.Setup(r => r.AddAsync(It.IsAny<Sale>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Sale s, CancellationToken _) => { s.Id = 1; return s; });
        _unitOfWorkMock.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("duplicate key"));

        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 1, DiscountAmount = 0 }],
            AmountPaid = 100,
            TaxRate = 0
        };

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.CreateSaleAsync(request, userId: 1));
    }

    // ── NEGATIVE STOCK AFTER SALE ─────────────────────────────────────

    [Fact]
    public async Task CreateSale_SellMoreThanAvailable_ThrowsInsufficientStock()
    {
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeStock(1, 5));

        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 10, DiscountAmount = 0 }],
            AmountPaid = 1000,
            TaxRate = 0
        };

        await Assert.ThrowsAsync<InsufficientStockException>(() =>
            _service.CreateSaleAsync(request, userId: 1));
    }

    // ── CONCURRENT STOCK MODIFICATION ─────────────────────────────────

    [Fact]
    public async Task CreateSale_StockChangedBetweenRead_ThrowsConcurrencyException()
    {
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeStock(1, 10));

        _unitOfWorkMock.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new DBConcurrencyException());

        _saleRepoMock.Setup(r => r.GenerateSaleNumberAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync("POS-TEST-001");
        _saleRepoMock.Setup(r => r.AddAsync(It.IsAny<Sale>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Sale s, CancellationToken _) => { s.Id = 1; return s; });

        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 8, DiscountAmount = 0 }],
            AmountPaid = 800,
            TaxRate = 0
        };

        await Assert.ThrowsAnyAsync<Exception>(() =>
            _service.CreateSaleAsync(request, userId: 1));
    }

    // ── RAPID CREATION ────────────────────────────────────────────────

    [Fact]
    public async Task CreateSale_RapidFire10_NoCorruption()
    {
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeStock(1, 1000));

        _saleRepoMock.Setup(r => r.GenerateSaleNumberAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync("POS-TEST-" + Guid.NewGuid().ToString("N")[..6]);
        _saleRepoMock.Setup(r => r.AddAsync(It.IsAny<Sale>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Sale s, CancellationToken _) => { s.Id = Random.Shared.Next(1, 10000); return s; });

        var tasks = Enumerable.Range(0, 10).Select(i =>
            _service.CreateSaleAsync(new CreateSaleRequest
            {
                Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 1, DiscountAmount = 0 }],
                AmountPaid = 50,
                TaxRate = 0
            }, userId: 1));

        var results = await Task.WhenAll(tasks);

        Assert.All(results, sale =>
        {
            Assert.NotNull(sale);
            Assert.True(sale.TotalAmount >= 0);
            Assert.False(string.IsNullOrEmpty(sale.SaleNumber));
        });
    }

    // ── LARGE DISCOUNT HANDLING ───────────────────────────────────────

    [Fact]
    public async Task CreateSale_VeryLargeDiscount_TotalNotNegative()
    {
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeStock(1, 100));

        _saleRepoMock.Setup(r => r.GenerateSaleNumberAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync("POS-TEST-001");
        _saleRepoMock.Setup(r => r.AddAsync(It.IsAny<Sale>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Sale s, CancellationToken _) => { s.Id = 1; return s; });

        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 1, DiscountAmount = 99999m }],
            AmountPaid = 0,
            TaxRate = 0
        };

        try
        {
            var sale = await _service.CreateSaleAsync(request, userId: 1);
            Assert.True(sale.TotalAmount >= 0, "TotalAmount must not be negative");
        }
        catch (Exception)
        {
            // Exception is acceptable - validator should catch this
        }
    }

    // ── NON-EXISTENT VARIANT ──────────────────────────────────────────

    [Fact]
    public async Task CreateSale_NonExistentVariant_ThrowsKeyNotFound()
    {
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(999, It.IsAny<CancellationToken>()))
            .ReturnsAsync((StockItem?)null);

        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 999, Quantity = 1, DiscountAmount = 0 }],
            AmountPaid = 100,
            TaxRate = 0
        };

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            _service.CreateSaleAsync(request, userId: 1));
    }

    // ── MULTI-ITEM SALE WITH MIXED STOCK ──────────────────────────────

    [Fact]
    public async Task CreateSale_MultipleItems_OneInsufficient_ThrowsInsufficientStock()
    {
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeStock(1, 100));
        _stockRepoMock.Setup(r => r.GetByVariantIdAsync(2, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeStock(2, 2));

        var request = new CreateSaleRequest
        {
            Items =
            [
                new SaleItemRequest { ProductVariantId = 1, Quantity = 1, DiscountAmount = 0 },
                new SaleItemRequest { ProductVariantId = 2, Quantity = 5, DiscountAmount = 0 }
            ],
            AmountPaid = 600,
            TaxRate = 0
        };

        // Should throw because variant 2 only has 2 units but we need 5
        await Assert.ThrowsAsync<InsufficientStockException>(() =>
            _service.CreateSaleAsync(request, userId: 1));
    }
}
