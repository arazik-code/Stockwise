using SMS.Application.DTOs.Shopify;

namespace SMS.Application.Interfaces;

/// <summary>
/// Links a local ProductVariant to a Shopify variant at the <b>variant</b> level, which is the only
/// linkage the inventory sync actually reads (ProductVariant.ShopifyVariantId).
/// <para>
/// The pre-existing "mapping" feature only set ShopifyProduct.LocalProductId - a product-level
/// column that is NULL on all 2,949 rows and that nothing in the sync path ever consults, so
/// linking a product by hand had no effect on stock synchronisation whatsoever.
/// </para>
/// </summary>
public interface IShopifyLinkService
{
    Task<IReadOnlyList<UnlinkedVariantDto>> GetUnlinkedVariantsAsync(CancellationToken ct = default);

    Task<IReadOnlyList<ShopifyVariantCandidateDto>> SearchShopifyVariantsAsync(
        string? query, int limit = 50, CancellationToken ct = default);

    Task<IReadOnlyList<ShopifyVariantCandidateDto>> SuggestForVariantAsync(
        int productVariantId, CancellationToken ct = default);

    Task<LinkVariantResultDto> LinkAsync(int productVariantId, long shopifyVariantId, CancellationToken ct = default);

    Task<LinkVariantResultDto> UnlinkAsync(int productVariantId, CancellationToken ct = default);

    Task<AutoLinkResultDto> AutoLinkAsync(CancellationToken ct = default);
}
