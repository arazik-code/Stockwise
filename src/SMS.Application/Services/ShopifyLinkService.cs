using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class ShopifyLinkService : IShopifyLinkService
{
    private const string CatalogCacheKey = "shopify:catalog:variants";
    private static readonly TimeSpan CatalogCacheTtl = TimeSpan.FromMinutes(10);

    private readonly IUnitOfWork _unitOfWork;
    private readonly IShopifyInventoryPusher _pusher;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ShopifyLinkService> _logger;
    private readonly IShopifyApiClient? _client;

    public ShopifyLinkService(
        IUnitOfWork unitOfWork,
        IShopifyInventoryPusher pusher,
        IMemoryCache cache,
        ILogger<ShopifyLinkService> logger,
        IShopifyApiClient? client = null)
    {
        _unitOfWork = unitOfWork;
        _pusher = pusher;
        _cache = cache;
        _logger = logger;
        _client = client;
    }

    public async Task<IReadOnlyList<UnlinkedVariantDto>> GetUnlinkedVariantsAsync(CancellationToken ct = default)
    {
        var rows = await _unitOfWork.Set<ProductVariant>()
            .AsNoTracking()
            .Where(v => (v.ShopifyVariantId == null || v.ShopifyVariantId == 0)
                && v.IsActive && v.Product.IsActive)
            .Select(v => new
            {
                v.Id,
                v.ProductId,
                ProductName = v.Product.Name,
                ColorName = v.Color != null ? v.Color.Name : null,
                SizeValue = v.Size != null ? v.Size.Value : null,
                v.Sku,
                v.Barcode,
                Qty = v.StockItem != null ? v.StockItem.QuantityOnHand : 0
            })
            .OrderBy(v => v.ProductName).ThenBy(v => v.SizeValue)
            .ToListAsync(ct);

        return rows
            .Select(r => new UnlinkedVariantDto(r.Id, r.ProductId, r.ProductName, r.ColorName, r.SizeValue, r.Sku, r.Barcode, r.Qty))
            .ToList();
    }

    public async Task<IReadOnlyList<ShopifyVariantCandidateDto>> SearchShopifyVariantsAsync(
        string? query, int limit = 50, CancellationToken ct = default)
    {
        var catalog = await GetCatalogAsync(ct);
        if (catalog.Count == 0) return [];

        IEnumerable<CatalogEntry> matches = catalog;

        if (!string.IsNullOrWhiteSpace(query))
        {
            var q = query.Trim().ToLowerInvariant();
            matches = catalog.Where(e =>
                e.ProductTitle.ToLowerInvariant().Contains(q) ||
                (e.VariantTitle?.ToLowerInvariant().Contains(q) ?? false) ||
                (e.Sku?.ToLowerInvariant().Contains(q) ?? false) ||
                (e.Barcode?.ToLowerInvariant().Contains(q) ?? false) ||
                e.ShopifyVariantId.ToString().Contains(q));
        }

        var page = matches.Take(limit).ToList();
        return await DecorateWithLinkStateAsync(page, ct);
    }

    public async Task<IReadOnlyList<ShopifyVariantCandidateDto>> SuggestForVariantAsync(
        int productVariantId, CancellationToken ct = default)
    {
        var variant = await _unitOfWork.Set<ProductVariant>()
            .AsNoTracking()
            .Include(v => v.Product)
            .Include(v => v.Size)
            .FirstOrDefaultAsync(v => v.Id == productVariantId, ct);

        if (variant is null) return [];

        var catalog = await GetCatalogAsync(ct);
        if (catalog.Count == 0) return [];

        var scored = new List<(CatalogEntry Entry, int Score, string Reason)>();

        var localBarcode = Normalize(variant.Barcode);
        var localBarcodeDigits = NormalizeDigits(variant.Barcode);
        var localSku = Normalize(variant.Sku);
        var localSkuIsPlaceholder = IsPlaceholderSku(variant.Sku);
        var localName = Normalize(variant.Product?.Name);
        var localSize = Normalize(variant.Size?.Value);

        foreach (var e in catalog)
        {
            var entryBarcode = Normalize(e.Barcode);
            var entryBarcodeDigits = NormalizeDigits(e.Barcode);
            var entrySku = Normalize(e.Sku);

            // Highest-confidence signals first: a shared barcode or SKU is an exact identity match.
            if (localBarcode is not null && entryBarcode == localBarcode)
            { scored.Add((e, 100, "Code-barres identique")); continue; }

            // Same digits but different formatting (spaces, dashes, a UPC-A vs EAN-13 leading zero) -
            // still the same physical product, just typed/exported differently. Guarded to 8+ digits
            // so short numeric SKUs never collide on this tier.
            if (localBarcodeDigits is { Length: >= 8 } && entryBarcodeDigits == localBarcodeDigits)
            { scored.Add((e, 97, "Code-barres identique (formatage different)")); continue; }

            if (localSku is not null && entrySku == localSku)
            { scored.Add((e, 95, "SKU identique")); continue; }

            // The catalog importer names local SKUs "SHP-<shopifyVariantId>", so that prefix is a
            // direct pointer back at the Shopify variant it came from.
            if (variant.Sku.StartsWith("SHP-", StringComparison.OrdinalIgnoreCase) &&
                variant.Sku[4..] == e.ShopifyVariantId.ToString())
            { scored.Add((e, 90, "SKU refere l'ID Shopify")); continue; }

            if (localName is not null)
            {
                var entryName = Normalize(e.ProductTitle);
                var sameName = entryName is not null && (entryName == localName || entryName.Contains(localName) || localName.Contains(entryName));
                if (sameName)
                {
                    var sameSize = localSize is not null && Normalize(e.VariantTitle) == localSize;
                    scored.Add((e, sameSize ? 70 : 40, sameSize ? "Nom + taille correspondants" : "Nom similaire"));
                    continue;
                }
            }

            // A likely typo rather than a different product: real (non-placeholder) SKUs of similar
            // length that differ by only 1-2 characters. Placeholder SKUs are excluded because two
            // "SHP-1001"/"SHP-1002" style codes can be 1 edit apart while pointing at unrelated variants.
            if (!localSkuIsPlaceholder && localSku is { Length: >= 4 } && entrySku is { Length: >= 4 } &&
                !IsPlaceholderSku(e.Sku) && Math.Abs(localSku.Length - entrySku.Length) <= 2)
            {
                var distance = LevenshteinDistance(localSku, entrySku);
                if (distance is >= 1 and <= 2)
                { scored.Add((e, 60, "SKU proche (ecart mineur)")); }
            }
        }

        var top = scored
            .OrderByDescending(s => s.Score)
            .Take(25)
            .ToList();

        var decorated = await DecorateWithLinkStateAsync(top.Select(t => t.Entry).ToList(), ct);

        return decorated
            .Select((d, i) => d with { MatchReason = top[i].Reason })
            .ToList();
    }

    public async Task<LinkVariantResultDto> LinkAsync(int productVariantId, long shopifyVariantId, CancellationToken ct = default)
    {
        if (_client is null)
            return new(false, "Shopify n'est pas configure.", productVariantId);

        if (shopifyVariantId <= 0)
            return new(false, "Identifiant de variante Shopify invalide.", productVariantId);

        var variant = await _unitOfWork.Set<ProductVariant>()
            .FirstOrDefaultAsync(v => v.Id == productVariantId, ct);

        if (variant is null)
            return new(false, "Variante locale introuvable.", productVariantId);

        // Uniqueness: one Shopify variant may back exactly one local variant. Without this, two
        // local variants would both push their own stock onto the same Shopify item and the last
        // sale would win at random.
        var conflicting = await _unitOfWork.Set<ProductVariant>()
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.ShopifyVariantId == shopifyVariantId && v.Id != productVariantId, ct);

        if (conflicting is not null)
            return new(false,
                $"Cette variante Shopify est deja liee a la variante locale #{conflicting.Id} ({conflicting.Sku}). Deliez-la d'abord.",
                productVariantId);

        // Verify the variant really exists on Shopify before storing the link, and capture its
        // inventory_item_id in the same call - that id is what the stock push actually needs.
        ShopifyVariantItem? remote;
        try
        {
            remote = await _client.GetVariantAsync(shopifyVariantId, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to verify Shopify variant {ShopifyVariantId} during manual link", shopifyVariantId);
            return new(false, "Impossible de joindre Shopify pour verifier cette variante.", productVariantId);
        }

        if (remote is null)
            return new(false, $"La variante {shopifyVariantId} est introuvable sur Shopify.", productVariantId);

        // Give the two sides of the link one shared, unique SKU rather than leaving them to drift -
        // a linked pair with different SKUs is confusing to reconcile by hand later and defeats the
        // point of the link being the single source of truth for this item.
        var sharedSku = await DetermineSharedSkuAsync(variant, remote.Sku, variant.Id, ct);
        var skuNeedsShopifyPush = !string.Equals(remote.Sku?.Trim(), sharedSku, StringComparison.Ordinal);

        variant.Sku = sharedSku;
        variant.ShopifyVariantId = shopifyVariantId;
        variant.UpdatedAt = DateTime.UtcNow;

        await UpsertMappingAsync(shopifyVariantId, remote, sharedSku, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        _cache.Remove(CatalogCacheKey);

        if (skuNeedsShopifyPush)
        {
            var skuPushed = await _client.UpdateVariantSkuAsync(shopifyVariantId, sharedSku, ct);
            if (!skuPushed)
                _logger.LogWarning("Failed to push shared SKU {Sku} to Shopify variant {ShopifyVariantId}", sharedSku, shopifyVariantId);
        }

        // Push immediately so the link is provably working rather than "probably working" -
        // the user sees the Shopify quantity change the moment they link.
        var push = await _pusher.PushVariantAsync(productVariantId, ct);

        return new(
            push.Success,
            push.Success
                ? $"Variante liee (SKU unifie {sharedSku}) et stock Shopify synchronise."
                : $"Variante liee (SKU unifie {sharedSku}), mais la synchronisation du stock a echoue : {push.Message}",
            productVariantId,
            shopifyVariantId,
            push.InventoryItemId ?? remote.InventoryItemId,
            push.QuantityPushed,
            sharedSku);
    }

    public async Task<LinkVariantResultDto> UnlinkAsync(int productVariantId, CancellationToken ct = default)
    {
        var variant = await _unitOfWork.Set<ProductVariant>()
            .FirstOrDefaultAsync(v => v.Id == productVariantId, ct);

        if (variant is null)
            return new(false, "Variante locale introuvable.", productVariantId);

        variant.ShopifyVariantId = null;
        variant.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);

        return new(true, "Lien Shopify supprime. Le stock de cette variante ne sera plus synchronise.", productVariantId);
    }

    public async Task<AutoLinkResultDto> AutoLinkAsync(CancellationToken ct = default)
    {
        var details = new List<string>();
        int linked = 0, ambiguous = 0, noMatch = 0;

        var unlinked = await _unitOfWork.Set<ProductVariant>()
            .Where(v => v.ShopifyVariantId == null || v.ShopifyVariantId == 0)
            .ToListAsync(ct);

        if (unlinked.Count == 0)
            return new(0, 0, 0, ["Aucune variante non liee."]);

        var catalog = await GetCatalogAsync(ct);
        if (catalog.Count == 0)
            return new(0, 0, 0, ["Catalogue Shopify indisponible."]);

        var taken = (await _unitOfWork.Set<ProductVariant>()
                .AsNoTracking()
                .Where(v => v.ShopifyVariantId != null && v.ShopifyVariantId != 0)
                .Select(v => v.ShopifyVariantId!.Value)
                .ToListAsync(ct))
            .ToHashSet();

        foreach (var variant in unlinked)
        {
            var localBarcode = Normalize(variant.Barcode);
            var localBarcodeDigits = NormalizeDigits(variant.Barcode);
            var localSku = Normalize(variant.Sku);
            var selfReferenceId = variant.Sku.StartsWith("SHP-", StringComparison.OrdinalIgnoreCase)
                ? variant.Sku[4..]
                : null;

            // Only exact-identity signals are allowed to link automatically. Fuzzy name/SKU matches
            // are left for a human to confirm - silently mislinking two products would corrupt stock
            // on the storefront, which is far worse than leaving a row for someone to click.
            var candidates = catalog.Where(e =>
                    !taken.Contains(e.ShopifyVariantId) &&
                    ((localBarcode is not null && Normalize(e.Barcode) == localBarcode) ||
                     (localBarcodeDigits is { Length: >= 8 } && NormalizeDigits(e.Barcode) == localBarcodeDigits) ||
                     (localSku is not null && Normalize(e.Sku) == localSku) ||
                     (selfReferenceId is not null && selfReferenceId == e.ShopifyVariantId.ToString())))
                .ToList();

            if (candidates.Count == 0) { noMatch++; continue; }

            if (candidates.Count > 1)
            {
                ambiguous++;
                details.Add($"{variant.Sku}: {candidates.Count} correspondances Shopify - a confirmer manuellement.");
                continue;
            }

            var match = candidates[0];
            variant.ShopifyVariantId = match.ShopifyVariantId;
            variant.UpdatedAt = DateTime.UtcNow;
            taken.Add(match.ShopifyVariantId);

            await UpsertMappingAsync(match.ShopifyVariantId,
                new ShopifyVariantItem(match.ShopifyVariantId, match.Sku ?? string.Empty, match.Price.ToString(),
                    match.InventoryItemId, match.Barcode), ct);

            linked++;
            details.Add($"{variant.Sku} -> Shopify {match.ShopifyVariantId} ({match.ProductTitle}).");
        }

        if (linked > 0)
        {
            await _unitOfWork.SaveChangesAsync(ct);
            _cache.Remove(CatalogCacheKey);
        }

        return new(linked, ambiguous, noMatch, details);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private async Task UpsertMappingAsync(long shopifyVariantId, ShopifyVariantItem remote, CancellationToken ct)
        => await UpsertMappingAsync(shopifyVariantId, remote, null, ct);

    private async Task UpsertMappingAsync(long shopifyVariantId, ShopifyVariantItem remote, string? skuOverride, CancellationToken ct)
    {
        var sku = skuOverride ?? remote.Sku;
        var mapping = await _unitOfWork.Set<ShopifyProduct>()
            .FirstOrDefaultAsync(sp => sp.ShopifyVariantId == shopifyVariantId, ct);

        if (mapping is null)
        {
            await _unitOfWork.AddAsync(new ShopifyProduct
            {
                ShopifyProductId = 0,
                ShopifyVariantId = shopifyVariantId,
                Title = sku ?? string.Empty,
                Sku = sku,
                ShopifyInventoryItemId = remote.InventoryItemId,
                SyncedAt = DateTime.UtcNow
            }, ct);
        }
        else
        {
            mapping.Sku = sku;
            mapping.ShopifyInventoryItemId = remote.InventoryItemId;
            mapping.SyncedAt = DateTime.UtcNow;
        }
    }

    // Chooses one SKU to apply to both the local variant and the Shopify variant being linked. A
    // real (non-placeholder) local SKU wins - it's more likely to be a merchant/POS-assigned code
    // than the importer's "SHP-<id>" filler. Otherwise fall back to Shopify's own SKU, and only
    // generate a fresh one if neither side has anything meaningful. Always re-checked against the
    // unique index so the shared SKU can never collide with an unrelated variant.
    private async Task<string> DetermineSharedSkuAsync(ProductVariant variant, string? remoteSku, int excludeVariantId, CancellationToken ct)
    {
        var localSku = variant.Sku?.Trim();
        var remote = remoteSku?.Trim();

        var candidate = !IsPlaceholderSku(localSku)
            ? localSku!
            : !string.IsNullOrWhiteSpace(remote)
                ? remote!
                : $"PRD-{variant.ProductId}-{variant.Id}";

        if (candidate.Length > 50) candidate = candidate[..50];

        var collides = await _unitOfWork.Set<ProductVariant>()
            .AsNoTracking()
            .AnyAsync(v => v.Id != excludeVariantId && v.Sku == candidate, ct);

        if (!collides) return candidate;

        var suffixed = $"{candidate}-{excludeVariantId}";
        return suffixed.Length > 50 ? suffixed[^50..] : suffixed;
    }

    private static bool IsPlaceholderSku(string? sku)
        => string.IsNullOrWhiteSpace(sku) || Regex.IsMatch(sku.Trim(), @"^SHP-\d+$", RegexOptions.IgnoreCase);

    private static string? NormalizeDigits(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var digits = new string(value.Where(char.IsDigit).ToArray());
        return digits.Length == 0 ? null : digits;
    }

    private static int LevenshteinDistance(string a, string b)
    {
        var dp = new int[a.Length + 1, b.Length + 1];
        for (var i = 0; i <= a.Length; i++) dp[i, 0] = i;
        for (var j = 0; j <= b.Length; j++) dp[0, j] = j;

        for (var i = 1; i <= a.Length; i++)
        {
            for (var j = 1; j <= b.Length; j++)
            {
                var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                dp[i, j] = Math.Min(Math.Min(dp[i - 1, j] + 1, dp[i, j - 1] + 1), dp[i - 1, j - 1] + cost);
            }
        }

        return dp[a.Length, b.Length];
    }

    private async Task<IReadOnlyList<ShopifyVariantCandidateDto>> DecorateWithLinkStateAsync(
        List<CatalogEntry> entries, CancellationToken ct)
    {
        var ids = entries.Select(e => e.ShopifyVariantId).ToList();

        var links = await _unitOfWork.Set<ProductVariant>()
            .AsNoTracking()
            .Where(v => v.ShopifyVariantId != null && ids.Contains(v.ShopifyVariantId!.Value))
            .Select(v => new { ShopifyVariantId = v.ShopifyVariantId!.Value, v.Id })
            .ToListAsync(ct);

        var byShopifyId = links.ToDictionary(l => l.ShopifyVariantId, l => l.Id);

        return entries.Select(e => new ShopifyVariantCandidateDto(
            e.ShopifyProductId,
            e.ShopifyVariantId,
            e.ProductTitle,
            e.VariantTitle,
            e.Sku,
            e.Barcode,
            e.Price,
            e.InventoryItemId,
            e.InventoryQuantity,
            byShopifyId.ContainsKey(e.ShopifyVariantId),
            byShopifyId.TryGetValue(e.ShopifyVariantId, out var localId) ? localId : null)).ToList();
    }

    private async Task<List<CatalogEntry>> GetCatalogAsync(CancellationToken ct)
    {
        if (_client is null) return [];

        if (_cache.TryGetValue<List<CatalogEntry>>(CatalogCacheKey, out var cached) && cached is not null)
            return cached;

        List<ShopifyProductItem> products;
        try
        {
            products = await _client.GetAllProductsAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch Shopify catalog for linking");
            return [];
        }

        var entries = products
            .SelectMany(p => (p.Variants ?? []).Select(v => new CatalogEntry(
                p.Id, v.Id, p.Title, v.Option1, v.Sku, v.Barcode,
                decimal.TryParse(v.Price, System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var price) ? price : 0m,
                v.InventoryItemId, v.InventoryQuantity)))
            .ToList();

        _cache.Set(CatalogCacheKey, entries, CatalogCacheTtl);
        return entries;
    }

    private static string? Normalize(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToLowerInvariant();

    private record CatalogEntry(
        long ShopifyProductId, long ShopifyVariantId, string ProductTitle, string? VariantTitle,
        string? Sku, string? Barcode, decimal Price, long InventoryItemId, int? InventoryQuantity);
}
