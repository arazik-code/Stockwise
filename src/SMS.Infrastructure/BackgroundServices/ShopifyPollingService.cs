using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;

namespace SMS.Infrastructure.BackgroundServices;

public class ShopifyPollingService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ShopifyOptions _options;
    private readonly ILogger<ShopifyPollingService> _logger;

    public ShopifyPollingService(
        IServiceScopeFactory scopeFactory,
        IOptions<ShopifyOptions> options,
        ILogger<ShopifyPollingService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Orders are polled on a fast cadence (near-real-time); the heavier inventory push runs on the
        // slower PollingIntervalSeconds cadence to avoid hammering Shopify's REST rate limits.
        var orderInterval = TimeSpan.FromSeconds(Math.Max(5, _options.OrderPollingIntervalSeconds));
        var inventoryEveryNLoops = Math.Max(1, _options.PollingIntervalSeconds / (int)orderInterval.TotalSeconds);

        _logger.LogInformation("Shopify Polling started. Orders every {OrderInterval}s, inventory every {InvInterval}s",
            orderInterval.TotalSeconds, _options.PollingIntervalSeconds);

        var loop = 0;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var syncService = scope.ServiceProvider.GetRequiredService<IShopifySyncService>();

                await syncService.SyncRecentOrdersAsync(stoppingToken);

                if (loop % inventoryEveryNLoops == 0)
                    await syncService.SyncInventoryLevelsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Shopify polling sync failed");
            }

            loop++;
            try { await Task.Delay(orderInterval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }
}
