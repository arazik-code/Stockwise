using SMS.Application.DTOs.Shopify;

namespace SMS.Application.Interfaces;

public interface IShopifyProductService
{
    Task<IReadOnlyList<ShopifyProductMappingDto>> GetAllAsync(CancellationToken ct = default);
    Task<ShopifyProductMappingDto> CreateAsync(CreateShopifyProductMappingRequest request, CancellationToken ct = default);
    Task<ShopifyProductMappingDto?> LinkAsync(int id, LinkShopifyProductMappingRequest request, CancellationToken ct = default);

    /// <summary>
    /// Links every mapping row belonging to one Shopify product at once.
    ///
    /// A ShopifyProduct row exists per Shopify VARIANT (the inventory push resolves a variant's
    /// InventoryItemId through it), but LocalProductId is a PRODUCT-level pointer - so linking one
    /// size at a time asks the same question once per size and can leave a Shopify product half
    /// linked. This does the whole set in one transaction.
    /// </summary>
    Task<int> LinkByShopifyProductAsync(long shopifyProductId, int? localProductId, CancellationToken ct = default);

    Task<bool> DeleteAsync(int id, CancellationToken ct = default);

    /// <summary>Deletes every mapping row belonging to one Shopify product. Returns rows removed.</summary>
    Task<int> DeleteByShopifyProductAsync(long shopifyProductId, CancellationToken ct = default);
    Task<ShopifyImportResultDto> ImportFromShopifyAsync(CancellationToken ct = default);
    Task<ShopifyCatalogImportResultDto> ImportCatalogFromShopifyAsync(CancellationToken ct = default);
}
