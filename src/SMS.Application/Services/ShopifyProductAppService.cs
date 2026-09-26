using System.Net;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SMS.Application.Common;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class ShopifyProductAppService : IShopifyProductService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IShopifyApiClient? _shopifyClient;
    private readonly ILogger<ShopifyProductAppService> _logger;
    private readonly IShopifySyncService _syncService;
    private readonly IColorwayResolver _colorways;

    public ShopifyProductAppService(
        IUnitOfWork unitOfWork, ILogger<ShopifyProductAppService> logger, IShopifySyncService syncService,
        IColorwayResolver colorways, IShopifyApiClient? shopifyClient = null)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
        _syncService = syncService;
        _colorways = colorways;
        _shopifyClient = shopifyClient;
    }

    public async Task<ShopifyImportResultDto> ImportFromShopifyAsync(CancellationToken ct = default)
    {
        if (_shopifyClient is null)
            return new ShopifyImportResultDto { Configured = false };

        var shopifyProducts = await _shopifyClient.GetAllProductsAsync(ct);

        // Defensive de-dup: guards against any upstream pagination overlap returning the same variant twice.
        var seenVariantKeys = new HashSet<(long ProductId, long VariantId)>();
        var duplicatesSkipped = 0;

        var existingMappings = await _unitOfWork.Set<ShopifyProduct>().ToListAsync(ct);
        var existingByKey = existingMappings.ToDictionary(m => (m.ShopifyProductId, m.ShopifyVariantId));

        var localVariants = await _unitOfWork.Set<ProductVariant>()
            .Where(v => v.Sku != null && v.Sku != "")
            .ToListAsync(ct);
        var localBySku = localVariants
            .GroupBy(v => v.Sku!.Trim().ToUpperInvariant())
            .ToDictionary(g => g.Key, g => g.First());

        var result = new ShopifyImportResultDto();

        foreach (var product in shopifyProducts)
        {
            foreach (var variant in product.Variants)
            {
                var key = (product.Id, variant.Id);
                if (!seenVariantKeys.Add(key))
                {
                    duplicatesSkipped++;
                    continue;
                }

                result.TotalVariants++;
                var price = ShopifySyncAppService.ParseShopifyDecimal(variant.Price);

                if (existingByKey.TryGetValue(key, out var mapping))
                {
                    mapping.Title = product.Title;
                    mapping.Sku = variant.Sku;
                    mapping.Price = price;
                    mapping.ShopifyInventoryItemId = variant.InventoryItemId;
                    mapping.SyncedAt = DateTime.UtcNow;
                    result.Updated++;
                }
                else
                {
                    mapping = new ShopifyProduct
                    {
                        ShopifyProductId = product.Id,
                        ShopifyVariantId = variant.Id,
                        Title = product.Title,
                        Sku = variant.Sku,
                        Price = price,
                        ShopifyInventoryItemId = variant.InventoryItemId,
                        SyncedAt = DateTime.UtcNow
                    };

                    if (!string.IsNullOrWhiteSpace(variant.Sku) &&
                        localBySku.TryGetValue(variant.Sku.Trim().ToUpperInvariant(), out var localVariant))
                    {
                        mapping.LocalProductId = localVariant.ProductId;
                        result.AutoLinked++;
                    }

                    await _unitOfWork.AddAsync(mapping, ct);
                    existingByKey[key] = mapping;
                    result.Created++;
                }
            }
        }

        if (duplicatesSkipped > 0)
            _logger.LogWarning("Shopify product import: skipped {Count} duplicate variant entries returned by the API", duplicatesSkipped);

        await _unitOfWork.SaveChangesAsync(ct);
        return result;
    }

    private const int ImportBatchSize = 25;

    public async Task<ShopifyCatalogImportResultDto> ImportCatalogFromShopifyAsync(CancellationToken ct = default)
    {
        if (_shopifyClient is null)
            return new ShopifyCatalogImportResultDto { Configured = false };

        var shopifyProducts = await _shopifyClient.GetAllProductsAsync(ct);

        // Real merchant-defined categories: Shopify Collections (custom + smart), not the free-text
        // "product_type" field — most merchants (this one included) leave product_type blank and
        // organize their catalog via Collections instead. "Home page" / "Promotion" are marketing
        // groupings, not product categories, so they're excluded from category assignment.
        var excludedCollectionTitles = new HashSet<string> { "HOME PAGE", "PROMOTION" };
        var collections = await _shopifyClient.GetAllCollectionsAsync(ct);
        var collectionTitleById = collections
            .Where(c => !excludedCollectionTitles.Contains(c.Title.Trim().ToUpperInvariant()))
            .ToDictionary(c => c.Id, c => c.Title);
        var collects = await _shopifyClient.GetAllCollectsAsync(ct);
        var productToCollectionTitle = new Dictionary<long, string>();
        foreach (var collect in collects)
        {
            if (productToCollectionTitle.ContainsKey(collect.ProductId)) continue;
            if (collectionTitleById.TryGetValue(collect.CollectionId, out var title))
                productToCollectionTitle[collect.ProductId] = title;
        }

        // Reference data (colors/sizes/categories) is small (dozens of rows) and never mutated after
        // creation, so it's safe to keep these cached across ChangeTracker.Clear() calls below —
        // we only ever read their .Id, never re-save them once created.
        var colorCache = (await _unitOfWork.Set<Color>().AsNoTracking().ToListAsync(ct))
            .ToDictionary(c => c.Name.Trim().ToUpperInvariant());
        var sizeCache = (await _unitOfWork.Set<Size>().AsNoTracking().ToListAsync(ct))
            .ToDictionary(s => s.Value.Trim().ToUpperInvariant());
        var categoryCache = (await _unitOfWork.Set<Category>().AsNoTracking().ToListAsync(ct))
            .ToDictionary(c => c.Name.Trim().ToUpperInvariant());

        var result = new ShopifyCatalogImportResultDto();
        var defaultColor = await GetOrCreateColorAsync(colorCache, "Standard", result, ct);
        var defaultSize = await GetOrCreateSizeAsync(sizeCache, "Unique", result, ct);

        // Batch products and periodically clear the EF change tracker. Without this, the tracker
        // accumulates every Product/ProductVariant/StockItem touched across the whole run (thousands
        // of entities for a large catalog), making each SaveChangesAsync's DetectChanges scan slower
        // than the last — an O(n²) blowup that pegs CPU and made the import (and the app) hang.
        var seenProductIds = new HashSet<long>();
        var distinctProducts = shopifyProducts.Where(sp => seenProductIds.Add(sp.Id)).ToList();

        foreach (var batch in distinctProducts.Chunk(ImportBatchSize))
        {
            var batchProductIds = batch.Select(sp => sp.Id).ToHashSet();
            var batchVariantIds = batch.SelectMany(sp => sp.Variants.Select(v => v.Id)).ToHashSet();

            // The Shopify link lives on the colourway, so an already-imported Shopify product is
            // found by walking back up from its colourway to the owning product.
            var existingColorways = await _unitOfWork.Set<ProductColorway>()
                .Include(c => c.Product)
                .Where(c => c.ShopifyProductId != null && batchProductIds.Contains(c.ShopifyProductId.Value))
                .ToDictionaryAsync(c => c.ShopifyProductId!.Value, ct);
            var existingProducts = existingColorways.ToDictionary(kv => kv.Key, kv => kv.Value.Product);
            var existingVariants = await _unitOfWork.Set<ProductVariant>()
                .Include(v => v.StockItem)
                .Where(v => v.ShopifyVariantId != null && batchVariantIds.Contains(v.ShopifyVariantId.Value))
                .ToDictionaryAsync(v => v.ShopifyVariantId!.Value, ct);

            // Per-batch, and keyed on the Product instance rather than its Id: a product created
            // earlier in this batch has no Id until the batch saves. Rebuilt each batch because
            // ClearChangeTracker() below detaches everything it holds.
            var colorwayCache = new Dictionary<(Product Product, int ColorId), ProductColorway>();

            foreach (var sp in batch)
            {
                var categoryName = productToCollectionTitle.TryGetValue(sp.Id, out var collectionTitle)
                    ? collectionTitle
                    : string.IsNullOrWhiteSpace(sp.ProductType) ? "Shopify" : sp.ProductType.Trim();
                var category = await GetOrCreateCategoryAsync(categoryCache, categoryName, result, ct);

                var minPrice = sp.Variants.Count > 0
                    ? sp.Variants.Min(v => ShopifySyncAppService.ParseShopifyDecimal(v.Price))
                    : 0m;
                var imageUrl = sp.Image?.Src ?? sp.Images?.FirstOrDefault()?.Src;
                var description = StripHtml(sp.BodyHtml);
                var isActive = string.Equals(sp.Status, "active", StringComparison.OrdinalIgnoreCase);

                // Already linked to a colourway - by a prior import run, or by the manual "Association"
                // screen picking a product/colour combo the title wouldn't derive on its own - so that
                // colourway is authoritative for this Shopify product and must be reused as-is below,
                // never re-derived independently (which risks landing on a *different* colourway and
                // colliding on the unique ShopifyProductId index the moment both try to claim it).
                var linkedColorway = existingColorways.GetValueOrDefault(sp.Id);

                Product product;
                if (existingProducts.TryGetValue(sp.Id, out var foundProduct))
                {
                    product = foundProduct;
                    // Only keep syncing the product's name from Shopify's title while it's still a
                    // plain single-colourway product (the common case - auto-created by an earlier
                    // import, never touched since). The moment a second colourway is deliberately
                    // linked onto it (the manual "Association" screen consolidating several Shopify
                    // colour-products under one local product/name), the name becomes the user's to
                    // manage - re-syncing it would just have whichever colourway's title is processed
                    // last stomp the name every run, arbitrarily undoing the consolidation.
                    var hasOtherLinkedColorway = product.Id != 0 && await _unitOfWork.Set<ProductColorway>()
                        .AnyAsync(c => c.ProductId == product.Id && c.ShopifyProductId != null && c.ShopifyProductId != sp.Id, ct);
                    if (!hasOtherLinkedColorway) product.Name = sp.Title;
                    product.Description = description;
                    if (imageUrl is not null) product.ImageUrl = imageUrl;
                    product.Brand = sp.Vendor;
                    // Online price tracks the live Shopify price; the local (in-store) price is left
                    // untouched so it can be managed independently once set by staff.
                    if (minPrice > 0) product.OnlinePrice = minPrice;
                    product.CategoryId = category.Id;
                    product.IsActive = isActive;
                    product.UpdatedAt = DateTime.UtcNow;
                    result.ProductsUpdated++;
                }
                else
                {
                    product = new Product
                    {
                        Name = sp.Title,
                        Description = description,
                        ImageUrl = imageUrl,
                        Brand = sp.Vendor,
                        Price = minPrice,        // seed local price from Shopify (editable afterwards)
                        OnlinePrice = minPrice,  // online price tracks Shopify
                        CategoryId = category.Id,
                        IsActive = isActive
                    };
                    await _unitOfWork.AddAsync(product, ct);
                    result.ProductsCreated++;
                }

                var (colorOptionIndex, sizeOptionIndex) = DetermineOptionRoles(sp.Options);
                var imagesById = sp.Images?.ToDictionary(i => i.Id) ?? [];

                foreach (var sv in sp.Variants)
                {
                    var optionValues = new[] { sv.Option1, sv.Option2, sv.Option3 };
                    var sizeName = sizeOptionIndex.HasValue ? NullIfDefaultTitle(optionValues[sizeOptionIndex.Value]) : null;
                    var size = string.IsNullOrWhiteSpace(sizeName)
                        ? defaultSize
                        : await GetOrCreateSizeAsync(sizeCache, sizeName!, result, ct);

                    var variantImageUrl = sv.ImageId.HasValue && imagesById.TryGetValue(sv.ImageId.Value, out var img)
                        ? img.Src
                        : imageUrl;

                    // The colourway is what actually corresponds to this Shopify product, so it -
                    // not the local Product - carries the link, the storefront title and the price.
                    int colorId;
                    ProductColorway colorway;
                    if (linkedColorway is not null)
                    {
                        colorway = linkedColorway;
                        colorId = linkedColorway.ColorId;
                    }
                    else
                    {
                        // Shopify stamps "Default Title" on the single variant of a product with no
                        // real options defined — it's a placeholder, not a merchandising color value.
                        var colorName = colorOptionIndex.HasValue ? NullIfDefaultTitle(optionValues[colorOptionIndex.Value]) : null;
                        // This catalog has no Shopify color option at all (see ExtractColorFromTitle
                        // doc comment) - fall back to parsing it out of the product title before giving up.
                        colorName ??= ExtractColorFromTitle(sp.Title);
                        var color = string.IsNullOrWhiteSpace(colorName)
                            ? defaultColor
                            : await GetOrCreateColorAsync(colorCache, colorName!, result, ct);
                        colorway = await GetOrCreateColorwayAsync(colorwayCache, product, color, ct);
                        colorId = color.Id;
                    }
                    colorway.ShopifyProductId = sp.Id;
                    colorway.ShopifyTitle = sp.Title;
                    colorway.IsActive = isActive;
                    if (imageUrl is not null) colorway.ImageUrl = imageUrl;
                    if (minPrice > 0) colorway.OnlinePrice = minPrice;
                    colorway.UpdatedAt = DateTime.UtcNow;

                    ProductVariant variant;
                    StockItem? existingStockItem = null;
                    if (existingVariants.TryGetValue(sv.Id, out var foundVariant))
                    {
                        variant = foundVariant;
                        existingStockItem = variant.StockItem;
                        variant.Colorway = colorway;
                        variant.ColorId = colorId;
                        variant.SizeId = size.Id;
                        if (!string.IsNullOrWhiteSpace(sv.Sku)) variant.Sku = sv.Sku;
                        if (!string.IsNullOrWhiteSpace(sv.Barcode)) variant.Barcode = sv.Barcode;
                        if (variantImageUrl is not null) variant.ImageUrl = variantImageUrl;
                        variant.UpdatedAt = DateTime.UtcNow;
                        result.VariantsUpdated++;
                    }
                    else
                    {
                        variant = new ProductVariant
                        {
                            Product = product,
                            Colorway = colorway,
                            ColorId = colorId,
                            SizeId = size.Id,
                            Sku = !string.IsNullOrWhiteSpace(sv.Sku) ? sv.Sku : $"SHP-{sv.Id}",
                            Barcode = sv.Barcode,
                            ImageUrl = variantImageUrl,
                            ShopifyVariantId = sv.Id
                        };
                        await _unitOfWork.AddAsync(variant, ct);
                        result.VariantsCreated++;
                    }

                    var qty = Math.Max(sv.InventoryQuantity ?? 0, 0);
                    if (existingStockItem is not null)
                    {
                        existingStockItem.QuantityOnHand = qty;
                        existingStockItem.LastUpdatedAt = DateTime.UtcNow;
                    }
                    else
                    {
                        await _unitOfWork.AddAsync(new StockItem
                        {
                            ProductVariant = variant,
                            QuantityOnHand = qty,
                            ReorderLevel = 5,
                            LastUpdatedAt = DateTime.UtcNow
                        }, ct);
                    }
                }
            }

            await _unitOfWork.SaveChangesAsync(ct);
            _unitOfWork.ClearChangeTracker();
        }

        // Automatically generate scannable EAN-13 barcodes for any product/variant that still lacks one.
        result.BarcodesGenerated = await GenerateMissingBarcodesAsync(ct);

        // The catalog just grew, so retry any orders that were stuck in InventoryConflict because
        // their product didn't exist locally yet - this is exactly how the historical stuck orders
        // happened (catalog imported after the order arrived).
        var rematch = await _syncService.RematchConflictedOrdersAsync(ct);
        result.ConflictedOrdersResolved = rematch.OrdersResolved;

        return result;
    }

    // Backfills unique EAN-13 barcodes for products and variants without one (batched + tracker-cleared
    // to stay fast on the full ~500-product / ~2900-variant catalog).
    private async Task<int> GenerateMissingBarcodesAsync(CancellationToken ct)
    {
        var used = new HashSet<string>(
            (await _unitOfWork.Set<Product>().Where(p => p.Barcode != null && p.Barcode != "").Select(p => p.Barcode!).ToListAsync(ct))
            .Concat(await _unitOfWork.Set<ProductVariant>().Where(v => v.Barcode != null && v.Barcode != "").Select(v => v.Barcode!).ToListAsync(ct)));

        var count = 0;

        var productsMissing = await _unitOfWork.Set<Product>().Where(p => p.Barcode == null || p.Barcode == "").ToListAsync(ct);
        foreach (var chunk in productsMissing.Chunk(ImportBatchSize))
        {
            foreach (var p in chunk) { p.Barcode = BarcodeGenerator.GenerateEan13(used); p.UpdatedAt = DateTime.UtcNow; count++; }
            await _unitOfWork.SaveChangesAsync(ct);
            _unitOfWork.ClearChangeTracker();
        }

        var variantsMissing = await _unitOfWork.Set<ProductVariant>().Where(v => v.IsActive && (v.Barcode == null || v.Barcode == "")).ToListAsync(ct);
        foreach (var chunk in variantsMissing.Chunk(ImportBatchSize))
        {
            foreach (var v in chunk) { v.Barcode = BarcodeGenerator.GenerateEan13(used); v.UpdatedAt = DateTime.UtcNow; count++; }
            await _unitOfWork.SaveChangesAsync(ct);
            _unitOfWork.ClearChangeTracker();
        }

        return count;
    }

    // Resolves the (product x colour) colourway a variant hangs off, reusing one already created
    // in this batch, then one already in the database, and only then creating a new row. The
    // returned entity may still be pending insert - callers attach variants to it by navigation
    // rather than by Id, so EF fills in the composite FK when the batch saves.
    private async Task<ProductColorway> GetOrCreateColorwayAsync(
        Dictionary<(Product, int), ProductColorway> cache, Product product, Color color, CancellationToken ct)
    {
        if (cache.TryGetValue((product, color.Id), out var cached)) return cached;

        ProductColorway? colorway = null;
        if (product.Id != 0)
        {
            colorway = await _unitOfWork.Set<ProductColorway>()
                .FirstOrDefaultAsync(c => c.ProductId == product.Id && c.ColorId == color.Id, ct);
        }

        if (colorway is null)
        {
            colorway = new ProductColorway
            {
                Product = product,
                ColorId = color.Id,
                SortOrder = cache.Count(kv => kv.Key.Item1 == product),
                IsActive = true
            };
            await _unitOfWork.AddAsync(colorway, ct);
        }

        cache[(product, color.Id)] = colorway;
        return colorway;
    }

    private async Task<Color> GetOrCreateColorAsync(Dictionary<string, Color> cache, string name, ShopifyCatalogImportResultDto result, CancellationToken ct)
    {
        var key = name.Trim().ToUpperInvariant();
        if (cache.TryGetValue(key, out var existing)) return existing;

        var trimmedName = name.Trim();
        var color = new Color { Name = trimmedName.Length > 50 ? trimmedName[..50] : trimmedName, HexCode = "#6b7280", SortOrder = cache.Count + 1 };
        await _unitOfWork.AddAsync(color, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        cache[key] = color;
        result.ColorsCreated++;
        return color;
    }

    private async Task<Size> GetOrCreateSizeAsync(Dictionary<string, Size> cache, string value, ShopifyCatalogImportResultDto result, CancellationToken ct)
    {
        var key = value.Trim().ToUpperInvariant();
        if (cache.TryGetValue(key, out var existing)) return existing;

        var trimmedValue = value.Trim();
        var size = new Size { Value = trimmedValue.Length > 50 ? trimmedValue[..50] : trimmedValue, SortOrder = cache.Count + 1 };
        await _unitOfWork.AddAsync(size, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        cache[key] = size;
        result.SizesCreated++;
        return size;
    }

    private async Task<Category> GetOrCreateCategoryAsync(Dictionary<string, Category> cache, string name, ShopifyCatalogImportResultDto result, CancellationToken ct)
    {
        var key = name.Trim().ToUpperInvariant();
        if (cache.TryGetValue(key, out var existing)) return existing;

        var category = new Category { Name = name.Trim() };
        await _unitOfWork.AddAsync(category, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        cache[key] = category;
        result.CategoriesCreated++;
        return category;
    }

    private static (int? ColorIndex, int? SizeIndex) DetermineOptionRoles(List<ShopifyOptionItem>? options)
    {
        if (options is null || options.Count == 0) return (null, null);

        int? colorIndex = null;
        int? sizeIndex = null;

        for (var i = 0; i < options.Count; i++)
        {
            var name = options[i].Name.Trim().ToUpperInvariant();
            if (colorIndex is null && (name.Contains("COULEUR") || name.Contains("COLOR") || name.Contains("COLOUR")))
                colorIndex = i;
            else if (sizeIndex is null && (name.Contains("TAILLE") || name.Contains("POINTURE") || name.Contains("SIZE")))
                sizeIndex = i;
        }

        if (colorIndex is null && sizeIndex is null && options.Count == 1)
            sizeIndex = 0;

        return (colorIndex, sizeIndex);
    }

    private static string? NullIfDefaultTitle(string? value)
        => string.IsNullOrWhiteSpace(value) || value.Trim().Equals("Default Title", StringComparison.OrdinalIgnoreCase)
            ? null
            : value;

    // This store's Shopify catalog is one product per colorway (confirmed live: every product has
    // exactly one option, "Pointures"/size - color is never a Shopify option at all), so colorOptionIndex
    // is always null and every variant used to fall through to the "Standard" default color. The real
    // color lives in the product title instead (e.g. "Basket En Cuir Marron - Zeggane", "Bally - Derby
    // a pampilles en Cuir Noir") - this scans the title for a known color word/synonym (French, with
    // gender/plural variants and common typos seen in the live catalog, plus English equivalents) and
    // returns the matched canonical name(s) in reading order, or null if the title genuinely has none
    // (falls back to "Standard", which is correct for those).
    private static readonly (Regex Pattern, string Canonical)[] ColorTitleMatchers = BuildColorTitleMatchers();

    private static (Regex, string)[] BuildColorTitleMatchers()
    {
        var bySpecificity = new (string Canonical, string[] Synonyms)[]
        {
            ("Bleu Marine", ["bleu marine", "blue marine", "navy"]),
            ("Vert Foncé", ["vert foncé", "vert fonce"]),
            ("Noir", ["noir", "noire", "noirs", "noires", "black"]),
            ("Blanc", ["blanc", "blanche", "blancs", "blanches", "white"]),
            ("Bleu", ["bleu", "bleue", "bleus", "bleues", "blue"]),
            ("Marron", ["marron", "marrons", "maron", "brown"]),
            ("Beige", ["beige", "beiges"]),
            ("Gris", ["gris", "grise", "grises", "grey", "gray"]),
            ("Vert", ["vert", "verte", "verts", "vertes", "green"]),
            ("Tabac", ["tabac"]),
            ("Camel", ["camel"]),
            ("Cognac", ["cognac"]),
            ("Chocolat", ["chocolat"]),
            ("Rouge", ["rouge", "rouges", "red"]),
            ("Jaune", ["jaune", "jaunes", "yellow"]),
            ("Rose", ["rose", "roses", "pink"]),
            ("Orange", ["orange", "oranges"]),
            ("Violet", ["violet", "violette", "violettes", "purple"]),
            ("Doré", ["doré", "dore", "dorée", "doree", "gold", "golden"]),
            ("Argenté", ["argenté", "argente", "argentée", "argentee", "silver"]),
            ("Kaki", ["kaki"]),
            ("Bordeaux", ["bordeaux"]),
            ("Fauve", ["fauve"]),
        };

        var list = new List<(Regex, string)>();
        foreach (var (canonical, synonyms) in bySpecificity)
        {
            foreach (var syn in synonyms)
            {
                var escaped = Regex.Escape(syn).Replace(@"\ ", @"\s+");
                list.Add((new Regex($@"\b{escaped}\b", RegexOptions.IgnoreCase), canonical));
            }
        }

        // Longest synonym text first, so a compound ("bleu marine") is tried before its single-word
        // component ("bleu") when scanning left to right - otherwise "bleu" would win first and the
        // title would never be recognized as the more specific "Bleu Marine".
        return [.. list.OrderByDescending(x => x.Item1.ToString().Length)];
    }

    internal static string? ExtractColorFromTitle(string? title)
    {
        if (string.IsNullOrWhiteSpace(title)) return null;

        var found = new List<(int Index, int Length, string Canonical)>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var (pattern, canonical) in ColorTitleMatchers)
        {
            if (seen.Contains(canonical)) continue;
            var m = pattern.Match(title);
            if (!m.Success) continue;
            // Skip if this match overlaps a higher-priority match already accepted - e.g. once "Bleu
            // Marine" is accepted, its own leading word would otherwise also match plain "Bleu" at
            // the same span and wrongly produce "Bleu Marine / Bleu".
            if (found.Any(f => m.Index < f.Index + f.Length && f.Index < m.Index + m.Length)) continue;
            found.Add((m.Index, m.Length, canonical));
            seen.Add(canonical);
        }

        if (found.Count == 0) return null;

        // Preserve the order the colors actually appear in the title (e.g. "Marron & Vert" ->
        // "Marron / Vert"), not the priority order they were matched in.
        return string.Join(" / ", found.OrderBy(f => f.Index).Select(f => f.Canonical));
    }

    private static string? StripHtml(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return null;

        var text = Regex.Replace(html, "<[^>]+>", " ");
        text = WebUtility.HtmlDecode(text);
        text = Regex.Replace(text, @"\s+", " ").Trim();

        return text.Length == 0 ? null : text.Length > 1900 ? text[..1900] : text;
    }

    public async Task<IReadOnlyList<ShopifyProductMappingDto>> GetAllAsync(CancellationToken ct = default)
    {
        var mappings = await _unitOfWork.Set<ShopifyProduct>()
            .Include(sp => sp.LocalProduct)
            .OrderByDescending(sp => sp.SyncedAt)
            .ToListAsync(ct);

        // The real link, as opposed to the LocalProductId column above: keyed by ShopifyProductId
        // since that's what LinkColorwayAsync stamps on the colourway it created/reused.
        var colorwayByShopifyProductId = await _unitOfWork.Set<ProductColorway>()
            .Include(c => c.Product)
            .Include(c => c.Color)
            .Where(c => c.ShopifyProductId != null)
            .ToDictionaryAsync(c => c.ShopifyProductId!.Value, ct);

        return mappings.Select(sp => MapToDto(sp, colorwayByShopifyProductId.GetValueOrDefault(sp.ShopifyProductId))).ToList();
    }

    public async Task<ShopifyProductMappingDto> CreateAsync(CreateShopifyProductMappingRequest request, CancellationToken ct = default)
    {
        var mapping = new ShopifyProduct
        {
            ShopifyProductId = request.ShopifyProductId,
            ShopifyVariantId = request.ShopifyVariantId,
            Title = request.Title,
            Sku = request.Sku,
            Price = request.Price,
            LocalProductId = request.LocalProductId,
            SyncedAt = DateTime.UtcNow
        };

        await _unitOfWork.AddAsync(mapping, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        var local = request.LocalProductId.HasValue
            ? (await _unitOfWork.FindAsync<Product>(p => p.Id == request.LocalProductId.Value, ct)).FirstOrDefault()
            : null;
        mapping.LocalProduct = local;

        return MapToDto(mapping);
    }

    public async Task<ShopifyProductMappingDto?> LinkAsync(int id, LinkShopifyProductMappingRequest request, CancellationToken ct = default)
    {
        var mapping = await _unitOfWork.Set<ShopifyProduct>().Include(sp => sp.LocalProduct).FirstOrDefaultAsync(sp => sp.Id == id, ct);
        if (mapping is null) return null;

        mapping.LocalProductId = request.LocalProductId;
        await _unitOfWork.SaveChangesAsync(ct);

        mapping.LocalProduct = request.LocalProductId.HasValue
            ? (await _unitOfWork.FindAsync<Product>(p => p.Id == request.LocalProductId.Value, ct)).FirstOrDefault()
            : null;

        return MapToDto(mapping);
    }

    public async Task<int> LinkByShopifyProductAsync(long shopifyProductId, int? localProductId, CancellationToken ct = default)
    {
        var mappings = await _unitOfWork.Set<ShopifyProduct>()
            .Where(sp => sp.ShopifyProductId == shopifyProductId)
            .ToListAsync(ct);

        if (mappings.Count == 0) return 0;

        foreach (var mapping in mappings)
            mapping.LocalProductId = localProductId;

        await _unitOfWork.SaveChangesAsync(ct);
        return mappings.Count;
    }

    public async Task<LinkColorwayResultDto> LinkColorwayAsync(long shopifyProductId, LinkColorwayRequest request, CancellationToken ct = default)
    {
        if (_shopifyClient is null)
            return new LinkColorwayResultDto { Success = false, Message = "Shopify n'est pas configuré." };

        var productExists = await _unitOfWork.Set<Product>().AnyAsync(p => p.Id == request.LocalProductId, ct);
        if (!productExists)
            return new LinkColorwayResultDto { Success = false, Message = "Produit local introuvable." };

        var color = await _unitOfWork.Set<Color>().FirstOrDefaultAsync(c => c.Id == request.ColorId, ct);
        if (color is null)
            return new LinkColorwayResultDto { Success = false, Message = "Couleur introuvable." };

        // A Shopify product must not silently jump from one local product to another - that would
        // strand whatever local variants/stock it was already feeding.
        var existingLink = await _unitOfWork.Set<ProductColorway>()
            .FirstOrDefaultAsync(c => c.ShopifyProductId == shopifyProductId, ct);
        if (existingLink is not null && existingLink.ProductId != request.LocalProductId)
        {
            return new LinkColorwayResultDto
            {
                Success = false,
                Message = $"Ce produit Shopify est déjà lié à un autre produit local (#{existingLink.ProductId}). Déliez-le d'abord."
            };
        }
        if (existingLink is not null && existingLink.ColorId != request.ColorId)
        {
            // Same product, different colour: the user is correcting an earlier mismatch, not
            // creating a second link. Clear the old colourway's link first so it can't collide with
            // the new one on the unique ShopifyProductId index - GetOrCreateAsync below then either
            // reuses or creates the newly-chosen colourway cleanly.
            await UnlinkColorwayAsync(shopifyProductId, ct);
        }

        List<ShopifyProductItem> allProducts;
        try
        {
            allProducts = await _shopifyClient.GetAllProductsAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch Shopify catalog while linking product {ShopifyProductId} to colourway", shopifyProductId);
            return new LinkColorwayResultDto { Success = false, Message = "Impossible de joindre Shopify." };
        }

        var sp = allProducts.FirstOrDefault(p => p.Id == shopifyProductId);
        if (sp is null)
            return new LinkColorwayResultDto { Success = false, Message = $"Produit Shopify {shopifyProductId} introuvable." };

        var colorway = await _colorways.GetOrCreateAsync(request.LocalProductId, request.ColorId, ct);

        var minPrice = sp.Variants.Count > 0
            ? sp.Variants.Min(v => ShopifySyncAppService.ParseShopifyDecimal(v.Price))
            : 0m;
        var imageUrl = sp.Image?.Src ?? sp.Images?.FirstOrDefault()?.Src;

        colorway.ShopifyProductId = sp.Id;
        colorway.ShopifyTitle = sp.Title;
        colorway.IsActive = string.Equals(sp.Status, "active", StringComparison.OrdinalIgnoreCase);
        if (imageUrl is not null) colorway.ImageUrl = imageUrl;
        if (minPrice > 0) colorway.OnlinePrice = minPrice;
        colorway.UpdatedAt = DateTime.UtcNow;

        var sizeCache = (await _unitOfWork.Set<Size>().AsNoTracking().ToListAsync(ct))
            .ToDictionary(s => s.Value.Trim().ToUpperInvariant());
        var scratchResult = new ShopifyCatalogImportResultDto();
        var (_, sizeOptionIndex) = DetermineOptionRoles(sp.Options);
        var imagesById = sp.Images?.ToDictionary(i => i.Id) ?? [];

        var existingLocalVariants = await _unitOfWork.Set<ProductVariant>()
            .Include(v => v.StockItem)
            .Where(v => v.ColorwayId == colorway.Id)
            .ToDictionaryAsync(v => v.SizeId, ct);

        // A local barcode is what's physically printed and stuck on the stock, so linking to
        // Shopify must never overwrite one that already exists - only fill the gap when it's
        // missing, and if Shopify has nothing either, mint a fresh scannable EAN-13 immediately
        // rather than leaving the variant unscannable until someone runs a separate catalog-wide
        // "generate missing barcodes" sweep.
        var usedBarcodes = new HashSet<string>(
            await _unitOfWork.Set<ProductVariant>().AsNoTracking()
                .Where(v => v.Barcode != null && v.Barcode != "")
                .Select(v => v.Barcode!)
                .ToListAsync(ct));
        string ResolveBarcode(string? localBarcode, string? shopifyBarcode) =>
            !string.IsNullOrWhiteSpace(localBarcode) ? localBarcode
            : !string.IsNullOrWhiteSpace(shopifyBarcode) ? shopifyBarcode
            : BarcodeGenerator.GenerateEan13(usedBarcodes);

        var conflicts = new List<string>();
        var created = 0;
        var updated = 0;

        foreach (var sv in sp.Variants)
        {
            // Guard: this Shopify variant already belongs to a different local variant. Skip it and
            // report it rather than silently stealing the link out from under that other product -
            // mirrors ShopifyLinkService.LinkAsync's same check at the single-variant level.
            var conflictingVariant = await _unitOfWork.Set<ProductVariant>()
                .AsNoTracking()
                .FirstOrDefaultAsync(v => v.ShopifyVariantId == sv.Id && v.ColorwayId != colorway.Id, ct);
            if (conflictingVariant is not null)
            {
                conflicts.Add($"Taille {sv.Option1 ?? sv.Id.ToString()} déjà liée à la variante locale #{conflictingVariant.Id}.");
                continue;
            }

            var sizeText = sizeOptionIndex.HasValue
                ? NullIfDefaultTitle(new[] { sv.Option1, sv.Option2, sv.Option3 }[sizeOptionIndex.Value])
                : NullIfDefaultTitle(sv.Option1);
            var size = string.IsNullOrWhiteSpace(sizeText)
                ? await GetOrCreateSizeAsync(sizeCache, "Unique", scratchResult, ct)
                : await GetOrCreateSizeAsync(sizeCache, sizeText!, scratchResult, ct);

            var variantImageUrl = sv.ImageId.HasValue && imagesById.TryGetValue(sv.ImageId.Value, out var img)
                ? img.Src
                : imageUrl;
            var qty = Math.Max(sv.InventoryQuantity ?? 0, 0);

            if (existingLocalVariants.TryGetValue(size.Id, out var variant))
            {
                // Sku is deliberately left untouched here, unlike ImportCatalogFromShopifyAsync's
                // equivalent branch: reusing an existing local variant means a human already
                // created it by hand under this exact product/colour/size, and its SKU is more
                // likely to be an intentional in-store code than something to overwrite.
                variant.ShopifyVariantId = sv.Id;
                variant.Barcode = ResolveBarcode(variant.Barcode, sv.Barcode);
                usedBarcodes.Add(variant.Barcode);
                if (variantImageUrl is not null) variant.ImageUrl = variantImageUrl;
                variant.UpdatedAt = DateTime.UtcNow;
                updated++;

                if (variant.StockItem is not null)
                {
                    variant.StockItem.QuantityOnHand = qty;
                    variant.StockItem.LastUpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    await _unitOfWork.AddAsync(new StockItem
                    {
                        ProductVariantId = variant.Id,
                        QuantityOnHand = qty,
                        ReorderLevel = 5,
                        LastUpdatedAt = DateTime.UtcNow
                    }, ct);
                }
            }
            else
            {
                // Sku is unique across ALL variants store-wide, not just this colourway. Look for a
                // variant already sitting on the SKU we'd otherwise assign - either Shopify's own SKU,
                // or our deterministic SHP-{id} placeholder (the fallback below, and the old bulk
                // importer before it, both derive it the same way, so a stale unlinked row from a
                // prior import can genuinely hold it).
                var candidateSku = !string.IsNullOrWhiteSpace(sv.Sku) ? sv.Sku : $"SHP-{sv.Id}";
                var placeholderSku = $"SHP-{sv.Id}";
                var clashingVariant = await _unitOfWork.Set<ProductVariant>()
                    .Include(v => v.StockItem)
                    .FirstOrDefaultAsync(v => v.Sku == candidateSku || v.Sku == placeholderSku, ct);

                if (clashingVariant is not null && clashingVariant.ShopifyVariantId is null)
                {
                    // Same physical item, previously imported under the old per-colour product model
                    // and since unlinked (ShopifyVariantId cleared but the row - and its stock - never
                    // deleted). Reparent it into the newly chosen colourway rather than creating a
                    // duplicate that would collide on this exact SKU; this also preserves any sale
                    // history already pointing at this variant's id.
                    clashingVariant.ProductId = request.LocalProductId;
                    clashingVariant.ColorId = request.ColorId;
                    clashingVariant.ColorwayId = colorway.Id;
                    clashingVariant.SizeId = size.Id;
                    clashingVariant.ShopifyVariantId = sv.Id;
                    clashingVariant.Barcode = ResolveBarcode(clashingVariant.Barcode, sv.Barcode);
                    usedBarcodes.Add(clashingVariant.Barcode);
                    if (variantImageUrl is not null) clashingVariant.ImageUrl = variantImageUrl;
                    clashingVariant.UpdatedAt = DateTime.UtcNow;
                    updated++;

                    if (clashingVariant.StockItem is not null)
                    {
                        clashingVariant.StockItem.QuantityOnHand = qty;
                        clashingVariant.StockItem.LastUpdatedAt = DateTime.UtcNow;
                    }
                    else
                    {
                        await _unitOfWork.AddAsync(new StockItem
                        {
                            ProductVariantId = clashingVariant.Id,
                            QuantityOnHand = qty,
                            ReorderLevel = 5,
                            LastUpdatedAt = DateTime.UtcNow
                        }, ct);
                    }
                }
                else
                {
                    // Taken by a variant actively linked elsewhere (a genuine, unrelated SKU
                    // collision) - fall back to a SKU that is guaranteed free instead of colliding
                    // on the unique index.
                    var finalSku = candidateSku;
                    if (clashingVariant is not null)
                    {
                        var suffix = 2;
                        finalSku = placeholderSku;
                        while (await _unitOfWork.Set<ProductVariant>().AsNoTracking().AnyAsync(v => v.Sku == finalSku, ct))
                            finalSku = $"{placeholderSku}-{suffix++}";
                    }

                    var newBarcode = ResolveBarcode(null, sv.Barcode);
                    usedBarcodes.Add(newBarcode);
                    var newVariant = new ProductVariant
                    {
                        ProductId = request.LocalProductId,
                        ColorId = request.ColorId,
                        ColorwayId = colorway.Id,
                        SizeId = size.Id,
                        Sku = finalSku,
                        Barcode = newBarcode,
                        ImageUrl = variantImageUrl,
                        ShopifyVariantId = sv.Id,
                        IsActive = true
                    };
                    await _unitOfWork.AddAsync(newVariant, ct);
                    created++;

                    await _unitOfWork.AddAsync(new StockItem
                    {
                        ProductVariant = newVariant,
                        QuantityOnHand = qty,
                        ReorderLevel = 5,
                        LastUpdatedAt = DateTime.UtcNow
                    }, ct);
                }
            }
        }

        // Keep the legacy mapping table in sync too, so it doesn't drift from the real link above -
        // some older tooling still reads LocalProductId for display purposes.
        var legacyMappings = await _unitOfWork.Set<ShopifyProduct>()
            .Where(m => m.ShopifyProductId == shopifyProductId)
            .ToListAsync(ct);
        foreach (var mapping in legacyMappings)
            mapping.LocalProductId = request.LocalProductId;

        await _unitOfWork.SaveChangesAsync(ct);

        // Any order that arrived referencing this Shopify product before it was linked has its
        // items sitting unresolved (ProductVariantId null - shown as "produit non mappé au
        // catalogue local" in the order detail, with no colour/size). Now that every size just got
        // a real local variant, patch those items in directly rather than requiring a separate full
        // catalog re-import: ImportCatalogFromShopifyAsync's own rematch only scans orders stuck in
        // InventoryConflict status, which an already-Confirmed order with an unmapped line isn't.
        var unresolvedOrderItems = await _unitOfWork.Set<OnlineOrderItem>()
            .Where(i => i.ShopifyProductId == shopifyProductId && i.ProductVariantId == null)
            .ToListAsync(ct);
        var ordersItemsMatched = 0;
        if (unresolvedOrderItems.Count > 0)
        {
            var variantsByShopifyId = await _unitOfWork.Set<ProductVariant>()
                .Where(v => v.ColorwayId == colorway.Id && v.ShopifyVariantId != null)
                .ToDictionaryAsync(v => v.ShopifyVariantId!.Value, ct);
            foreach (var item in unresolvedOrderItems)
            {
                if (item.ShopifyVariantId.HasValue && variantsByShopifyId.TryGetValue(item.ShopifyVariantId.Value, out var matchedVariant))
                {
                    item.ProductVariantId = matchedVariant.Id;
                    item.SkuSnapshot = matchedVariant.Sku;
                    ordersItemsMatched++;
                }
            }
            if (ordersItemsMatched > 0) await _unitOfWork.SaveChangesAsync(ct);
        }

        var message = $"{created} taille(s) créée(s), {updated} mise(s) à jour.";
        if (conflicts.Count > 0)
            message += $" {conflicts.Count} ignorée(s) - déjà liée(s) ailleurs.";
        if (ordersItemsMatched > 0)
            message += $" {ordersItemsMatched} article(s) de commande rattaché(s) rétroactivement.";

        return new LinkColorwayResultDto
        {
            Success = true,
            Message = message,
            VariantsCreated = created,
            VariantsUpdated = updated,
            ColorwayId = colorway.Id
        };
    }

    public async Task<bool> UnlinkColorwayAsync(long shopifyProductId, CancellationToken ct = default)
    {
        var colorway = await _unitOfWork.Set<ProductColorway>()
            .FirstOrDefaultAsync(c => c.ShopifyProductId == shopifyProductId, ct);
        if (colorway is null) return false;

        colorway.ShopifyProductId = null;
        colorway.ShopifyTitle = null;
        colorway.UpdatedAt = DateTime.UtcNow;

        var variants = await _unitOfWork.Set<ProductVariant>()
            .Where(v => v.ColorwayId == colorway.Id && v.ShopifyVariantId != null)
            .ToListAsync(ct);
        foreach (var variant in variants)
        {
            variant.ShopifyVariantId = null;
            variant.UpdatedAt = DateTime.UtcNow;
        }

        var legacyMappings = await _unitOfWork.Set<ShopifyProduct>()
            .Where(m => m.ShopifyProductId == shopifyProductId)
            .ToListAsync(ct);
        foreach (var mapping in legacyMappings)
            mapping.LocalProductId = null;

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<int> DeleteByShopifyProductAsync(long shopifyProductId, CancellationToken ct = default)
    {
        var mappings = await _unitOfWork.Set<ShopifyProduct>()
            .Where(sp => sp.ShopifyProductId == shopifyProductId)
            .ToListAsync(ct);

        if (mappings.Count == 0) return 0;

        foreach (var mapping in mappings)
            _unitOfWork.Remove(mapping);

        await _unitOfWork.SaveChangesAsync(ct);
        return mappings.Count;
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        var mapping = (await _unitOfWork.FindAsync<ShopifyProduct>(sp => sp.Id == id, ct)).FirstOrDefault();
        if (mapping is null) return false;

        _unitOfWork.Remove(mapping);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    private static ShopifyProductMappingDto MapToDto(ShopifyProduct sp, ProductColorway? linkedColorway = null) => new()
    {
        Id = sp.Id,
        ShopifyProductId = sp.ShopifyProductId,
        ShopifyVariantId = sp.ShopifyVariantId,
        Title = sp.Title,
        Sku = sp.Sku,
        Price = sp.Price,
        LocalProductId = sp.LocalProductId,
        LocalProductName = sp.LocalProduct?.Name,
        LocalPrice = sp.LocalProduct?.OnlinePrice ?? sp.LocalProduct?.Price,
        PriceMismatch = sp.LocalProduct is not null && (sp.LocalProduct.OnlinePrice ?? sp.LocalProduct.Price) != sp.Price,
        SyncedAt = sp.SyncedAt,
        LinkedColorwayId = linkedColorway?.Id,
        LinkedProductId = linkedColorway?.ProductId,
        LinkedProductName = linkedColorway?.Product?.Name,
        LinkedColorId = linkedColorway?.ColorId,
        LinkedColorName = linkedColorway?.Color?.Name
    };
}
