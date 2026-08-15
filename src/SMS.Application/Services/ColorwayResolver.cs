using Microsoft.EntityFrameworkCore;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

/// <inheritdoc />
public class ColorwayResolver : IColorwayResolver
{
    private readonly IUnitOfWork _unitOfWork;

    public ColorwayResolver(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<ProductColorway> GetOrCreateAsync(int productId, int colorId, CancellationToken ct = default)
    {
        var existing = await _unitOfWork.Set<ProductColorway>()
            .FirstOrDefaultAsync(c => c.ProductId == productId && c.ColorId == colorId, ct);

        if (existing is not null) return existing;

        // Sort colourways in creation order by default so the POS colour strip is stable between
        // page loads rather than reordering on every query.
        var nextSort = await _unitOfWork.Set<ProductColorway>()
            .Where(c => c.ProductId == productId)
            .CountAsync(ct);

        var colorway = new ProductColorway
        {
            ProductId = productId,
            ColorId = colorId,
            SortOrder = nextSort,
            IsActive = true
        };

        await _unitOfWork.AddAsync(colorway, ct);

        // Persisted immediately rather than deferred to the caller's SaveChanges: callers need a
        // real Id to stamp onto ProductVariant.ColorwayId, and this mirrors how the catalog
        // importer's GetOrCreateColorAsync/GetOrCreateSizeAsync already handle reference rows.
        // Callers that run inside an explicit transaction still get this write rolled back with
        // the rest on failure; the ones that don't would at worst leave an unused grouping row,
        // which the next call simply reuses.
        await _unitOfWork.SaveChangesAsync(ct);

        return colorway;
    }

    public async Task RemoveIfOrphanedAsync(int colorwayId, CancellationToken ct = default)
    {
        var colorway = await _unitOfWork.Set<ProductColorway>()
            .FirstOrDefaultAsync(c => c.Id == colorwayId, ct);

        if (colorway is null) return;

        // A linked colourway is kept even when empty - the Shopify association is worth more than
        // the tidiness, and re-linking it by hand afterwards is a chore.
        if (colorway.ShopifyProductId is not null) return;

        var stillUsed = await _unitOfWork.Set<ProductVariant>()
            .AnyAsync(v => v.ColorwayId == colorwayId, ct);

        if (stillUsed) return;

        _unitOfWork.Remove(colorway);
        await _unitOfWork.SaveChangesAsync(ct);
    }
}
