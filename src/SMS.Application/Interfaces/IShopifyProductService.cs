using SMS.Application.DTOs.Shopify;

namespace SMS.Application.Interfaces;

public interface IShopifyProductService
{
    Task<IReadOnlyList<ShopifyProductMappingDto>> GetAllAsync(CancellationToken ct = default);
    Task<ShopifyProductMappingDto> CreateAsync(CreateShopifyProductMappingRequest request, CancellationToken ct = default);
    Task<ShopifyProductMappingDto?> LinkAsync(int id, LinkShopifyProductMappingRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(int id, CancellationToken ct = default);
    Task<ShopifyImportResultDto> ImportFromShopifyAsync(CancellationToken ct = default);
    Task<ShopifyCatalogImportResultDto> ImportCatalogFromShopifyAsync(CancellationToken ct = default);
}
