namespace SMS.Domain.Entities;

/// <summary>
/// One colourway of a product: the (Product x Color) pair, sitting between Product and
/// ProductVariant.
///
/// This tier exists because the two halves of the business model the same shoe differently.
/// Shopify ships ONE PRODUCT PER COLOURWAY - every product in this store's catalog exposes a
/// single option, "Pointures" (size), and the colour lives only in the product title. The shop
/// floor, meanwhile, thinks in one product with a colour x size matrix. The colourway is the
/// level where those two views actually meet, so it is the level that owns the Shopify link,
/// the merchandising photo and the online price.
///
/// ProductVariant deliberately keeps its own ProductId and ColorId rather than reaching them
/// through this row. That redundancy is not laziness - it keeps every existing query, include
/// chain and GroupBy(ProductId) in the codebase working unchanged. It is made impossible to
/// corrupt by a composite foreign key: ProductVariant(ColorwayId, ProductId, ColorId) points at
/// the alternate key (Id, ProductId, ColorId) here, so a variant can never disagree with its
/// colourway about which product or colour it belongs to. See ProductColorwayConfiguration.
/// </summary>
public class ProductColorway
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int ColorId { get; set; }
    public Color Color { get; set; } = null!;

    /// <summary>Colourway-specific photo. Falls back to the parent product's image when null.</summary>
    public string? ImageUrl { get; set; }

    /// <summary>Storefront price for this colourway. Falls back to Product.OnlinePrice, then Product.Price.</summary>
    public decimal? OnlinePrice { get; set; }

    /// <summary>
    /// The Shopify product backing this colourway. Null for colourways that only exist in-store.
    /// This replaces the old scalar Product.ShopifyProductId, which could only ever name one of a
    /// product's several colourways.
    /// </summary>
    public long? ShopifyProductId { get; set; }

    /// <summary>The colourway's own storefront title, e.g. "Basket En Cuir Marron - Aknou".</summary>
    public string? ShopifyTitle { get; set; }

    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<ProductVariant> Variants { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
