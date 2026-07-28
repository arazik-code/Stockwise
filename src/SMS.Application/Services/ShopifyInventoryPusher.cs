using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class ShopifyInventoryPusher : IShopifyInventoryPusher
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ShopifyOptions _options;
    private readonly ILogger<ShopifyInventoryPusher> _logger;
    private readonly IShopifyApiClient? _client;

    public ShopifyInventoryPusher(
        IUnitOfWork unitOfWork,
        IOptions<ShopifyOptions> options,
        ILogger<ShopifyInventoryPusher> logger,
        IShopifyApiClient? client = null)
    {
        _unitOfWork = unitOfWork;
        _options = options.Value;
        _logger = logger;
        _client = client;
    }

    public async Task<ShopifyPushResult> PushVariantAsync(int productVariantId, CancellationToken ct = default)
    {
        if (_client is null)
            return new(productVariantId, ShopifyPushOutcome.NotConfigured,
                "Shopify n'est pas configure (client API absent).");

        if (!long.TryParse(_options.LocationId, out var locationId) || locationId == 0)
            return new(productVariantId, ShopifyPushOutcome.LocationNotConfigured,
                $"Shopify:LocationId absent ou invalide ('{_options.LocationId}').");

        var variant = await _unitOfWork.Set<ProductVariant>()
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == productVariantId, ct);

        if (variant is null)
            return new(productVariantId, ShopifyPushOutcome.VariantNotFound,
                "Variante introuvable localement.");

        if (variant.ShopifyVariantId is not long shopifyVariantId || shopifyVariantId == 0)
            return new(productVariantId, ShopifyPushOutcome.NotLinkedToShopify,
                "Cette variante n'est liee a aucune variante Shopify.");

        var stock = await _unitOfWork.Set<StockItem>()
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.ProductVariantId == productVariantId, ct);
        var quantity = stock?.QuantityOnHand ?? 0;

        var inventoryItemId = await ResolveInventoryItemIdAsync(shopifyVariantId, ct);
        if (inventoryItemId is null)
            return new(productVariantId, ShopifyPushOutcome.InventoryItemUnresolvable,
                $"Impossible de resoudre l'inventory_item_id pour la variante Shopify {shopifyVariantId}.",
                shopifyVariantId);

        var ok = await _client.UpdateInventoryLevelAsync(inventoryItemId.Value, locationId, quantity, ct);

        if (!ok)
            return new(productVariantId, ShopifyPushOutcome.ApiError,
                "Shopify a refuse la mise a jour du niveau de stock (voir les logs).",
                shopifyVariantId, inventoryItemId, quantity);

        _logger.LogInformation(
            "Shopify inventory updated: variant {VariantId} (shopify {ShopifyVariantId}, item {ItemId}) -> {Qty}",
            productVariantId, shopifyVariantId, inventoryItemId, quantity);

        return new(productVariantId, ShopifyPushOutcome.Pushed,
            "Stock Shopify mis a jour.", shopifyVariantId, inventoryItemId, quantity);
    }

    /// <summary>
    /// The local ShopifyProducts table is the fast path, but it can be stale or missing rows (it is
    /// only populated by catalog import). Rather than silently giving up - which is exactly how this
    /// used to fail invisibly - fall back to asking Shopify directly and persist what we learn, so
    /// a manually-linked variant works on the very first sale without a full catalog re-import.
    /// </summary>
    private async Task<long?> ResolveInventoryItemIdAsync(long shopifyVariantId, CancellationToken ct)
    {
        var mapping = await _unitOfWork.Set<ShopifyProduct>()
            .FirstOrDefaultAsync(sp => sp.ShopifyVariantId == shopifyVariantId, ct);

        if (mapping is not null && mapping.ShopifyInventoryItemId != 0)
            return mapping.ShopifyInventoryItemId;

        ShopifyVariantItem? remote;
        try
        {
            remote = await _client!.GetVariantAsync(shopifyVariantId, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch Shopify variant {ShopifyVariantId} to resolve its inventory item", shopifyVariantId);
            return null;
        }

        if (remote is null || remote.InventoryItemId == 0) return null;

        if (mapping is null)
        {
            await _unitOfWork.AddAsync(new ShopifyProduct
            {
                ShopifyProductId = 0,
                ShopifyVariantId = shopifyVariantId,
                Title = remote.Sku ?? string.Empty,
                Sku = remote.Sku,
                ShopifyInventoryItemId = remote.InventoryItemId,
                SyncedAt = DateTime.UtcNow
            }, ct);
        }
        else
        {
            mapping.ShopifyInventoryItemId = remote.InventoryItemId;
            mapping.SyncedAt = DateTime.UtcNow;
        }

        await _unitOfWork.SaveChangesAsync(ct);
        _logger.LogInformation("Resolved and cached inventory item {ItemId} for Shopify variant {ShopifyVariantId}",
            remote.InventoryItemId, shopifyVariantId);

        return remote.InventoryItemId;
    }
}
