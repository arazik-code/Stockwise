namespace SMS.Domain.Entities;

public class ShopifyOrderLineItem
{
    public int Id { get; set; }
    public int ShopifyOrderId { get; set; }
    public ShopifyOrder ShopifyOrder { get; set; } = null!;
    public long ShopifyProductId { get; set; }
    public long ShopifyVariantId { get; set; }
    public int? LocalProductId { get; set; }
    public Product? LocalProduct { get; set; }
    public string Title { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal Price { get; set; }
}
