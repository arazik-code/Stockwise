using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SMS.Application.Interfaces;

namespace SMS.Infrastructure.BackgroundServices;

// Periodically refreshes tracking status for all active OzonExpress parcels so the delivery
// dashboard and order views stay up to date without manual "sync" clicks.
public class OzonTrackingSyncService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(2);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OzonTrackingSyncService> _logger;

    public OzonTrackingSyncService(IServiceScopeFactory scopeFactory, ILogger<OzonTrackingSyncService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("OzonExpress tracking sync service started. Interval: {Interval}min", Interval.TotalMinutes);

        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var ozon = scope.ServiceProvider.GetRequiredService<IOzonExpressService>();
                var result = await ozon.SyncAllTrackingAsync(stoppingToken);
                if (result.Synced > 0)
                    _logger.LogInformation("OzonExpress auto-tracking: {Synced} parcels checked, {Updated} updated", result.Synced, result.Updated);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "OzonExpress auto-tracking sync failed");
            }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }
}
