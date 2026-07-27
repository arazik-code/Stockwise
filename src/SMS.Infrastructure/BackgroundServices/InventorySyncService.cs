using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SMS.Application.Interfaces;

namespace SMS.Infrastructure.BackgroundServices;

public class InventorySyncService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<InventorySyncService> _logger;

    public InventorySyncService(
        IServiceScopeFactory scopeFactory,
        ILogger<InventorySyncService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Inventory Sync Service started");

        try
        {
            using var scope = _scopeFactory.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<IShopifySyncService>();

            _logger.LogInformation("Running initial Shopify sync...");
            await syncService.SyncRecentOrdersAsync(stoppingToken);
            await syncService.SyncInventoryLevelsAsync(stoppingToken);
            _logger.LogInformation("Initial Shopify sync completed");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Initial Shopify sync failed");
        }

        var reconciliationInterval = TimeSpan.FromHours(6);
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(reconciliationInterval, stoppingToken);

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var syncService = scope.ServiceProvider.GetRequiredService<IShopifySyncService>();

                _logger.LogInformation("Running periodic inventory reconciliation...");
                await syncService.SyncInventoryLevelsAsync(stoppingToken);
                _logger.LogInformation("Periodic reconciliation completed");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Periodic inventory reconciliation failed");
            }
        }
    }
}
