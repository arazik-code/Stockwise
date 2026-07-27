namespace SMS.Application.DTOs.Shopify;

public class ShopifyProductMappingDto
{
    public int Id { get; set; }
    public long ShopifyProductId { get; set; }
    public long ShopifyVariantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Sku { get; set; }
    public decimal Price { get; set; }
    public int? LocalProductId { get; set; }
    public string? LocalProductName { get; set; }
    public decimal? LocalPrice { get; set; }
    public bool PriceMismatch { get; set; }
    public DateTime SyncedAt { get; set; }
}

public class CreateShopifyProductMappingRequest
{
    public long ShopifyProductId { get; set; }
    public long ShopifyVariantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Sku { get; set; }
    public decimal Price { get; set; }
    public int? LocalProductId { get; set; }
}

public class LinkShopifyProductMappingRequest
{
    public int? LocalProductId { get; set; }
}

public class ShopifyImportResultDto
{
    public int TotalVariants { get; set; }
    public int Created { get; set; }
    public int Updated { get; set; }
    public int AutoLinked { get; set; }
    public bool Configured { get; set; } = true;
}

public class ShopifyCatalogImportResultDto
{
    public int ProductsCreated { get; set; }
    public int ProductsUpdated { get; set; }
    public int VariantsCreated { get; set; }
    public int VariantsUpdated { get; set; }
    public int ColorsCreated { get; set; }
    public int SizesCreated { get; set; }
    public int CategoriesCreated { get; set; }
    public int BarcodesGenerated { get; set; }
    public int ConflictedOrdersResolved { get; set; }
    public bool Configured { get; set; } = true;
}
