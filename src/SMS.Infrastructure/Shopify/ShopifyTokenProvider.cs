using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;

namespace SMS.Infrastructure.Shopify;

public class ShopifyTokenProvider : IShopifyTokenProvider
{
    public const string HttpClientName = "ShopifyOAuth";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ShopifyOptions _options;
    private readonly ILogger<ShopifyTokenProvider> _logger;
    private readonly SemaphoreSlim _lock = new(1, 1);

    private string? _cachedToken;
    private DateTime _expiresAtUtc = DateTime.MinValue;

    public ShopifyTokenProvider(IHttpClientFactory httpClientFactory, IOptions<ShopifyOptions> options, ILogger<ShopifyTokenProvider> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string?> GetAccessTokenAsync(CancellationToken ct = default)
    {
        // Classic custom-app token: static, never expires, used as-is.
        if (!string.IsNullOrEmpty(_options.AccessToken))
            return _options.AccessToken;

        // Dev Dashboard app: client_credentials OAuth grant, expires ~24h, must be refreshed.
        if (string.IsNullOrEmpty(_options.ShopDomain) || string.IsNullOrEmpty(_options.ClientId) || string.IsNullOrEmpty(_options.ClientSecret))
            return null;

        if (_cachedToken is not null && DateTime.UtcNow < _expiresAtUtc)
            return _cachedToken;

        await _lock.WaitAsync(ct);
        try
        {
            if (_cachedToken is not null && DateTime.UtcNow < _expiresAtUtc)
                return _cachedToken;

            var http = _httpClientFactory.CreateClient(HttpClientName);
            var response = await http.PostAsJsonAsync(
                $"https://{_options.ShopDomain}/admin/oauth/access_token",
                new { grant_type = "client_credentials", client_id = _options.ClientId, client_secret = _options.ClientSecret },
                ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Failed to obtain Shopify OAuth access token: {Status}", response.StatusCode);
                return null;
            }

            var payload = await response.Content.ReadFromJsonAsync<ShopifyTokenResponse>(cancellationToken: ct);
            if (string.IsNullOrEmpty(payload?.AccessToken))
                return null;

            _cachedToken = payload.AccessToken;
            _expiresAtUtc = DateTime.UtcNow.AddSeconds(Math.Max(payload.ExpiresIn - 300, 60));
            return _cachedToken;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to exchange Shopify client credentials for an access token");
            return null;
        }
        finally
        {
            _lock.Release();
        }
    }

    private record ShopifyTokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("expires_in")] int ExpiresIn);
}
