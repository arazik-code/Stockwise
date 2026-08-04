using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SMS.Application.DTOs;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

/// <summary>
/// Auto-categorization thresholds for the loyalty tier (Nouveau/Bon/Premium). Deliberately set above
/// the CRM segment's VIP bar (>=2500 DH or 4+ orders, see ClientCrmAppService.DetermineSegment) - a
/// tier that pays a permanently higher point rate needs a higher bar than a "give this person
/// attention" marketing flag, or the store would overpay a much larger population than intended.
/// Account age is deliberately NOT a factor here (unlike the CRM segment's "New if age&lt;=60") - a
/// large historical Shopify import should reflect its true tier immediately, since this is about
/// purchase behavior, not tenure.
/// </summary>
public static class ClientCategoryEngine
{
    public const decimal PremiumSpendThreshold = 4000m;
    public const int PremiumOrderThreshold = 6;
    public const decimal BonSpendThreshold = 1200m;
    public const int BonOrderThreshold = 3;

    public static ClientCategory Determine(decimal effectiveSpent, int effectiveOrders)
    {
        if (effectiveSpent >= PremiumSpendThreshold || effectiveOrders >= PremiumOrderThreshold)
            return ClientCategory.Premium;

        if (effectiveSpent >= BonSpendThreshold || effectiveOrders >= BonOrderThreshold)
            return ClientCategory.Bon;

        return ClientCategory.Nouveau;
    }
}

public class ClientCategoryAppService : IClientLoyaltyCategoryService
{
    // Kept separate from ClientCrmAppService.ExcludedOnlineStatuses by design - the two category
    // systems are intentionally independent (see ClientCategoryEngine doc comment).
    private static readonly OrderStatus[] ExcludedOnlineStatuses = [OrderStatus.Cancelled, OrderStatus.InventoryConflict];

    private readonly IUnitOfWork _unitOfWork;
    private readonly ILoyaltyRateResolver _rateResolver;
    private readonly LoyaltySettings _loyaltySettings;

    public ClientCategoryAppService(IUnitOfWork unitOfWork, ILoyaltyRateResolver rateResolver, IOptions<LoyaltySettings> loyaltySettings)
    {
        _unitOfWork = unitOfWork;
        _rateResolver = rateResolver;
        _loyaltySettings = loyaltySettings.Value;
    }

    public async Task RecategorizeAsync(Client client, LoyaltySettings settings, CancellationToken ct = default)
    {
        // Callers (SaleAppService, OnlineOrderAppService) invoke this right after bumping
        // client.TotalSpent in-memory for the sale/order that's still being saved - a fresh
        // Sales/OnlineOrders aggregate query wouldn't see that same not-yet-saved row anyway, so use
        // the already-current client.TotalSpent as the authoritative spend figure instead of
        // re-deriving it, and only query for the order count.
        var orderCount = await _unitOfWork.Set<Sale>().CountAsync(s => s.ClientId == client.Id, ct)
            + await _unitOfWork.Set<OnlineOrder>().CountAsync(o => o.ClientId == client.Id && !ExcludedOnlineStatuses.Contains(o.Status), ct);

        var effectiveOrders = orderCount > 0 ? orderCount : (client.ShopifyOrdersCount ?? 0);
        var effectiveSpent = orderCount > 0 ? client.TotalSpent : (client.ShopifyTotalSpent ?? 0m);
        ApplyComputed(client, effectiveSpent, effectiveOrders, settings);
    }

    public async Task<Client> SetManualCategoryAsync(int clientId, ClientCategory? manualCategory, string? reason, CancellationToken ct = default)
    {
        var client = await _unitOfWork.Clients.GetByIdAsync(clientId, ct)
            ?? throw new KeyNotFoundException($"Client {clientId} not found");

        var settings = _loyaltySettings;

        // Refresh ComputedCategory too, so clearing the override falls back to an up-to-date
        // suggestion rather than whatever was last computed (possibly a while ago).
        var (spend, orders) = await ComputeEffectiveSpendOrdersAsync(client.Id, client.ShopifyTotalSpent, client.ShopifyOrdersCount, ct);
        client.ComputedCategory = ClientCategoryEngine.Determine(spend, orders);
        client.ManualCategory = manualCategory;
        client.EffectiveCategory = client.ManualCategory ?? client.ComputedCategory;
        client.LoyaltyRate = _rateResolver.GetRate(client, settings);
        client.CategoryUpdatedAt = DateTime.UtcNow;

        var label = CategoryLabel(client.EffectiveCategory);
        var description = manualCategory is null
            ? $"Catégorie remise en automatique : {label}"
            : $"Catégorie changée manuellement : {label}" + (string.IsNullOrWhiteSpace(reason) ? "" : $" ({reason})");

        _unitOfWork.Clients.AddTransaction(new LoyaltyTransaction
        {
            ClientId = client.Id,
            PointsChange = 0,
            Type = LoyaltyTransactionType.Adjust,
            Description = description,
            BalanceAfter = client.TotalPoints
        });

        await _unitOfWork.SaveChangesAsync(ct);
        return client;
    }

