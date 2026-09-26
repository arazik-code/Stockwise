using Microsoft.EntityFrameworkCore;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Infrastructure.Data;
using SMS.Infrastructure.Data.Repositories;

namespace SMS.API.IntegrationTests.Services;

/// <summary>
/// SaleRepository.GetAllAsync was missing the Colour/Size includes that every other query method
/// in this repository has (GetByDateRangeAsync, GetByChannelAsync, GetWithItemsAsync all include
/// them). It backs GET /sales, which the Refunds page, the Exchange dialog and the Dashboard's
/// recent-sales widget all call directly - so a past sale looked up from any of those screens
/// showed its items with no colour or size, only the product name, even though the same sale's
/// data was fine everywhere else.
/// </summary>
public class SaleRepositoryGetAllTests
{
    [Fact]
    public async Task GetAllAsync_ResolvesItemColourAndSize()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);
        var repo = new SaleRepository(db);

        var category = new Category { Name = "Chaussures" };
        var product = new Product { Name = "Basket En Cuir Bleu -Cala", Category = category, Price = 429m, IsActive = true };
        var bleu = new Color { Name = "Bleu", HexCode = "#0000FF" };
        var size42 = new Size { Value = "42" };
        var role = new Role { Name = "Cashier" };
        var user = new User { Username = "cashier1", PasswordHash = "x", FullName = "Cashier One", Role = role };
        db.AddRange(category, product, bleu, size42, role, user);
        await db.SaveChangesAsync();

        var colorway = new ProductColorway { ProductId = product.Id, ColorId = bleu.Id, IsActive = true };
        db.Add(colorway);
        await db.SaveChangesAsync();

        var variant = new ProductVariant
        {
            ProductId = product.Id, ColorId = bleu.Id, ColorwayId = colorway.Id, SizeId = size42.Id,
            Sku = "SKU-1", IsActive = true
        };
        db.Add(variant);
        await db.SaveChangesAsync();

        var sale = new Sale
        {
            SaleNumber = "POS-TEST-001", Channel = SaleChannel.Local, Category = SaleCategory.VenteNormale,
            PaymentMethod = PaymentMethod.Cash, TotalAmount = 429m, User = user, Status = OrderStatus.Delivered,
            Items = [new SaleItem { ProductVariant = variant, Quantity = 1, UnitPrice = 429m, LineTotal = 429m }]
        };
        db.Add(sale);
        await db.SaveChangesAsync();

        var all = await repo.GetAllAsync();

        var reloaded = Assert.Single(all);
        var item = Assert.Single(reloaded.Items);
        Assert.Equal("Bleu", item.ProductVariant.Color.Name);
        Assert.Equal("42", item.ProductVariant.Size.Value);
    }
}
