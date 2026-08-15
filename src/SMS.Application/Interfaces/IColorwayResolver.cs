using SMS.Domain.Entities;

namespace SMS.Application.Interfaces;

/// <summary>
/// Resolves the (Product x Color) colourway row that every ProductVariant must hang off.
///
/// Four code paths mint variants - ProductAppService.AddVariantAsync, its UpdateVariantAsync
/// re-home path, InvoiceAppService's auto-create (twice) and the Shopify catalog importer - and
/// each one previously only knew a ProductId and a ColorId. They all route through here so the
/// "does this colourway exist yet?" rule lives in exactly one place.
/// </summary>
public interface IColorwayResolver
{
    /// <summary>
    /// Returns the colourway for this product/colour pair, creating and persisting it if absent.
    /// The returned entity always has a real database Id.
    /// </summary>
    Task<ProductColorway> GetOrCreateAsync(int productId, int colorId, CancellationToken ct = default);

    /// <summary>
    /// Deletes the colourway if no variant references it any more. Called after a variant is
    /// re-homed to a different colour, so the vacated colourway doesn't linger as an empty row
    /// in the POS colour picker. Silently does nothing if the colourway still has variants or
    /// carries a Shopify link worth keeping.
    /// </summary>
    Task RemoveIfOrphanedAsync(int colorwayId, CancellationToken ct = default);
}
