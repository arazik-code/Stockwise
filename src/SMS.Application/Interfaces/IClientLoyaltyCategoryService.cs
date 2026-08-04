using SMS.Application.DTOs;
using SMS.Domain.Entities;
using SMS.Domain.Enums;

namespace SMS.Application.Interfaces;

/// <summary>
/// Owns the client loyalty category (Nouveau/Bon/Premium) - a rewards tier that actually drives the
/// point-earning rate, distinct from and independent of the CRM's marketing-oriented ClientSegment
/// (New/Regular/Vip/AtRisk/Lost). See ClientCategoryAppService for the auto-categorization rules.
/// </summary>
public interface IClientLoyaltyCategoryService
{
    /// <summary>
    /// Recomputes ComputedCategory from the client's current purchase history, refreshes
    /// EffectiveCategory (ManualCategory ?? ComputedCategory) and the denormalized LoyaltyRate
    /// display cache. Mutates the passed-in tracked entity only - does not call SaveChanges, so
    /// callers already inside a unit of work (a sale, an awarded order) persist it as part of their
    /// own SaveChangesAsync. Never touches ManualCategory.
    /// </summary>
    Task RecategorizeAsync(Client client, LoyaltySettings settings, CancellationToken ct = default);

    /// <summary>
    /// Sets or clears (category = null) the manual override for one client, immediately refreshes
    /// EffectiveCategory/LoyaltyRate, logs a zero-point audit entry in the loyalty transaction
    /// history, and saves. Standalone operation (calls SaveChangesAsync itself).
    /// </summary>
    Task<Client> SetManualCategoryAsync(int clientId, ClientCategory? manualCategory, string? reason, CancellationToken ct = default);

    /// <summary>
    /// Bulk recompute for every client (or a specific subset, e.g. just-imported Shopify clients).
    /// Batches the underlying spend/order aggregate into a handful of GROUP BY queries rather than
    /// one query per client. Returns the number of clients recomputed.
    /// </summary>
    Task<int> RecategorizeAllAsync(CancellationToken ct = default);

    Task<int> RecategorizeManyAsync(IReadOnlyCollection<int> clientIds, CancellationToken ct = default);
}
