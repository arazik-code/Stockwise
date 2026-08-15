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

    /// <summary>
    /// The real link. LinkByShopifyProductAsync above only sets a bookkeeping field nothing else
    /// reads - this creates/reuses a ProductColorway under the chosen local product and colour,
    /// pulls in each of the Shopify product's sizes as real local ProductVariants with their own
    /// ShopifyVariantId, and seeds stock from Shopify's live counts. Safe to call again for a
    /// colourway that's already linked (idempotent), and linking one colour never touches another
    /// colourway's rows, since each is its own ProductColorway keyed on (ProductId, ColorId).
    /// </summary>
    Task<LinkColorwayResultDto> LinkColorwayAsync(long shopifyProductId, LinkColorwayRequest request, CancellationToken ct = default);

    /// <summary>
    /// Clears the real link only - the colourway, its local variants and their stock all stay
    /// exactly as they are. Also clears each of those variants' ShopifyVariantId, so a colourway
    /// and its sizes can never disagree about whether they're Shopify-linked.
    /// </summary>
    Task<bool> UnlinkColorwayAsync(long shopifyProductId, CancellationToken ct = default);

    Task<bool> DeleteAsync(int id, CancellationToken ct = default);

    /// <summary>Deletes every mapping row belonging to one Shopify product. Returns rows removed.</summary>
    Task<int> DeleteByShopifyProductAsync(long shopifyProductId, CancellationToken ct = default);
    Task<ShopifyImportResultDto> ImportFromShopifyAsync(CancellationToken ct = default);
    Task<ShopifyCatalogImportResultDto> ImportCatalogFromShopifyAsync(CancellationToken ct = default);
}
