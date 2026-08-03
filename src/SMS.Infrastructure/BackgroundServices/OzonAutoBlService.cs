using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SMS.Application.Interfaces;

namespace SMS.Infrastructure.BackgroundServices;

/// <summary>
/// Drains the OzonExpress BL queue: for each newly created parcel, creates its single-parcel
/// "Bon de Livraison" so the official OzonExpress label PDF (barcode/QR code) becomes available
/// within a few seconds, without the parcel-creation request itself waiting on it.
/// </summary>
public class OzonAutoBlService : BackgroundService
{
    private readonly IOzonBlQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OzonAutoBlService> _logger;

    public OzonAutoBlService(IOzonBlQueue queue, IServiceScopeFactory scopeFactory, ILogger<OzonAutoBlService> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("OzonExpress auto-BL worker started");

        await foreach (var trackingNumber in _queue.DequeueAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<IOzonExpressService>();

                var result = await service.AutoCreateDeliveryNoteAsync(trackingNumber, stoppingToken);

                if (result.Ok)
                    _logger.LogInformation("Auto BL/label created for parcel {Tracking}", trackingNumber);
                else
                    _logger.LogWarning("Auto BL/label failed for parcel {Tracking}: {Error}", trackingNumber, result.Error);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled error auto-creating BL for parcel {Tracking}", trackingNumber);
            }
        }

        _logger.LogInformation("OzonExpress auto-BL worker stopped");
    }
}
