using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SMS.Application.DTOs;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

/// <summary>
/// Auto-categorization rule for the loyalty tier (Nouveau/Bon/Premium), based purely on cumulative
/// purchase total: Nouveau by default, Bon once total purchases exceed 1500 DH, Premium once they
/// exceed 5000 DH. Deliberately simple and spend-only - no order-count or account-age factor -
/// independent of the CRM's separate, marketing-oriented ClientSegment (see
/// ClientCrmAppService.DetermineSegment), which answers a different question.
/// </summary>
public static class ClientCategoryEngine
{
    public const decimal PremiumSpendThreshold = 5000m;
    public const decimal BonSpendThreshold = 1500m;

    public static ClientCategory Determine(decimal effectiveSpent)
    {
        if (effectiveSpent > PremiumSpendThreshold)
            return ClientCategory.Premium;

        if (effectiveSpent > BonSpendThreshold)
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
        var effectiveSpent = await ComputeEffectiveSpendAsync(client.Id, client.ShopifyTotalSpent, ct);
        ApplyComputed(client, effectiveSpent, settings);
    }

    public async Task<Client> SetManualCategoryAsync(int clientId, ClientCategory? manualCategory, string? reason, CancellationToken ct = default)
    {
        var client = await _unitOfWork.Clients.GetByIdAsync(clientId, ct)
            ?? throw new KeyNotFoundException($"Client {clientId} not found");

        var settings = _loyaltySettings;

        // Refresh ComputedCategory (and TotalSpent) too, so clearing the override falls back to an
        // up-to-date suggestion rather than whatever was last computed (possibly a while ago).
        var effectiveSpent = await ComputeEffectiveSpendAsync(client.Id, client.ShopifyTotalSpent, ct);
        client.TotalSpent = effectiveSpent;
        client.ComputedCategory = ClientCategoryEngine.Determine(effectiveSpent);
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
            .Select(g => new { ClientId = g.Key, Spent = g.Sum(s => s.TotalAmount) })
            .ToListAsync(ct);

        var onlineAgg = await _unitOfWork.Set<OnlineOrder>()
            .Where(o => o.ClientId != null && clientIds.Contains(o.ClientId.Value) && !ExcludedOnlineStatuses.Contains(o.Status))
            .GroupBy(o => o.ClientId!.Value)
            .Select(g => new { ClientId = g.Key, Spent = g.Sum(o => o.TotalAmount) })
            .ToListAsync(ct);

        var itemizedSpentByClient = new Dictionary<int, decimal>();
        foreach (var row in saleAgg)
            itemizedSpentByClient[row.ClientId] = itemizedSpentByClient.GetValueOrDefault(row.ClientId) + row.Spent;
        foreach (var row in onlineAgg)
            itemizedSpentByClient[row.ClientId] = itemizedSpentByClient.GetValueOrDefault(row.ClientId) + row.Spent;

        var recomputed = 0;
        foreach (var idBatch in clientIds.Chunk(200))
        {
            var clients = await _unitOfWork.Set<Client>().Where(c => idBatch.Contains(c.Id)).ToListAsync(ct);
            foreach (var client in clients)
            {
                var itemizedSpent = itemizedSpentByClient.GetValueOrDefault(client.Id);
                // Shopify's lifetime customer figure is authoritative for that channel and may cover
                // orders that were never itemized locally (partial/incomplete sync) - take whichever
                // source shows more so a Shopify client's real purchase total is never undercounted,
                // without double-counting orders that WERE itemized locally (itemized already includes
                // them, so it's naturally >= the Shopify figure in that case).
                var effectiveSpent = Math.Max(itemizedSpent, client.ShopifyTotalSpent ?? 0m);
                ApplyComputed(client, effectiveSpent, settings);
                recomputed++;
            }

            await _unitOfWork.SaveChangesAsync(ct);
            _unitOfWork.ClearChangeTracker();
        }

        return recomputed;
    }

    private void ApplyComputed(Client client, decimal effectiveSpent, LoyaltySettings settings)
    {
        // TotalSpent is the figure shown in the Loyalty section - keeping it in sync here (rather
        // than only ever incrementing it per-transaction) is what makes a Shopify client's purchases
        // actually show up there, including lifetime spend that predates or wasn't itemized locally.
        client.TotalSpent = effectiveSpent;
        client.ComputedCategory = ClientCategoryEngine.Determine(effectiveSpent);
        client.EffectiveCategory = client.ManualCategory ?? client.ComputedCategory;
        client.LoyaltyRate = _rateResolver.GetRate(client, settings);
        client.CategoryUpdatedAt = DateTime.UtcNow;
    }

    private async Task<decimal> ComputeEffectiveSpendAsync(int clientId, decimal? shopifyTotalSpent, CancellationToken ct)
    {
        var saleSpent = await _unitOfWork.Set<Sale>()
            .Where(s => s.ClientId == clientId)
            .SumAsync(s => (decimal?)s.TotalAmount, ct) ?? 0m;

        var onlineSpent = await _unitOfWork.Set<OnlineOrder>()
            .Where(o => o.ClientId == clientId && !ExcludedOnlineStatuses.Contains(o.Status))
            .SumAsync(o => (decimal?)o.TotalAmount, ct) ?? 0m;

        var itemizedSpent = saleSpent + onlineSpent;
        return Math.Max(itemizedSpent, shopifyTotalSpent ?? 0m);
    }

    private static string CategoryLabel(ClientCategory category) => category switch
    {
        ClientCategory.Premium => "Client Premium",
        ClientCategory.Bon => "Bon Client",
        _ => "Nouveau Client"
    };
}
