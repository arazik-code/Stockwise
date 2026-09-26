namespace SMS.Domain.Entities;

public class OnlineOrderItem
{
    public int Id { get; set; }
    public int OnlineOrderId { get; set; }
    public OnlineOrder OnlineOrder { get; set; } = null!;

    // Nullable: a line can arrive from Shopify with no local catalog match (InventoryConflict).
    // Previously such lines were discarded entirely - their product name was dumped into the
    // order's free-text Notes and the OnlineOrderItem row was never created at all, so a
    // conflicted order had zero line items and was unrecoverable from the UI. Now every line is
    // preserved; ShopifyProductId/ShopifyVariantId/raw snapshot are kept so a rematch job can
    // resolve it later once the product exists locally, without needing to re-fetch from Shopify.
    public int? ProductVariantId { get; set; }
    public ProductVariant? ProductVariant { get; set; }

    public long? ShopifyProductId { get; set; }
    public long? ShopifyVariantId { get; set; }
    public string? ShopifySku { get; set; }

    // Shopify's own variant_title (e.g. "42", or "Bleu / 42" for a product with real colour
    // options) - captured at ingest time so the order detail can show size/colour exactly as
    // Shopify reported it, independent of whether this line has been matched to a local
    // ProductVariant yet. Null for pre-existing orders synced before this field existed, and for
    // line items Shopify itself has no variant title for.
    public string? ShopifyVariantTitle { get; set; }

    public string ProductNameSnapshot { get; set; } = string.Empty;
    public string SkuSnapshot { get; set; } = string.Empty;

    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal LineTotal { get; set; }

    public int QuantityReserved { get; set; }
    public int QuantityFulfilled { get; set; }
}
