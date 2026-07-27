namespace SMS.Domain.Entities;

public class ShopifyProduct
{
    public int Id { get; set; }
    public long ShopifyProductId { get; set; }
    public long ShopifyVariantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Sku { get; set; }
    public decimal Price { get; set; }
    public int? LocalProductId { get; set; }
    public Product? LocalProduct { get; set; }
    public long ShopifyInventoryItemId { get; set; }
    public DateTime SyncedAt { get; set; } = DateTime.UtcNow;
}
