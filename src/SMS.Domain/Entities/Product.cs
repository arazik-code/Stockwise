namespace SMS.Domain.Entities;

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Brand { get; set; }
    public string? Barcode { get; set; }
    public string? ImageUrl { get; set; }
    public decimal Price { get; set; }
    public decimal? CostPrice { get; set; }
    public decimal? LiquidationPrice { get; set; }
    public decimal? OnlinePrice { get; set; }
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;
    public int? FournisseurId { get; set; }
    public Fournisseur? Fournisseur { get; set; }
    public bool IsActive { get; set; } = true;
    public long? ShopifyProductId { get; set; }
    public ICollection<ProductVariant> Variants { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
