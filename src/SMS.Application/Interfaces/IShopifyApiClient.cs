using SMS.Application.DTOs.Shopify;

namespace SMS.Application.Interfaces;

public interface IShopifyApiClient
{
    Task<bool> UpdateInventoryLevelAsync(long inventoryItemId, long locationId, int available, CancellationToken ct = default);
    Task<ShopifyProductListResponse?> GetProductsAsync(int limit = 50, string? pageInfo = null, CancellationToken ct = default);

    /// <summary>
    /// Fetches a single variant, used to resolve (and then cache) its inventory_item_id when the
    /// local mapping table has no row for it - e.g. a variant linked by hand after the last import.
    /// </summary>
    Task<ShopifyVariantItem?> GetVariantAsync(long shopifyVariantId, CancellationToken ct = default);

    /// <summary>
    /// Pushes a new SKU to a Shopify variant. Used by the manual link flow to keep the local and
    /// Shopify SKU identical once two variants are linked.
    /// </summary>
    Task<bool> UpdateVariantSkuAsync(long shopifyVariantId, string sku, CancellationToken ct = default);

    /// <summary>
    /// Reads current Shopify stock for up to 50 inventory items in a single call. Used to compare
    /// before writing, so a full reconciliation costs ~60 reads instead of ~2,949 writes.
    /// </summary>
    Task<IReadOnlyList<ShopifyInventoryLevelItem>> GetInventoryLevelsAsync(
        IReadOnlyList<long> inventoryItemIds, long locationId, CancellationToken ct = default);
    Task<List<ShopifyProductItem>> GetAllProductsAsync(CancellationToken ct = default);
    Task<ShopifyOrderListResponse?> GetOrdersAsync(string status = "any", int limit = 50, DateTime? createdAtMin = null, string? pageInfo = null, CancellationToken ct = default);
    Task<bool> RegisterWebhookAsync(string topic, string callbackUrl, CancellationToken ct = default);
    Task<ShopifyLocationListResponse?> GetLocationsAsync(CancellationToken ct = default);
    Task<List<ShopifyCollectionItem>> GetAllCollectionsAsync(CancellationToken ct = default);
    Task<List<ShopifyCollectItem>> GetAllCollectsAsync(CancellationToken ct = default);

    /// <summary>
    /// Fetches all Shopify customers. Throws <see cref="ShopifyCustomerAccessNotApprovedException"/>
    /// if the app has not yet been granted "Protected customer data access" by Shopify — callers
    /// should catch this and report a friendly, non-crashing status rather than treat it as a bug.
    /// </summary>
    Task<List<ShopifyCustomerItem>> GetAllCustomersAsync(CancellationToken ct = default);

    /// <summary>
    /// Fetches the store's entire order history (all statuses, all time), paginated. Requires the
    /// read_all_orders scope for orders older than 60 days. Throws on hard failures so a bulk import
    /// never silently reports a partial history as complete.
    /// </summary>
    Task<List<ShopifyOrderItem>> GetAllOrdersAsync(CancellationToken ct = default);
}

public class ShopifyCustomerAccessNotApprovedException : Exception
{
    public ShopifyCustomerAccessNotApprovedException(string message) : base(message) { }
}
