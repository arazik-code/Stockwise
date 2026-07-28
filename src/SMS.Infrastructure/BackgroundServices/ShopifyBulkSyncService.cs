using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;
using SMS.Infrastructure.Data;

namespace SMS.Infrastructure.BackgroundServices;

/// <summary>
/// Runs a full "push local stock to Shopify" reconciliation on demand.
/// <para>
/// Reads Shopify's current levels in batches of 50 first and only writes the variants that
/// actually differ. On a catalog of ~2,949 linked variants that is ~60 reads instead of ~2,949
/// writes, so a normally-in-sync store finishes in well under a minute rather than ~25 minutes
/// of hammering Shopify's ~2 req/s ceiling.
/// </para>
/// </summary>
public class ShopifyBulkSyncService : BackgroundService, IShopifyBulkSync
{
    private const int ReadBatchSize = 50;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ShopifyOptions _options;
    private readonly ILogger<ShopifyBulkSyncService> _logger;
    private readonly Channel<bool> _trigger = Channel.CreateBounded<bool>(1);
    private readonly ShopifyBulkSyncProgress _progress = new();
    private readonly object _lock = new();

    public ShopifyBulkSyncService(
        IServiceScopeFactory scopeFactory,
        IOptions<ShopifyOptions> options,
        ILogger<ShopifyBulkSyncService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    public bool TryStart()
    {
        lock (_lock)
        {
            if (_progress.IsRunning) return false;
            _progress.IsRunning = true;
            _progress.Phase = "Demarrage...";
            _progress.StartedAt = DateTime.UtcNow;
            _progress.FinishedAt = null;
            _progress.TotalLinked = 0;
            _progress.Compared = 0;
            _progress.Differing = 0;
            _progress.Pushed = 0;
            _progress.Failed = 0;
            _progress.LastError = null;
            _progress.Recent = [];
        }

        return _trigger.Writer.TryWrite(true);
    }

    public ShopifyBulkSyncProgress GetProgress()
    {
        lock (_lock)
        {
            return new ShopifyBulkSyncProgress
            {
                IsRunning = _progress.IsRunning,
                Phase = _progress.Phase,
                TotalLinked = _progress.TotalLinked,
                Compared = _progress.Compared,
                Differing = _progress.Differing,
                Pushed = _progress.Pushed,
                Failed = _progress.Failed,
                StartedAt = _progress.StartedAt,
                FinishedAt = _progress.FinishedAt,
                LastError = _progress.LastError,
                Recent = [.. _progress.Recent]
            };
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var _ in _trigger.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await RunAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Shopify bulk sync failed");
                Update(p => { p.LastError = ex.Message; p.Phase = "Echec"; });
            }
            finally
            {
                Update(p => { p.IsRunning = false; p.FinishedAt = DateTime.UtcNow; });
            }
        }
    }

    private async Task RunAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var pusher = scope.ServiceProvider.GetRequiredService<IShopifyInventoryPusher>();
        var client = scope.ServiceProvider.GetService<IShopifyApiClient>();

        if (client is null)
        {
            Update(p => { p.Phase = "Shopify non configure"; p.LastError = "Client Shopify absent."; });
            return;
        }

        if (!long.TryParse(_options.LocationId, out var locationId) || locationId == 0)
        {
            Update(p => { p.Phase = "Emplacement non configure"; p.LastError = "Shopify:LocationId manquant."; });
            return;
        }

        Update(p => p.Phase = "Lecture du stock local...");

        // Only linked variants can sync; anything else is surfaced by the "Liaison Shopify" page.
        var linked = await db.ProductVariants
            .AsNoTracking()
            .Where(v => v.ShopifyVariantId != null && v.ShopifyVariantId != 0)
            .Select(v => new
            {
                VariantId = v.Id,
                ShopifyVariantId = v.ShopifyVariantId!.Value,
                Quantity = v.StockItem != null ? v.StockItem.QuantityOnHand : 0
            })
            .ToListAsync(ct);