    public async Task<int> RecategorizeAllAsync(CancellationToken ct = default)
    {
        var ids = await _unitOfWork.Set<Client>().Select(c => c.Id).ToListAsync(ct);
        return await RecategorizeManyAsync(ids, ct);
    }

    public async Task<int> RecategorizeManyAsync(IReadOnlyCollection<int> clientIds, CancellationToken ct = default)
    {
        if (clientIds.Count == 0) return 0;

        var settings = _loyaltySettings;

        var saleAgg = await _unitOfWork.Set<Sale>()
            .Where(s => s.ClientId != null && clientIds.Contains(s.ClientId.Value))
            .GroupBy(s => s.ClientId!.Value)
            .Select(g => new { ClientId = g.Key, Spent = g.Sum(s => s.TotalAmount), Orders = g.Count() })
            .ToListAsync(ct);

        var onlineAgg = await _unitOfWork.Set<OnlineOrder>()
            .Where(o => o.ClientId != null && clientIds.Contains(o.ClientId.Value) && !ExcludedOnlineStatuses.Contains(o.Status))
            .GroupBy(o => o.ClientId!.Value)
            .Select(g => new { ClientId = g.Key, Spent = g.Sum(o => o.TotalAmount), Orders = g.Count() })
            .ToListAsync(ct);

        var itemized = new Dictionary<int, (decimal Spent, int Orders)>();
        foreach (var row in saleAgg)
        {
            var cur = itemized.GetValueOrDefault(row.ClientId);
            itemized[row.ClientId] = (cur.Spent + row.Spent, cur.Orders + row.Orders);
        }
        foreach (var row in onlineAgg)
        {
            var cur = itemized.GetValueOrDefault(row.ClientId);
            itemized[row.ClientId] = (cur.Spent + row.Spent, cur.Orders + row.Orders);
        }

        var recomputed = 0;
        foreach (var idBatch in clientIds.Chunk(200))
        {
            var clients = await _unitOfWork.Set<Client>().Where(c => idBatch.Contains(c.Id)).ToListAsync(ct);
            foreach (var client in clients)
            {
                var (itemizedSpent, itemizedOrders) = itemized.GetValueOrDefault(client.Id);
                var spend = itemizedOrders > 0 ? itemizedSpent : (client.ShopifyTotalSpent ?? 0m);
                var orders = itemizedOrders > 0 ? itemizedOrders : (client.ShopifyOrdersCount ?? 0);
                ApplyComputed(client, spend, orders, settings);
                recomputed++;
            }

            await _unitOfWork.SaveChangesAsync(ct);
            _unitOfWork.ClearChangeTracker();
        }

        return recomputed;
    }

    private void ApplyComputed(Client client, decimal effectiveSpent, int effectiveOrders, LoyaltySettings settings)
    {
        client.ComputedCategory = ClientCategoryEngine.Determine(effectiveSpent, effectiveOrders);
        client.EffectiveCategory = client.ManualCategory ?? client.ComputedCategory;
        client.LoyaltyRate = _rateResolver.GetRate(client, settings);
        client.CategoryUpdatedAt = DateTime.UtcNow;
    }

    private async Task<(decimal Spend, int Orders)> ComputeEffectiveSpendOrdersAsync(
        int clientId, decimal? shopifyTotalSpent, int? shopifyOrdersCount, CancellationToken ct)
    {
        var saleAgg = await _unitOfWork.Set<Sale>()
            .Where(s => s.ClientId == clientId)
            .GroupBy(s => s.ClientId)
            .Select(g => new { Spent = g.Sum(s => s.TotalAmount), Orders = g.Count() })
            .FirstOrDefaultAsync(ct);

        var onlineAgg = await _unitOfWork.Set<OnlineOrder>()
            .Where(o => o.ClientId == clientId && !ExcludedOnlineStatuses.Contains(o.Status))
            .GroupBy(o => o.ClientId)
            .Select(g => new { Spent = g.Sum(o => o.TotalAmount), Orders = g.Count() })
            .FirstOrDefaultAsync(ct);

        var itemizedSpent = (saleAgg?.Spent ?? 0m) + (onlineAgg?.Spent ?? 0m);
        var itemizedOrders = (saleAgg?.Orders ?? 0) + (onlineAgg?.Orders ?? 0);

        return itemizedOrders > 0
            ? (itemizedSpent, itemizedOrders)
            : (shopifyTotalSpent ?? 0m, shopifyOrdersCount ?? 0);
    }

    private static string CategoryLabel(ClientCategory category) => category switch
    {
        ClientCategory.Premium => "Client Premium",
        ClientCategory.Bon => "Bon Client",
        _ => "Nouveau Client"
    };
}
