using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;
using SMS.Application.Services;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
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

        // MakeShopifyProduct doesn't set a Shopify barcode (matches production reality for this
        // catalog) - a brand new variant must still come out scannable, not blank.
        Assert.All(variants, v => Assert.False(string.IsNullOrWhiteSpace(v.Barcode)));
        Assert.Equal(2, variants.Select(v => v.Barcode).Distinct().Count());
    }

    [Fact]
    public async Task LinkColorwayAsync_ExistingLocalVariantWithBarcode_PreservesItInsteadOfOverwriting()
    {
        // The local barcode is what's physically printed and stuck on the stock - linking to
        // Shopify must never silently invalidate every label already in the store.
        var shopifyProduct = new ShopifyProductItem(
            800, "Basket En Cuir Marron -Zeggane",
            [new ShopifyVariantItem(8001, "SKU-8001", "400.00", InventoryItemId: 80010, Barcode: "9999999999990", Option1: "39", InventoryQuantity: 4)],
            Options: [new ShopifyOptionItem("Pointures", 1, ["39"])]);
        var (service, db) = BuildService(new FakeShopifyApiClient([shopifyProduct]));
        var (product, colorA, _, sizeA, _) = await SeedBaseDataAsync(db);

        var colorway = new ProductColorway { ProductId = product.Id, ColorId = colorA.Id, IsActive = true };
        db.Add(colorway);
        await db.SaveChangesAsync();
        var preExistingVariant = new ProductVariant
        {
            ProductId = product.Id, ColorId = colorA.Id, ColorwayId = colorway.Id, SizeId = sizeA.Id,
            Sku = "PRD-HAND-MADE", Barcode = "1111111111117", IsActive = true
        };
        db.Add(preExistingVariant);
        await db.SaveChangesAsync();

        var result = await service.LinkColorwayAsync(800, new LinkColorwayRequest { LocalProductId = product.Id, ColorId = colorA.Id });

        Assert.True(result.Success, result.Message);
        var reloaded = await db.ProductVariants.SingleAsync(v => v.Id == preExistingVariant.Id);
        Assert.Equal("1111111111117", reloaded.Barcode);
    }

    [Fact]
    public async Task LinkColorwayAsync_ExistingLocalVariantWithoutBarcode_FillsFromShopify()
    {
        var shopifyProduct = new ShopifyProductItem(
            801, "Basket En Cuir Beige -Zeggane",
            [new ShopifyVariantItem(8011, "SKU-8011", "400.00", InventoryItemId: 80110, Barcode: "9999999999990", Option1: "39", InventoryQuantity: 4)],
            Options: [new ShopifyOptionItem("Pointures", 1, ["39"])]);
        var (service, db) = BuildService(new FakeShopifyApiClient([shopifyProduct]));
        var (product, colorA, _, sizeA, _) = await SeedBaseDataAsync(db);

        var colorway = new ProductColorway { ProductId = product.Id, ColorId = colorA.Id, IsActive = true };
        db.Add(colorway);
        await db.SaveChangesAsync();
        var preExistingVariant = new ProductVariant
        {
            ProductId = product.Id, ColorId = colorA.Id, ColorwayId = colorway.Id, SizeId = sizeA.Id,
            Sku = "PRD-HAND-MADE", Barcode = null, IsActive = true
        };
        db.Add(preExistingVariant);
        await db.SaveChangesAsync();

        var result = await service.LinkColorwayAsync(801, new LinkColorwayRequest { LocalProductId = product.Id, ColorId = colorA.Id });

        Assert.True(result.Success, result.Message);
        var reloaded = await db.ProductVariants.SingleAsync(v => v.Id == preExistingVariant.Id);
        Assert.Equal("9999999999990", reloaded.Barcode);
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
    public async Task LinkColorwayAsync_StaleOrphanedVariantSharesPlaceholderSku_ReparentsInsteadOfCrashing()
    {
        // Reproduces the production bug: Shopify's variant has no SKU of its own, so the
        // deterministic SHP-{id} placeholder is used - and a stale local variant from a prior,
        // since-unlinked import already holds that exact SKU. Must reparent that row rather than
        // trying (and failing on the unique index) to insert a second row on the same SKU.
        var shopifyProduct = new ShopifyProductItem(
            700, "Basket En Cuir Bleu -Zeggane",
            [new ShopifyVariantItem(7001, "", "400.00", InventoryItemId: 70010, Option1: "39", InventoryQuantity: 3)],
            Options: [new ShopifyOptionItem("Pointures", 1, ["39"])]);
        var (service, db) = BuildService(new FakeShopifyApiClient([shopifyProduct]));
        var (product, colorA, _, sizeA, _) = await SeedBaseDataAsync(db);

        // The orphan: its own product/colourway, unlinked (ShopifyVariantId null), but its SKU is
        // the exact placeholder this Shopify variant would generate.
        var staleProduct = new Product { Name = "Basket  En Cuir Bleu -Zeggane", Category = product.Category, Price = 400m, IsActive = true };
        db.Add(staleProduct);
        await db.SaveChangesAsync();
        var staleColorway = new ProductColorway { ProductId = staleProduct.Id, ColorId = colorA.Id, IsActive = true };
        db.Add(staleColorway);
        await db.SaveChangesAsync();
        var staleVariant = new ProductVariant
        {
            ProductId = staleProduct.Id, ColorId = colorA.Id, ColorwayId = staleColorway.Id, SizeId = sizeA.Id,
            Sku = "SHP-7001", IsActive = true
        };
        db.Add(staleVariant);
        await db.SaveChangesAsync();
        db.Add(new StockItem { ProductVariantId = staleVariant.Id, QuantityOnHand = 1, ReorderLevel = 5, LastUpdatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var result = await service.LinkColorwayAsync(700, new LinkColorwayRequest { LocalProductId = product.Id, ColorId = colorA.Id });

        Assert.True(result.Success, result.Message);
        Assert.Equal(0, result.VariantsCreated);
        Assert.Equal(1, result.VariantsUpdated);

        // Only one row for this SKU exists anywhere - the stale one, reparented in place.
        Assert.Equal(1, await db.ProductVariants.CountAsync(v => v.Sku == "SHP-7001"));
        var reloaded = await db.ProductVariants.SingleAsync(v => v.Id == staleVariant.Id);
        Assert.Equal(product.Id, reloaded.ProductId);
        Assert.Equal(colorA.Id, reloaded.ColorId);
        Assert.Equal(7001, reloaded.ShopifyVariantId);

        var stock = await db.StockItems.SingleAsync(s => s.ProductVariantId == staleVariant.Id);
        Assert.Equal(3, stock.QuantityOnHand);

        // The stale product it used to live under is now an empty shell - a genuine duplicate,
        // same as the pre-existing "800-lh" cleanup, not fresh data loss.
        Assert.Empty(await db.ProductVariants.Where(v => v.ProductId == staleProduct.Id).ToListAsync());
    }

    [Fact]
    public async Task LinkColorwayAsync_OrderAlreadyReferencingThisShopifyProduct_GetsItsItemRetroactivelyMatched()
    {
        // Reproduces the live report: an order arrived for "Zeggane Beige" before it was ever
        // linked, so its item sat with ProductVariantId null - shown as "produit non mappé au
        // catalogue local", no colour/size - even though the order itself was already Confirmed
        // (not stuck in InventoryConflict, so ImportCatalogFromShopifyAsync's rematch pass would
        // never have found it either).
        var shopifyProduct = MakeShopifyProduct(900, "Basket En Cuir Beige -Zeggane", (9001, "39", 5));
        var (service, db) = BuildService(new FakeShopifyApiClient([shopifyProduct]));
        var (product, colorA, _, _, _) = await SeedBaseDataAsync(db);

        var order = new OnlineOrder
        {
            OrderNumber = "SHP-TEST-004", Channel = OnlineOrderChannel.Shopify, Status = OrderStatus.Confirmed,
            PaymentStatus = OnlinePaymentStatus.Unpaid, PaymentMethod = OnlinePaymentMethod.COD,
            CustomerName = "Karim", TotalAmount = 449m, ShopifyOrderId = 555000,
            Items =
            [
                new OnlineOrderItem
                {
                    ShopifyProductId = 900, ShopifyVariantId = 9001, ShopifySku = null,
                    ProductNameSnapshot = "Basket  En Cuir Beige -Zeggane", SkuSnapshot = "",
                    Quantity = 1, UnitPrice = 449m, LineTotal = 449m
                }
            ]
        };
        db.Add(order);
        await db.SaveChangesAsync();

        var result = await service.LinkColorwayAsync(900, new LinkColorwayRequest { LocalProductId = product.Id, ColorId = colorA.Id });

        Assert.True(result.Success, result.Message);
        Assert.Contains("rattaché", result.Message);

        var reloadedItem = await db.OnlineOrderItems.SingleAsync(i => i.ShopifyVariantId == 9001);
        Assert.NotNull(reloadedItem.ProductVariantId);
        var matchedVariant = await db.ProductVariants.SingleAsync(v => v.Id == reloadedItem.ProductVariantId);
        Assert.Equal(colorA.Id, matchedVariant.ColorId);
        Assert.Equal(matchedVariant.Sku, reloadedItem.SkuSnapshot);
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
    public async Task LinkColorwayAsync_RelinkingToADifferentColourOnTheSameProduct_MovesTheLinkInsteadOfColliding()
    {
        // The user picked the wrong colour the first time and corrects it - same product, same
        // Shopify product, different local colour. Must move the link, not crash on the unique
        // ShopifyProductId index by trying to claim it on a second colourway simultaneously.
        var shopifyProduct = MakeShopifyProduct(450, "Basket En Cuir Vert -Zeggane", (4501, "39", 5));
        var (service, db) = BuildService(new FakeShopifyApiClient([shopifyProduct]));
        var (product, colorA, colorB, _, _) = await SeedBaseDataAsync(db);

        var first = await service.LinkColorwayAsync(450, new LinkColorwayRequest { LocalProductId = product.Id, ColorId = colorA.Id });
        Assert.True(first.Success, first.Message);

        var second = await service.LinkColorwayAsync(450, new LinkColorwayRequest { LocalProductId = product.Id, ColorId = colorB.Id });

        Assert.True(second.Success, second.Message);
        Assert.Equal(1, await db.ProductColorways.CountAsync(c => c.ShopifyProductId == 450));
        var colorway = await db.ProductColorways.SingleAsync(c => c.ShopifyProductId == 450);
        Assert.Equal(colorB.Id, colorway.ColorId);

        // The original colour's colourway survives locally, just unlinked from Shopify.
        var oldColorway = await db.ProductColorways.SingleAsync(c => c.ProductId == product.Id && c.ColorId == colorA.Id);
        Assert.Null(oldColorway.ShopifyProductId);
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
