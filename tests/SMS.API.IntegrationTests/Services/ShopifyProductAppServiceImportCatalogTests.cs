using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;
using SMS.Application.Services;
using SMS.Domain.Entities;
using SMS.Infrastructure.Data;
using SMS.Infrastructure.Data.Repositories;

namespace SMS.API.IntegrationTests.Services;

/// <summary>
/// Covers ImportCatalogFromShopifyAsync's colourway resolution - specifically the bug where a
/// Shopify product already linked to a colourway (by a prior import, or by the manual "Association"
/// screen picking a product/colour the title alone wouldn't derive) got re-derived independently
/// from the title on every subsequent bulk import. When that derivation landed on a *different*
/// colourway than the one already holding this ShopifyProductId, the importer tried to stamp the
/// same id onto two rows and crashed on the unique ShopifyProductId index (reported live for the
/// "Importer depuis Shopify" button after several products had been manually linked).
/// </summary>
public class ShopifyProductAppServiceImportCatalogTests
{
    private static (ShopifyProductAppService Service, AppDbContext Db) BuildService(FakeShopifyApiClient client)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);
        var unitOfWork = new UnitOfWork(db);
        var colorways = new ColorwayResolver(unitOfWork);
        var service = new ShopifyProductAppService(
            unitOfWork, NullLogger<ShopifyProductAppService>.Instance, new NoopSyncService(), colorways, client);
        return (service, db);
    }

    [Fact]
    public async Task ImportCatalogFromShopifyAsync_ProductAlreadyLinkedToAColourwayTitleParsingWouldntPick_ReusesItInsteadOfColliding()
    {
        var category = new Category { Name = "Chaussures" };
        var product = new Product { Name = "800-lh", Category = category, Price = 400m, IsActive = true };
        var rouge = new Color { Name = "Rouge", HexCode = "#FF0000" };
        var db = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var context = new AppDbContext(db);
        context.AddRange(category, product, rouge);
        await context.SaveChangesAsync();

        // The state a manual link produces: this Shopify product is already claimed by (product,
        // Rouge) - but its title has no recognizable colour word, so title-parsing alone would fall
        // through to the "Standard" default colour, a *different* colourway on the same product.
        var linkedColorway = new ProductColorway
        {
            ProductId = product.Id, ColorId = rouge.Id, ShopifyProductId = 555, ShopifyTitle = "Basket Sport", IsActive = true
        };
        context.Add(linkedColorway);
        await context.SaveChangesAsync();

        var unitOfWork = new UnitOfWork(context);
        var service = new ShopifyProductAppService(
            unitOfWork, NullLogger<ShopifyProductAppService>.Instance, new NoopSyncService(), new ColorwayResolver(unitOfWork),
            new FakeShopifyApiClient([
                new ShopifyProductItem(
                    555, "Basket Sport",
                    [new ShopifyVariantItem(5551, "SKU-5551", "400.00", InventoryItemId: 55510, Option1: "39", InventoryQuantity: 6)],
                    Options: [new ShopifyOptionItem("Pointures", 1, ["39"])])
            ]));

        var result = await service.ImportCatalogFromShopifyAsync();

        Assert.Equal(0, result.ProductsCreated);
        Assert.Equal(1, result.ProductsUpdated);

        // Still exactly one colourway for this Shopify product, and it's still the Rouge one - not
        // a second "Standard" colourway fighting it for the same ShopifyProductId.
        var colorways = await context.ProductColorways.Where(c => c.ShopifyProductId == 555).ToListAsync();
        var colorway = Assert.Single(colorways);
        Assert.Equal(rouge.Id, colorway.ColorId);
        Assert.Equal(linkedColorway.Id, colorway.Id);

        var variant = await context.ProductVariants.SingleAsync(v => v.ShopifyVariantId == 5551);
        Assert.Equal(rouge.Id, variant.ColorId);
        Assert.Equal(colorway.Id, variant.ColorwayId);
    }

    [Fact]
    public async Task ImportCatalogFromShopifyAsync_NeverLinkedProduct_DerivesColourFromTitleAsUsual()
    {
        var (service, db) = BuildService(new FakeShopifyApiClient([
            new ShopifyProductItem(
                600, "Basket En Cuir Noir -Style",
                [new ShopifyVariantItem(6001, "SKU-6001", "300.00", InventoryItemId: 60010, Option1: "40", InventoryQuantity: 4)],
                Options: [new ShopifyOptionItem("Pointures", 1, ["40"])])
        ]));

        var result = await service.ImportCatalogFromShopifyAsync();

        Assert.Equal(1, result.ProductsCreated);
        var colorway = await db.ProductColorways.SingleAsync(c => c.ShopifyProductId == 600);
        var color = await db.Colors.SingleAsync(c => c.Id == colorway.ColorId);
        Assert.Equal("Noir", color.Name);
    }

    [Fact]
    public async Task ImportCatalogFromShopifyAsync_SingleColourwayProduct_KeepsSyncingNameFromShopify()
    {
        var db = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var context = new AppDbContext(db);
        var unitOfWork = new UnitOfWork(context);

        var service1 = new ShopifyProductAppService(
            unitOfWork, NullLogger<ShopifyProductAppService>.Instance, new NoopSyncService(), new ColorwayResolver(unitOfWork),
            new FakeShopifyApiClient([
                new ShopifyProductItem(
                    700, "Basket En Cuir Noir -Style",
                    [new ShopifyVariantItem(7001, "SKU-7001", "300.00", InventoryItemId: 70010, Option1: "40", InventoryQuantity: 4)],
                    Options: [new ShopifyOptionItem("Pointures", 1, ["40"])])
            ]));
        await service1.ImportCatalogFromShopifyAsync();
        var productId = (await context.Products.SingleAsync()).Id;
        Assert.Equal("Basket En Cuir Noir -Style", (await context.Products.FindAsync(productId))!.Name);

        // The merchant fixes a typo in Shopify's title - a plain, never-consolidated product should
        // still pick that up on the next sync.
        var service2 = new ShopifyProductAppService(
            unitOfWork, NullLogger<ShopifyProductAppService>.Instance, new NoopSyncService(), new ColorwayResolver(unitOfWork),
            new FakeShopifyApiClient([
                new ShopifyProductItem(
                    700, "Basket En Cuir Noir -Style Corrigé",
                    [new ShopifyVariantItem(7001, "SKU-7001", "300.00", InventoryItemId: 70010, Option1: "40", InventoryQuantity: 4)],
                    Options: [new ShopifyOptionItem("Pointures", 1, ["40"])])
            ]));
        await service2.ImportCatalogFromShopifyAsync();

        Assert.Equal("Basket En Cuir Noir -Style Corrigé", (await context.Products.FindAsync(productId))!.Name);
    }

    [Fact]
    public async Task ImportCatalogFromShopifyAsync_ConsolidatedMultiColourwayProduct_NeverOverwritesTheUserChosenName()
    {
        var db = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var context = new AppDbContext(db);
        var unitOfWork = new UnitOfWork(context);

        var service1 = new ShopifyProductAppService(
            unitOfWork, NullLogger<ShopifyProductAppService>.Instance, new NoopSyncService(), new ColorwayResolver(unitOfWork),
            new FakeShopifyApiClient([
                new ShopifyProductItem(
                    701, "Basket En Cuir Noir -Style",
                    [new ShopifyVariantItem(7011, "SKU-7011", "300.00", InventoryItemId: 70110, Option1: "40", InventoryQuantity: 4)],
                    Options: [new ShopifyOptionItem("Pointures", 1, ["40"])])
            ]));
        await service1.ImportCatalogFromShopifyAsync();
        var product = await context.Products.SingleAsync();

        // The user renames the product to their own catalog code and manually links a second colour
        // onto it - the state LinkColorwayAsync produces, and the whole point of consolidation.
        product.Name = "977-lh";
        var vert = new Color { Name = "Vert", HexCode = "#00FF00" };
        context.Add(vert);
        await context.SaveChangesAsync();
        context.Add(new ProductColorway { ProductId = product.Id, ColorId = vert.Id, ShopifyProductId = 702, ShopifyTitle = "Basket En Cuir Vert -Style", IsActive = true });
        await context.SaveChangesAsync();

        // A full catalog resync must not let either Shopify product's title stomp "977-lh".
        var service2 = new ShopifyProductAppService(
            unitOfWork, NullLogger<ShopifyProductAppService>.Instance, new NoopSyncService(), new ColorwayResolver(unitOfWork),
            new FakeShopifyApiClient([
                new ShopifyProductItem(
                    701, "Basket En Cuir Noir -Style",
                    [new ShopifyVariantItem(7011, "SKU-7011", "300.00", InventoryItemId: 70110, Option1: "40", InventoryQuantity: 4)],
                    Options: [new ShopifyOptionItem("Pointures", 1, ["40"])]),
                new ShopifyProductItem(
                    702, "Basket En Cuir Vert -Style",
                    [new ShopifyVariantItem(7021, "SKU-7021", "300.00", InventoryItemId: 70210, Option1: "40", InventoryQuantity: 2)],
                    Options: [new ShopifyOptionItem("Pointures", 1, ["40"])])
            ]));
        await service2.ImportCatalogFromShopifyAsync();

        Assert.Equal("977-lh", (await context.Products.FindAsync(product.Id))!.Name);
    }

    private sealed class NoopSyncService : IShopifySyncService
    {
        public Task ProcessOrderCreatedAsync(long shopifyOrderId, string orderNumber, string financialStatus,
            string fulfillmentStatus, decimal totalPrice, string currency, string? customerEmail,
            string? customerName, List<ShopifyLineItemDto> lineItems, DateTime createdAt,
            string? customerPhone = null, string? city = null, string? addressLine = null,
            long? shopifyCustomerId = null, CancellationToken ct = default) => throw new NotSupportedException();
        public Task ProcessOrderCancelledAsync(long shopifyOrderId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task SyncRecentOrdersAsync(CancellationToken ct = default) => throw new NotSupportedException();
        public Task SyncInventoryLevelsAsync(CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ShopifySyncStatusDto> GetSyncStatusAsync(CancellationToken ct = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<ShopifyLocationDto>> GetLocationsAsync(CancellationToken ct = default) => throw new NotSupportedException();
        public Task<OrderRematchResultDto> RematchConflictedOrdersAsync(CancellationToken ct = default) =>
            Task.FromResult(new OrderRematchResultDto(0, 0, 0, 0));
        public Task<OrderBackfillResultDto> BackfillMissingLineItemsAsync(CancellationToken ct = default) => throw new NotSupportedException();
    }

    /// <summary>Hand-rolled rather than Moq (not referenced by this test project).</summary>
    private sealed class FakeShopifyApiClient(List<ShopifyProductItem> products) : IShopifyApiClient
    {
        public Task<List<ShopifyProductItem>> GetAllProductsAsync(CancellationToken ct = default) => Task.FromResult(products);
        public Task<List<ShopifyCollectionItem>> GetAllCollectionsAsync(CancellationToken ct = default) => Task.FromResult(new List<ShopifyCollectionItem>());
        public Task<List<ShopifyCollectItem>> GetAllCollectsAsync(CancellationToken ct = default) => Task.FromResult(new List<ShopifyCollectItem>());

        public Task<bool> UpdateInventoryLevelAsync(long inventoryItemId, long locationId, int available, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ShopifyProductListResponse?> GetProductsAsync(int limit = 50, string? pageInfo = null, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ShopifyVariantItem?> GetVariantAsync(long shopifyVariantId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<bool> UpdateVariantSkuAsync(long shopifyVariantId, string sku, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<ShopifyInventoryLevelItem>> GetInventoryLevelsAsync(IReadOnlyList<long> inventoryItemIds, long locationId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ShopifyOrderListResponse?> GetOrdersAsync(string status = "any", int limit = 50, DateTime? createdAtMin = null, string? pageInfo = null, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<bool> RegisterWebhookAsync(string topic, string callbackUrl, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ShopifyLocationListResponse?> GetLocationsAsync(CancellationToken ct = default) => throw new NotSupportedException();
        public Task<List<ShopifyCustomerItem>> GetAllCustomersAsync(CancellationToken ct = default) => throw new NotSupportedException();
        public Task<List<ShopifyOrderItem>> GetAllOrdersAsync(CancellationToken ct = default) => throw new NotSupportedException();
    }
}
