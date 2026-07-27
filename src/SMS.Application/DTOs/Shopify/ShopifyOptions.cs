namespace SMS.Application.DTOs.Shopify;

public class ShopifyOptions
{
    public string ShopDomain { get; set; } = string.Empty;
    public string AccessToken { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string ApiVersion { get; set; } = "2025-01";
    public string WebhookSecret { get; set; } = string.Empty;
    public int PollingIntervalSeconds { get; set; } = 300;
    // How often to poll Shopify for NEW ORDERS (near-real-time). Kept separate from the heavier
    // inventory sync above. Min is clamped to 5s to respect Shopify's REST rate limits.
    public int OrderPollingIntervalSeconds { get; set; } = 10;
    public string LocationId { get; set; } = string.Empty;
    public int MaxRetryAttempts { get; set; } = 3;
}
