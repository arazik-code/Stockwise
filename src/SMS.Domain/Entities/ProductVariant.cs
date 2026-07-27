namespace SMS.Domain.Entities;

public class ProductVariant
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int ColorId { get; set; }
    public Color Color { get; set; } = null!;
    public int SizeId { get; set; }
    public Size Size { get; set; } = null!;
    public string Sku { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsLiquidation { get; set; }
    public long? ShopifyVariantId { get; set; }
    public StockItem? StockItem { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
