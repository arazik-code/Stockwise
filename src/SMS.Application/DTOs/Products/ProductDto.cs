namespace SMS.Application.DTOs.Products;

public class ProductDto
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
    public string CategoryName { get; set; } = string.Empty;
    public int? FournisseurId { get; set; }
    public string? FournisseurNom { get; set; }
    public bool IsActive { get; set; }
    /// <summary>True when any of this product's colourways is linked to a Shopify product.</summary>
    public bool IsShopifyLinked { get; set; }
    public List<ProductColorwayDto> Colorways { get; set; } = [];
    public List<ProductVariantDto> Variants { get; set; } = [];
}

/// <summary>
/// A (product x colour) colourway. This is the level Shopify maps to one-for-one, and the level
/// the POS shows as a single tile with its sizes inside.
/// </summary>
public class ProductColorwayDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public int ColorId { get; set; }
    public string ColorName { get; set; } = string.Empty;
    public string ColorHexCode { get; set; } = string.Empty;
    /// <summary>Colourway photo, already resolved against the product's image as a fallback.</summary>
    public string? ImageUrl { get; set; }
    public decimal? OnlinePrice { get; set; }
    public long? ShopifyProductId { get; set; }
    public string? ShopifyTitle { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public int VariantCount { get; set; }
    public int StockQuantity { get; set; }
}

public class ProductVariantDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public int ColorwayId { get; set; }
    public int ColorId { get; set; }
    public string ColorName { get; set; } = string.Empty;
    public string ColorHexCode { get; set; } = string.Empty;
    public int SizeId { get; set; }
    public string SizeValue { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public decimal Price { get; set; }
    public decimal? CostPrice { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; }
    public bool IsLiquidation { get; set; }
    public int StockQuantity { get; set; }
}

public class CreateProductRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Brand { get; set; }
    public string? ImageUrl { get; set; }
    public decimal Price { get; set; }
    public decimal? CostPrice { get; set; }
    public decimal? LiquidationPrice { get; set; }
    public decimal? OnlinePrice { get; set; }
    public int CategoryId { get; set; }
    public int? FournisseurId { get; set; }
}

public class UpdateProductRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Brand { get; set; }
    public string? ImageUrl { get; set; }
    public decimal? Price { get; set; }
    public decimal? CostPrice { get; set; }
    public decimal? LiquidationPrice { get; set; }
    public decimal? OnlinePrice { get; set; }
    public int? CategoryId { get; set; }
    public int? FournisseurId { get; set; }
    public bool? IsActive { get; set; }
}

public class CreateProductVariantRequest
{
    public int ProductId { get; set; }
    public int ColorId { get; set; }
    public int SizeId { get; set; }
    public string? Sku { get; set; }
    public string? Barcode { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsLiquidation { get; set; }
    public int InitialStock { get; set; }
    public int ReorderLevel { get; set; } = 5;
}

public class UpdateProductVariantRequest
{
    public int? ColorId { get; set; }
    public int? SizeId { get; set; }
    public string? Sku { get; set; }
    public string? Barcode { get; set; }
    public string? ImageUrl { get; set; }
    public bool? IsActive { get; set; }
    public bool? IsLiquidation { get; set; }
}

public class ProductSearchRequest
{
    public string? Query { get; set; }
    public int? CategoryId { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

public class OnlineProductStatsDto
{
    public int ProductId { get; set; }
    public int UnitsSold { get; set; }
    public decimal Revenue { get; set; }
    public int OrderCount { get; set; }
    public DateTime? LastOrderAt { get; set; }
}

public class DraftProductDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public bool IsShopifyLinked { get; set; }
    public int ColorwayCount { get; set; }
    public int VariantCount { get; set; }
}

public class DeleteDraftProductsResultDto
{
    public int TotalDrafts { get; set; }
    public int Deleted { get; set; }
    public List<SkippedDraftProductDto> Skipped { get; set; } = [];
}

public class SkippedDraftProductDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
}
