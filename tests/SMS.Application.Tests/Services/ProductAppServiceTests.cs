using SMS.Application.DTOs.Products;
using SMS.Application.Services;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Application.Tests.Services;

public class ProductAppServiceTests
{
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IProductRepository> _productRepoMock;
    private readonly ProductAppService _service;

    public ProductAppServiceTests()
    {
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _productRepoMock = new Mock<IProductRepository>();
        _unitOfWorkMock.Setup(u => u.Products).Returns(_productRepoMock.Object);
        _service = new ProductAppService(_unitOfWorkMock.Object);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsAllProducts()
    {
        var products = new List<Product>
        {
            new() { Id = 1, Name = "Shoe A", Category = new Category { Name = "Shoes" }, Variants = [] },
            new() { Id = 2, Name = "Shoe B", Category = new Category { Name = "Shoes" }, Variants = [] }
        };

        _productRepoMock.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(products);

        var result = await _service.GetAllAsync();

        Assert.Equal(2, result.Count);
        Assert.Equal("Shoe A", result[0].Name);
        Assert.Equal("Shoe B", result[1].Name);
    }

    [Fact]
    public async Task GetByIdAsync_ExistingProduct_ReturnsProduct()
    {
        var product = new Product
        {
            Id = 1,
            Name = "Running Shoe",
            Category = new Category { Name = "Shoes" },
            Variants = []
        };

        _productRepoMock.Setup(r => r.GetWithStockAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(product);

        var result = await _service.GetByIdAsync(1);

        Assert.NotNull(result);
        Assert.Equal(1, result.Id);
        Assert.Equal("Running Shoe", result.Name);
    }

    [Fact]
    public async Task GetByIdAsync_NonExistingProduct_ReturnsNull()
    {
        _productRepoMock.Setup(r => r.GetWithStockAsync(999, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Product?)null);

        var result = await _service.GetByIdAsync(999);

        Assert.Null(result);
    }

    [Fact]
    public async Task CreateAsync_ValidRequest_CreatesProduct()
    {
        var request = new CreateProductRequest
        {
            Name = "Running Shoe",
            CategoryId = 1
        };

        _productRepoMock.Setup(r => r.AddAsync(It.IsAny<Product>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Product p, CancellationToken _) => { p.Id = 1; return p; });

        var result = await _service.CreateAsync(request);

        Assert.Equal(1, result.Id);
        Assert.Equal("Running Shoe", result.Name);
        _productRepoMock.Verify(r => r.AddAsync(It.IsAny<Product>(), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.AtLeastOnce);
    }

    [Fact]
    public async Task UpdateAsync_ExistingProduct_UpdatesProduct()
    {
        var product = new Product
        {
            Id = 1,
            Name = "Old Name",
            Category = new Category { Name = "Shoes" },
            Variants = []
        };

        _productRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(product);

        var request = new UpdateProductRequest
        {
            Name = "New Name"
        };

        var result = await _service.UpdateAsync(1, request);

        Assert.NotNull(result);
        Assert.Equal("New Name", result.Name);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_NonExistingProduct_ReturnsNull()
    {
        _productRepoMock.Setup(r => r.GetByIdAsync(999, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Product?)null);

        var result = await _service.UpdateAsync(999, new UpdateProductRequest { Name = "Test" });

        Assert.Null(result);
    }

    [Fact]
    public async Task DeleteAsync_ExistingProduct_SoftDeletes()
    {
        var product = new Product { Id = 1, IsActive = true, Variants = [] };

        _productRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(product);

        var result = await _service.DeleteAsync(1);

        Assert.True(result);
        Assert.False(product.IsActive);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_NonExistingProduct_ReturnsFalse()
    {
        _productRepoMock.Setup(r => r.GetByIdAsync(999, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Product?)null);

        var result = await _service.DeleteAsync(999);

        Assert.False(result);
    }

    [Fact]
    public async Task SearchAsync_WithQuery_SearchesByName()
    {
        var products = new List<Product>
        {
            new() { Id = 1, Name = "Running Shoe", Category = new Category { Name = "Shoes" }, Variants = [] }
        };

        _productRepoMock.Setup(r => r.SearchAsync("running", It.IsAny<CancellationToken>()))
            .ReturnsAsync(products);

        var request = new ProductSearchRequest { Query = "running" };
        var result = await _service.SearchAsync(request);

        Assert.Single(result);
        Assert.Equal("Running Shoe", result[0].Name);
    }

    [Fact]
    public async Task SearchAsync_WithCategoryId_FiltersByCategory()
    {
        var products = new List<Product>
        {
            new() { Id = 1, Name = "Shoe A", Category = new Category { Name = "Shoes" }, Variants = [] }
        };

        _productRepoMock.Setup(r => r.GetByCategoryAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(products);

        var request = new ProductSearchRequest { CategoryId = 1 };
        var result = await _service.SearchAsync(request);

        Assert.Single(result);
    }

    [Fact]
    public async Task CreateAsync_ValidRequest_AutoGeneratesProductBarcode()
    {
        var request = new CreateProductRequest
        {
            Name = "Running Shoe",
            CategoryId = 1
        };

        _productRepoMock.Setup(r => r.AddAsync(It.IsAny<Product>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Product p, CancellationToken _) => { p.Id = 7; return p; });

        var result = await _service.CreateAsync(request);

        Assert.Equal("PGRP-7", result.Barcode);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task GetByBarcodeAsync_ExistingBarcode_ReturnsProduct()
    {
        var product = new Product
        {
            Id = 1,
            Name = "Running Shoe",
            Barcode = "PGRP-1",
            Category = new Category { Name = "Shoes" },
            Variants = []
        };

        _productRepoMock.Setup(r => r.GetByBarcodeAsync("PGRP-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(product);

        var result = await _service.GetByBarcodeAsync("PGRP-1");

        Assert.NotNull(result);
        Assert.Equal("Running Shoe", result.Name);
        Assert.Equal("PGRP-1", result.Barcode);
    }

    [Fact]
    public async Task GetByBarcodeAsync_UnknownBarcode_ReturnsNull()
    {
        _productRepoMock.Setup(r => r.GetByBarcodeAsync("UNKNOWN", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Product?)null);

        var result = await _service.GetByBarcodeAsync("UNKNOWN");

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateMissingBarcodesAsync_ProductWithoutBarcode_BackfillsIt()
    {
        var products = new List<Product>
        {
            new() { Id = 3, Name = "Shoe A", Barcode = null, Variants = [] }
        };

        _unitOfWorkMock.Setup(u => u.Set<Product>()).Returns(products.AsQueryable());
        _unitOfWorkMock.Setup(u => u.Set<ProductVariant>()).Returns(new List<ProductVariant>().AsQueryable());

        var count = await _service.GenerateMissingBarcodesAsync();

        Assert.Equal(1, count);
        // Now generates a valid, scannable 13-digit EAN-13 barcode (internal-use "22" prefix).
        Assert.NotNull(products[0].Barcode);
        Assert.Equal(13, products[0].Barcode!.Length);
        Assert.StartsWith("22", products[0].Barcode!);
        Assert.Matches("^[0-9]{13}$", products[0].Barcode!);
    }
}
