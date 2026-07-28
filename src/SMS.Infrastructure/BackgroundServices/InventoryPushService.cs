using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SMS.Application.Interfaces;

namespace SMS.Infrastructure.BackgroundServices;

/// <summary>
/// Drains the inventory push queue and sends each changed variant's stock level to Shopify.
/// Runs for the lifetime of the app with its own DI scope per item, so it is completely
/// independent of whichever HTTP request happened to trigger the change.
/// </summary>
public class InventoryPushService : BackgroundService
{
    private readonly IInventoryPushQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<InventoryPushService> _logger;

    public InventoryPushService(
        IInventoryPushQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<InventoryPushService> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Inventory push worker started");

        await foreach (var productVariantId in _queue.DequeueAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var pusher = scope.ServiceProvider.GetRequiredService<IShopifyInventoryPusher>();

                var result = await pusher.PushVariantAsync(productVariantId, stoppingToken);

                // Every outcome is logged at a visible level. The old code path had four different
                // silent `return`/`continue` branches, which is why this failed invisibly for so long.
                if (result.Success)
                {
                    _logger.LogInformation("Shopify push OK for variant {VariantId}: qty {Qty} (item {ItemId})",
                        productVariantId, result.QuantityPushed, result.InventoryItemId);
                }
                else
                {
                    _logger.LogWarning("Shopify push skipped/failed for variant {VariantId}: {Outcome} - {Message}",
                        productVariantId, result.Outcome, result.Message);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled error pushing inventory for variant {VariantId}", productVariantId);
            }

            // Shopify's REST admin API sustains ~2 requests/second; a multi-line sale would otherwise
            // burst straight into 429s.
            try { await Task.Delay(400, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }

        _logger.LogInformation("Inventory push worker stopped");
    }
}
