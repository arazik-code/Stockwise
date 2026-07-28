namespace SMS.Application.Interfaces;

/// <summary>
/// The single place that pushes one local variant's stock level to Shopify. Sales, the periodic
/// reconciliation job and the admin diagnostic endpoint all go through this, so there is exactly
/// one implementation of "how do we resolve a local variant to a Shopify inventory item and set it".
/// </summary>
public interface IShopifyInventoryPusher
{
    Task<ShopifyPushResult> PushVariantAsync(int productVariantId, CancellationToken ct = default);
}

public enum ShopifyPushOutcome
{
    Pushed = 0,
    NotConfigured = 1,
    LocationNotConfigured = 2,
    VariantNotFound = 3,
    NotLinkedToShopify = 4,
    InventoryItemUnresolvable = 5,
    ApiError = 6
}

public record ShopifyPushResult(
    int ProductVariantId,
    ShopifyPushOutcome Outcome,
    string Message,
    long? ShopifyVariantId = null,
    long? InventoryItemId = null,
    int? QuantityPushed = null)
{
    public bool Success => Outcome == ShopifyPushOutcome.Pushed;
}
