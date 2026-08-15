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
/// Covers ShopifyProductAppService.LinkColorwayAsync - the fix for the "associating a second
/// colour will overwrite the first one" report. Uses a real InMemory AppDbContext/UnitOfWork
/// rather than mocks: the method leans on EF's async LINQ (Set&lt;T&gt;().Include()/FirstOrDefaultAsync()/
/// ToDictionaryAsync()), which Moq can't fake without a hand-rolled async query provider - the
/// same reason ImportCatalogFromShopifyAsync, which this method mirrors, has no Moq-based test
/// either. IShopifyApiClient is the one genuinely external dependency, so that's the one faked.
/// </summary>
public class ShopifyProductAppServiceLinkColorwayTests
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

    private static async Task<(Product Product, Color ColorA, Color ColorB, Size SizeA, Size SizeB)> SeedBaseDataAsync(AppDbContext db)
    {
        var category = new Category { Name = "Chaussures" };
        var product = new Product { Name = "Zeggane", Category = category, Price = 400m, IsActive = true };
        var colorA = new Color { Name = "Vert", HexCode = "#00FF00" };
        var colorB = new Color { Name = "Noir", HexCode = "#000000" };
        var sizeA = new Size { Value = "39" };
        var sizeB = new Size { Value = "40" };
        db.AddRange(category, product, colorA, colorB, sizeA, sizeB);
        await db.SaveChangesAsync();
        return (product, colorA, colorB, sizeA, sizeB);
    }

    private static ShopifyProductItem MakeShopifyProduct(long shopifyProductId, string title, params (long VariantId, string Size, int Qty)[] variants)
        => new(
            shopifyProductId, title,
            variants.Select(v => new ShopifyVariantItem(v.VariantId, $"SKU-{v.VariantId}", "400.00", InventoryItemId: v.VariantId * 10, Option1: v.Size, InventoryQuantity: v.Qty)).ToList(),
            Options: [new ShopifyOptionItem("Pointures", 1, variants.Select(v => v.Size).ToList())]);

    [Fact]
    public async Task LinkColorwayAsync_NewColourway_CreatesVariantsWithRealShopifyLinks()
    {
        var shopifyProduct = MakeShopifyProduct(100, "Basket En Cuir Vert -Zeggane", (1001, "39", 5), (1002, "40", 3));
        var (service, db) = BuildService(new FakeShopifyApiClient([shopifyProduct]));
        var (product, colorA, _, sizeA, sizeB) = await SeedBaseDataAsync(db);

        var result = await service.LinkColorwayAsync(100, new LinkColorwayRequest { LocalProductId = product.Id, ColorId = colorA.Id });

        Assert.True(result.Success, result.Message);
        Assert.Equal(2, result.VariantsCreated);
        Assert.Equal(0, result.VariantsUpdated);

        var colorway = await db.ProductColorways.SingleAsync(c => c.ProductId == product.Id && c.ColorId == colorA.Id);
        Assert.Equal(100, colorway.ShopifyProductId);

        var variants = await db.ProductVariants.Where(v => v.ColorwayId == colorway.Id).ToListAsync();
        Assert.Equal(2, variants.Count);
        Assert.Contains(variants, v => v.SizeId == sizeA.Id && v.ShopifyVariantId == 1001);
        Assert.Contains(variants, v => v.SizeId == sizeB.Id && v.ShopifyVariantId == 1002);

        var variantIdForSizeA = variants.First(v => v.SizeId == sizeA.Id).Id;
        var stockForSizeA = await db.StockItems.SingleAsync(s => s.ProductVariantId == variantIdForSizeA);
        Assert.Equal(5, stockForSizeA.QuantityOnHand);
    }

    [Fact]
    public async Task LinkColorwayAsync_ExistingLocalVariant_ReusesItInsteadOfDuplicating()
    {
        var shopifyProduct = MakeShopifyProduct(200, "Basket En Cuir Noir -Zeggane", (2001, "39", 7));
        var (service, db) = BuildService(new FakeShopifyApiClient([shopifyProduct]));
        var (product, _, colorB, sizeA, _) = await SeedBaseDataAsync(db);

        // A colourway + variant already exist locally (hand-created), with no Shopify link yet -
        // exactly the "977-lh" state found on production.
        var colorway = new ProductColorway { ProductId = product.Id, ColorId = colorB.Id, IsActive = true };
        db.Add(colorway);
        await db.SaveChangesAsync();
        var preExistingVariant = new ProductVariant
        {
            ProductId = product.Id, ColorId = colorB.Id, ColorwayId = colorway.Id, SizeId = sizeA.Id,
            Sku = "PRD-HAND-MADE", IsActive = true
        };
        db.Add(preExistingVariant);
        await db.SaveChangesAsync();

        var result = await service.LinkColorwayAsync(200, new LinkColorwayRequest { LocalProductId = product.Id, ColorId = colorB.Id });

        Assert.True(result.Success, result.Message);
        Assert.Equal(0, result.VariantsCreated);
        Assert.Equal(1, result.VariantsUpdated);

        var reloaded = await db.ProductVariants.SingleAsync(v => v.Id == preExistingVariant.Id);
        Assert.Equal(2001, reloaded.ShopifyVariantId);
        // The hand-assigned SKU is preserved, not overwritten by Shopify's - see the comment at the
        // call site for why this deliberately differs from the bulk importer's behaviour.
        Assert.Equal("PRD-HAND-MADE", reloaded.Sku);

        Assert.Equal(1, await db.ProductColorways.CountAsync(c => c.ProductId == product.Id && c.ColorId == colorB.Id));
    }

    [Fact]
    public async Task LinkColorwayAsync_LinkingASecondColour_DoesNotTouchTheFirstColourwaysRows()
    {
        // This is the exact regression the report described: link Vert, then link Noir, and
        // confirm Vert's colourway/variants/stock are byte-for-byte unchanged afterwards.
        var vert = MakeShopifyProduct(301, "Basket En Cuir Vert -Zeggane", (3001, "39", 5));
        var noir = MakeShopifyProduct(302, "Basket En Cuir Noir -Zeggane", (3002, "39", 9));
        var (service, db) = BuildService(new FakeShopifyApiClient([vert, noir]));
        var (product, colorA, colorB, _, _) = await SeedBaseDataAsync(db);

        var first = await service.LinkColorwayAsync(301, new LinkColorwayRequest { LocalProductId = product.Id, ColorId = colorA.Id });
        Assert.True(first.Success, first.Message);

        var vertColorwayId = (await db.ProductColorways.SingleAsync(c => c.ProductId == product.Id && c.ColorId == colorA.Id)).Id;
        var vertVariantIdsBefore = await db.ProductVariants.Where(v => v.ColorwayId == vertColorwayId).Select(v => v.Id).ToListAsync();
        var vertStockBefore = await db.StockItems
            .Where(s => vertVariantIdsBefore.Contains(s.ProductVariantId))
            .ToDictionaryAsync(s => s.ProductVariantId, s => s.QuantityOnHand);

        var second = await service.LinkColorwayAsync(302, new LinkColorwayRequest { LocalProductId = product.Id, ColorId = colorB.Id });
        Assert.True(second.Success, second.Message);

        // Two independent colourways now exist under the same product.
        Assert.Equal(2, await db.ProductColorways.CountAsync(c => c.ProductId == product.Id));

        var vertVariantIdsAfter = await db.ProductVariants.Where(v => v.ColorwayId == vertColorwayId).Select(v => v.Id).ToListAsync();
        Assert.Equal(vertVariantIdsBefore.OrderBy(x => x), vertVariantIdsAfter.OrderBy(x => x));
        foreach (var (variantId, qtyBefore) in vertStockBefore)
        {
            var qtyAfter = (await db.StockItems.SingleAsync(s => s.ProductVariantId == variantId)).QuantityOnHand;
            Assert.Equal(qtyBefore, qtyAfter);
        }

        var vertColorwayAfter = await db.ProductColorways.SingleAsync(c => c.Id == vertColorwayId);
        Assert.Equal(301, vertColorwayAfter.ShopifyProductId);
    }

    [Fact]
    public async Task LinkColorwayAsync_ShopifyProductAlreadyLinkedElsewhere_RefusesToRepoint()
    {
        var shopifyProduct = MakeShopifyProduct(400, "Basket En Cuir Blanc -Zeggane", (4001, "39", 2));
        var (service, db) = BuildService(new FakeShopifyApiClient([shopifyProduct]));
        var (product, colorA, _, _, _) = await SeedBaseDataAsync(db);
        var otherProduct = new Product { Name = "Other Style", Category = product.Category, Price = 300m, IsActive = true };
        db.Add(otherProduct);
        await db.SaveChangesAsync();

        var first = await service.LinkColorwayAsync(400, new LinkColorwayRequest { LocalProductId = product.Id, ColorId = colorA.Id });
        Assert.True(first.Success, first.Message);

        var result = await service.LinkColorwayAsync(400, new LinkColorwayRequest { LocalProductId = otherProduct.Id, ColorId = colorA.Id });

        Assert.False(result.Success);
        Assert.Contains(product.Id.ToString(), result.Message);
        // Nothing moved - the colourway is still under the original product.
        Assert.Equal(1, await db.ProductColorways.CountAsync(c => c.ShopifyProductId == 400));
        Assert.True(await db.ProductColorways.AnyAsync(c => c.ShopifyProductId == 400 && c.ProductId == product.Id));
    }

    [Fact]
    public async Task LinkColorwayAsync_ReconfirmingTheSameLink_IsIdempotent()
    {
        var shopifyProduct = MakeShopifyProduct(500, "Basket En Cuir Bleu -Zeggane", (5001, "39", 4));
        var (service, db) = BuildService(new FakeShopifyApiClient([shopifyProduct]));
        var (product, colorA, _, _, _) = await SeedBaseDataAsync(db);

        var first = await service.LinkColorwayAsync(500, new LinkColorwayRequest { LocalProductId = product.Id, ColorId = colorA.Id });
        Assert.True(first.Success, first.Message);
        Assert.Equal(1, first.VariantsCreated);

        var second = await service.LinkColorwayAsync(500, new LinkColorwayRequest { LocalProductId = product.Id, ColorId = colorA.Id });

        Assert.True(second.Success, second.Message);
        Assert.Equal(0, second.VariantsCreated);
        Assert.Equal(1, second.VariantsUpdated);
        Assert.Equal(1, await db.ProductVariants.CountAsync(v => v.ProductId == product.Id));
    }

    [Fact]
    public async Task LinkColorwayAsync_UnknownShopifyProduct_ReturnsFailureWithoutMutating()
    {
        var (service, db) = BuildService(new FakeShopifyApiClient([]));
        var (product, colorA, _, _, _) = await SeedBaseDataAsync(db);

        var result = await service.LinkColorwayAsync(999999, new LinkColorwayRequest { LocalProductId = product.Id, ColorId = colorA.Id });

        Assert.False(result.Success);
        Assert.Empty(await db.ProductColorways.ToListAsync());
    }

    [Fact]
    public async Task UnlinkColorwayAsync_ClearsTheRealLinkButKeepsLocalDataAndStock()
    {
        var shopifyProduct = MakeShopifyProduct(600, "Basket En Cuir Rose -Zeggane", (6001, "39", 6));
        var (service, db) = BuildService(new FakeShopifyApiClient([shopifyProduct]));
        var (product, colorA, _, _, _) = await SeedBaseDataAsync(db);

        var linkResult = await service.LinkColorwayAsync(600, new LinkColorwayRequest { LocalProductId = product.Id, ColorId = colorA.Id });
        Assert.True(linkResult.Success, linkResult.Message);
        var colorwayId = linkResult.ColorwayId;

        var unlinked = await service.UnlinkColorwayAsync(600);

        Assert.True(unlinked);
        var colorway = await db.ProductColorways.SingleAsync(c => c.Id == colorwayId);
        Assert.Null(colorway.ShopifyProductId);
        Assert.Null(colorway.ShopifyTitle);
        // The colourway itself, its variant and its stock all survive - only the Shopify pointers go.
        var variant = await db.ProductVariants.SingleAsync(v => v.ColorwayId == colorwayId);
        Assert.Null(variant.ShopifyVariantId);
        Assert.Equal(1, await db.StockItems.CountAsync(s => s.ProductVariantId == variant.Id));
    }

    [Fact]
    public async Task UnlinkColorwayAsync_UnknownShopifyProduct_ReturnsFalse()
    {
        var (service, db) = BuildService(new FakeShopifyApiClient([]));
        await SeedBaseDataAsync(db);

        Assert.False(await service.UnlinkColorwayAsync(777777));
    }

    /// <summary>Unused by LinkColorwayAsync - present only to satisfy the constructor.</summary>
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
        public Task<OrderRematchResultDto> RematchConflictedOrdersAsync(CancellationToken ct = default) => throw new NotSupportedException();
        public Task<OrderBackfillResultDto> BackfillMissingLineItemsAsync(CancellationToken ct = default) => throw new NotSupportedException();
    }

    /// <summary>Hand-rolled rather than Moq (not referenced by this test project): only GetAllProductsAsync is exercised.</summary>
    private sealed class FakeShopifyApiClient(List<ShopifyProductItem> products) : IShopifyApiClient
    {
        public Task<List<ShopifyProductItem>> GetAllProductsAsync(CancellationToken ct = default) => Task.FromResult(products);

        public Task<bool> UpdateInventoryLevelAsync(long inventoryItemId, long locationId, int available, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ShopifyProductListResponse?> GetProductsAsync(int limit = 50, string? pageInfo = null, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ShopifyVariantItem?> GetVariantAsync(long shopifyVariantId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<bool> UpdateVariantSkuAsync(long shopifyVariantId, string sku, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<ShopifyInventoryLevelItem>> GetInventoryLevelsAsync(IReadOnlyList<long> inventoryItemIds, long locationId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ShopifyOrderListResponse?> GetOrdersAsync(string status = "any", int limit = 50, DateTime? createdAtMin = null, string? pageInfo = null, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<bool> RegisterWebhookAsync(string topic, string callbackUrl, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ShopifyLocationListResponse?> GetLocationsAsync(CancellationToken ct = default) => throw new NotSupportedException();
        public Task<List<ShopifyCollectionItem>> GetAllCollectionsAsync(CancellationToken ct = default) => throw new NotSupportedException();
        public Task<List<ShopifyCollectItem>> GetAllCollectsAsync(CancellationToken ct = default) => throw new NotSupportedException();
        public Task<List<ShopifyCustomerItem>> GetAllCustomersAsync(CancellationToken ct = default) => throw new NotSupportedException();
        public Task<List<ShopifyOrderItem>> GetAllOrdersAsync(CancellationToken ct = default) => throw new NotSupportedException();
    }
}
