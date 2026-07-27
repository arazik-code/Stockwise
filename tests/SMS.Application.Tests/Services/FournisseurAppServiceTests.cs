using System.Linq.Expressions;
using SMS.Application.DTOs.Fournisseurs;
using SMS.Application.Interfaces;
using SMS.Application.Services;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Application.Tests.Services;

public class FournisseurAppServiceTests
{
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IFournisseurRepository> _fournisseurRepoMock;
    private readonly Mock<IStockRepository> _stockRepoMock;
    private readonly Mock<ISaleRepository> _saleRepoMock;
    private readonly Mock<IInvoiceRepository> _invoiceRepoMock;
    private readonly FournisseurAppService _service;

    public FournisseurAppServiceTests()
    {
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _fournisseurRepoMock = new Mock<IFournisseurRepository>();
        _stockRepoMock = new Mock<IStockRepository>();
        _saleRepoMock = new Mock<ISaleRepository>();
        _invoiceRepoMock = new Mock<IInvoiceRepository>();

        _unitOfWorkMock.Setup(u => u.Fournisseurs).Returns(_fournisseurRepoMock.Object);
        _unitOfWorkMock.Setup(u => u.Stock).Returns(_stockRepoMock.Object);
        _unitOfWorkMock.Setup(u => u.Sales).Returns(_saleRepoMock.Object);
        _unitOfWorkMock.Setup(u => u.Invoices).Returns(_invoiceRepoMock.Object);

        _service = new FournisseurAppService(_unitOfWorkMock.Object);
    }

    [Fact]
    public async Task CreateAsync_ValidRequest_CreatesFournisseur()
    {
        _fournisseurRepoMock.Setup(r => r.AddAsync(It.IsAny<Fournisseur>(), It.IsAny<CancellationToken>()))
            .Callback<Fournisseur, CancellationToken>((f, _) => f.Id = 1)
            .ReturnsAsync((Fournisseur f, CancellationToken _) => f);

        var request = new CreateFournisseurRequest(
            Nom: "Nike",
            Contact: "John",
            Email: "john@nike.com",
            Telephone: "+212600000000",
            Adresse: "Casablanca"
        );

        var result = await _service.CreateAsync(request);

        Assert.Equal("Nike", result.Nom);
        Assert.Equal("John", result.Contact);
        Assert.Equal(0, result.ProduitsCount);
    }

    [Fact]
    public async Task DeleteAsync_NoProducts_Deletes()
    {
        var fournisseur = new Fournisseur { Id = 1, Nom = "Test", Products = new List<Product>() };
        _fournisseurRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(fournisseur);
        _unitOfWorkMock.Setup(u => u.FindAsync<Invoice>(It.IsAny<Expression<Func<Invoice, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Invoice>());

        var result = await _service.DeleteAsync(1);

        Assert.True(result);
        _fournisseurRepoMock.Verify(r => r.Delete(fournisseur), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_WithProducts_ReturnsFalse()
    {
        var fournisseur = new Fournisseur
        {
            Id = 1,
            Nom = "Test",
            Products = new List<Product> { new() { Id = 1, Name = "Shoe" } }
        };
        _fournisseurRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(fournisseur);

        var result = await _service.DeleteAsync(1);

        Assert.False(result);
        _fournisseurRepoMock.Verify(r => r.Delete(It.IsAny<Fournisseur>()), Times.Never);
    }

    [Fact]
    public async Task DeleteAsync_WithInvoices_ReturnsFalse()
    {
        var fournisseur = new Fournisseur { Id = 1, Nom = "Test", Products = new List<Product>() };
        _fournisseurRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(fournisseur);
        _unitOfWorkMock.Setup(u => u.FindAsync<Invoice>(It.IsAny<Expression<Func<Invoice, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Invoice> { new() { Id = 1, FournisseurId = 1 } });

        var result = await _service.DeleteAsync(1);

        Assert.False(result);
        _fournisseurRepoMock.Verify(r => r.Delete(It.IsAny<Fournisseur>()), Times.Never);
    }

    [Fact]
    public async Task DeleteAsync_NonExisting_ReturnsFalse()
    {
        _fournisseurRepoMock.Setup(r => r.GetByIdAsync(999, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Fournisseur?)null);

        var result = await _service.DeleteAsync(999);

        Assert.False(result);
    }

    [Fact]
    public async Task UpdateAsync_ExistingFournisseur_Updates()
    {
        var fournisseur = new Fournisseur { Id = 1, Nom = "Old Name" };
        _fournisseurRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(fournisseur);

        var request = new UpdateFournisseurRequest(Nom: "New Name", Contact: null, Email: null, Telephone: null, Adresse: null);

        var result = await _service.UpdateAsync(1, request);

        Assert.NotNull(result);
        Assert.Equal("New Name", result.Nom);
    }

    [Fact]
    public async Task UpdateAsync_NonExisting_ReturnsNull()
    {
        _fournisseurRepoMock.Setup(r => r.GetByIdAsync(999, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Fournisseur?)null);

        var result = await _service.UpdateAsync(999, new UpdateFournisseurRequest(Nom: "X", Contact: null, Email: null, Telephone: null, Adresse: null));

        Assert.Null(result);
    }

    [Fact]
    public async Task GetPerformanceAsync_EmptyFournisseurs_ReturnsEmpty()
    {
        _fournisseurRepoMock.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Fournisseur>());
        _saleRepoMock.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Sale>());
        _stockRepoMock.Setup(r => r.GetAllWithVariantAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<StockItem>());
        _invoiceRepoMock.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Invoice>());

        var result = await _service.GetPerformanceAsync();

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetPerformanceAsync_WithSales_CalculatesRevenue()
    {
        var fournisseur = new Fournisseur { Id = 1, Nom = "Nike", Products = new List<Product>() };

        var variant = new ProductVariant
        {
            Id = 1, ProductId = 1,
            Product = new Product { Id = 1, Name = "Shoe", FournisseurId = 1, Price = 100m, CostPrice = 60m },
            Color = new Color { Name = "Red" },
            Size = new Size { Value = "42" }
        };

        var sale = new Sale
        {
            Id = 1, Status = OrderStatus.Delivered,
            Items = new List<SaleItem>
            {
                new() { ProductVariantId = 1, Quantity = 5, UnitPrice = 100m, LineTotal = 500m, ProductVariant = variant }
            },
            CreatedAt = DateTime.UtcNow
        };

        _fournisseurRepoMock.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Fournisseur> { fournisseur });
        _saleRepoMock.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Sale> { sale });
        _stockRepoMock.Setup(r => r.GetAllWithVariantAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<StockItem>());
        _invoiceRepoMock.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Invoice>());

        var result = await _service.GetPerformanceAsync();

        Assert.Single(result);
        Assert.Equal(500m, result[0].RevenuTotal);
        Assert.Equal(200m, result[0].BeneficeTotal);
    }

    [Fact]
    public async Task GetRecommendationsAsync_NoSales_ReturnsEmpty()
    {
        _fournisseurRepoMock.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Fournisseur>());
        _saleRepoMock.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Sale>());
        _stockRepoMock.Setup(r => r.GetAllWithVariantAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<StockItem>());
        _invoiceRepoMock.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Invoice>());

        var result = await _service.GetRecommendationsAsync();

        Assert.Empty(result);
    }
}
