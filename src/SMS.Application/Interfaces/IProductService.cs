using SMS.Application.DTOs.Products;
using SMS.Domain.Entities;

namespace SMS.Application.Interfaces;

public interface IProductService
{
    Task<IReadOnlyList<ProductDto>> GetAllAsync(CancellationToken ct = default);
    Task<ProductDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<IReadOnlyList<ProductDto>> SearchAsync(ProductSearchRequest request, CancellationToken ct = default);
    Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken ct = default);
    Task<ProductDto?> UpdateAsync(int id, UpdateProductRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(int id, CancellationToken ct = default);
    Task<ProductVariantDto> AddVariantAsync(CreateProductVariantRequest request, CancellationToken ct = default);
    Task<ProductVariantDto?> UpdateVariantAsync(int variantId, UpdateProductVariantRequest request, CancellationToken ct = default);
    Task<bool> DeleteVariantAsync(int variantId, CancellationToken ct = default);
    Task<ProductVariantDto?> GetVariantByBarcodeAsync(string barcode, CancellationToken ct = default);
    Task<ProductDto?> GetByBarcodeAsync(string barcode, CancellationToken ct = default);
    Task<int> GenerateMissingBarcodesAsync(CancellationToken ct = default);
    Task<IReadOnlyList<OnlineProductStatsDto>> GetOnlineStatsAsync(CancellationToken ct = default);
    decimal GetEffectivePrice(Product product, ProductVariant variant);
    Task<IReadOnlyList<DraftProductDto>> GetDraftProductsAsync(CancellationToken ct = default);
    Task<DeleteDraftProductsResultDto> DeleteDraftProductsAsync(CancellationToken ct = default);
}
