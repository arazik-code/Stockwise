using Microsoft.EntityFrameworkCore;
using SMS.Application.Services;
using SMS.Domain.Entities;
using SMS.Infrastructure.Data;
using SMS.Infrastructure.Data.Repositories;

namespace SMS.API.IntegrationTests.Services;

/// <summary>
/// Covers ProductAppService.GetVariantByBarcodeAsync - the POS barcode-scan path. Previously used
/// IUnitOfWork.FindAsync&lt;T&gt;, a plain Where() with no eager loading, so the mapped DTO's Colour/Size
/// came back empty even though the data itself was fine: a scanned item landed in the cart showing
/// only its SKU. Uses a real InMemory AppDbContext rather than Moq, same reasoning as the Shopify
/// colourway tests - Moq can't fake the async Include()/FirstOrDefaultAsync() chain this method
/// now uses.
/// </summary>
public class ProductAppServiceVariantLookupTests
{
    private static (ProductAppService Service, AppDbContext Db) BuildService()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);
        var unitOfWork = new UnitOfWork(db);
        var service = new ProductAppService(unitOfWork, new ColorwayResolver(unitOfWork));
        return (service, db);
    }

    [Fact]
    public async Task GetVariantByBarcodeAsync_ReturnsResolvedColourAndSize()
    {
        var (service, db) = BuildService();

        var category = new Category { Name = "Chaussures" };
        var product = new Product { Name = "Basket En Cuir Bleu -Cala", Category = category, Price = 429m, IsActive = true };
        var bleu = new Color { Name = "Bleu", HexCode = "#0000FF" };
        var size42 = new Size { Value = "42" };
        db.AddRange(category, product, bleu, size42);
        await db.SaveChangesAsync();

        var colorway = new ProductColorway { ProductId = product.Id, ColorId = bleu.Id, IsActive = true };
        db.Add(colorway);
        await db.SaveChangesAsync();

        var variant = new ProductVariant
        {
            ProductId = product.Id, ColorId = bleu.Id, ColorwayId = colorway.Id, SizeId = size42.Id,
            Sku = "SHP-51917150322982", Barcode = "6111234567890", IsActive = true
        };
        db.Add(variant);
        await db.SaveChangesAsync();

        var result = await service.GetVariantByBarcodeAsync("6111234567890");

        Assert.NotNull(result);
        Assert.Equal("Bleu", result!.ColorName);
        Assert.Equal("42", result.SizeValue);
    }

    [Fact]
    public async Task GetVariantByBarcodeAsync_UnknownBarcode_ReturnsNull()
    {
        var (service, _) = BuildService();

        var result = await service.GetVariantByBarcodeAsync("does-not-exist");

        Assert.Null(result);
    }
}