        var itemIdByShopifyVariant = await db.ShopifyProducts
            .AsNoTracking()
            .Where(sp => sp.ShopifyInventoryItemId != 0)
            .Select(sp => new { sp.ShopifyVariantId, sp.ShopifyInventoryItemId })
            .ToListAsync(ct);

        var itemMap = itemIdByShopifyVariant
            .GroupBy(x => x.ShopifyVariantId)
            .ToDictionary(g => g.Key, g => g.First().ShopifyInventoryItemId);

        var targets = linked
            .Where(l => itemMap.ContainsKey(l.ShopifyVariantId))
            .Select(l => (l.VariantId, ItemId: itemMap[l.ShopifyVariantId], l.Quantity))
            .ToList();

        Update(p => { p.TotalLinked = targets.Count; p.Phase = "Comparaison avec Shopify..."; });

        var needsPush = new List<(int VariantId, int LocalQty, int RemoteQty)>();

        foreach (var batch in Chunk(targets, ReadBatchSize))
        {
            ct.ThrowIfCancellationRequested();

            var ids = batch.Select(b => b.ItemId).ToList();
            IReadOnlyList<ShopifyInventoryLevelItem> levels;
            try
            {
                levels = await client.GetInventoryLevelsAsync(ids, locationId, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Bulk sync: failed to read a batch of inventory levels");
                Update(p => p.Failed += batch.Count);
                continue;
            }

            var remoteByItem = levels.ToDictionary(l => l.InventoryItemId, l => l.Available);

            foreach (var (variantId, itemId, localQty) in batch)
            {
                if (remoteByItem.TryGetValue(itemId, out var remoteQty) && remoteQty == localQty) continue;
                needsPush.Add((variantId, localQty, remoteByItem.TryGetValue(itemId, out var r) ? r : -1));
            }

            Update(p => { p.Compared += batch.Count; p.Differing = needsPush.Count; });

            // Stay under Shopify's ~2 requests/second ceiling.
            await Task.Delay(550, ct);
        }

        Update(p => p.Phase = $"Mise a jour de {needsPush.Count} variante(s)...");

        foreach (var (variantId, localQty, remoteQty) in needsPush)
        {
            ct.ThrowIfCancellationRequested();

            try
            {
                var result = await pusher.PushVariantAsync(variantId, ct);
                if (result.Success)
                {
                    Update(p =>
                    {
                        p.Pushed++;
                        AddRecent(p, $"Variante {variantId}: Shopify {remoteQty} -> {localQty}");
                    });
                }
                else
                {
                    Update(p =>
                    {
                        p.Failed++;
                        AddRecent(p, $"Variante {variantId}: echec - {result.Message}");
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Bulk sync: push failed for variant {VariantId}", variantId);
                Update(p => { p.Failed++; AddRecent(p, $"Variante {variantId}: erreur - {ex.Message}"); });
            }

            await Task.Delay(550, ct);
        }

        Update(p => p.Phase = p.Failed > 0 ? "Termine avec des erreurs" : "Termine");
        _logger.LogInformation("Shopify bulk sync finished: {Pushed} pushed, {Failed} failed, {Total} compared",
            _progress.Pushed, _progress.Failed, _progress.Compared);
    }

    private static void AddRecent(ShopifyBulkSyncProgress p, string line)
    {
        p.Recent.Insert(0, line);
        if (p.Recent.Count > 50) p.Recent.RemoveAt(p.Recent.Count - 1);
    }

    private void Update(Action<ShopifyBulkSyncProgress> mutate)
    {
        lock (_lock) mutate(_progress);
    }

    private static IEnumerable<List<T>> Chunk<T>(List<T> source, int size)
    {
        for (var i = 0; i < source.Count; i += size)
            yield return source.GetRange(i, Math.Min(size, source.Count - i));
    }
}
