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

    /// <summary>
    /// The REAL link, read off ProductColorway.ShopifyProductId - the field the stock push and
    /// order matching actually use. Null here means this Shopify product isn't connected to
    /// anything functionally, regardless of what LocalProductId above says.
    /// </summary>
    public int? LinkedColorwayId { get; set; }
    public int? LinkedProductId { get; set; }
    public string? LinkedProductName { get; set; }
    public int? LinkedColorId { get; set; }
    public string? LinkedColorName { get; set; }
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

public class LinkColorwayRequest
{
    public int LocalProductId { get; set; }
    public int ColorId { get; set; }
}

public class LinkColorwayResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int VariantsCreated { get; set; }
    public int VariantsUpdated { get; set; }
    public int ColorwayId { get; set; }
}
