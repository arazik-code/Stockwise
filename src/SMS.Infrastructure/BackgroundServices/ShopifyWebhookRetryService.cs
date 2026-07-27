using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SMS.Application.DTOs.Shopify;
using SMS.Domain.Entities;
using SMS.Infrastructure.Data;

namespace SMS.Infrastructure.BackgroundServices;

public class ShopifyWebhookRetryService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ShopifyOptions _options;
    private readonly ILogger<ShopifyWebhookRetryService> _logger;

    public ShopifyWebhookRetryService(
        IServiceScopeFactory scopeFactory,
        IOptions<ShopifyOptions> options,
        ILogger<ShopifyWebhookRetryService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Shopify Webhook Retry Service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var failedWebhooks = await db.Set<FailedWebhook>()
                    .Where(f => f.RetryCount < _options.MaxRetryAttempts && !f.Processed)
                    .OrderBy(f => f.CreatedAt)
                    .Take(10)
                    .ToListAsync(stoppingToken);

                foreach (var webhook in failedWebhooks)
                {
                    try
                    {
                        webhook.RetryCount++;
                        webhook.LastRetryAt = DateTime.UtcNow;
                        _logger.LogInformation("Retrying webhook {WebhookId}, attempt {Attempt}",
                            webhook.Id, webhook.RetryCount);

                        if (webhook.RetryCount >= _options.MaxRetryAttempts)
                        {
                            webhook.Processed = true;
                            webhook.ErrorMessage = "Max retries exceeded";
                            _logger.LogWarning("Webhook {WebhookId} permanently failed after {MaxRetries} attempts",
                                webhook.Id, _options.MaxRetryAttempts);
                        }
                    }
                    catch (Exception ex)
                    {
                        webhook.ErrorMessage = ex.Message;
                        _logger.LogError(ex, "Retry failed for webhook {WebhookId}", webhook.Id);
                    }
                }

                await db.SaveChangesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Webhook retry service error");
            }
        }
    }
}

public class FailedWebhook
{
    public int Id { get; set; }
    public string Topic { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;
    public string? ErrorMessage { get; set; }
    public int RetryCount { get; set; }
    public bool Processed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastRetryAt { get; set; }
}
