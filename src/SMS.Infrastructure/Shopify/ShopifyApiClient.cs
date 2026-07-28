using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;
using SMS.Infrastructure.Shopify.Models;

namespace SMS.Infrastructure.Shopify;

public class ShopifyApiClient : IShopifyApiClient
{
    // Shopify's REST API returns snake_case JSON (e.g. total_price); our DTOs use PascalCase.
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    private readonly HttpClient _http;
    private readonly ShopifyOptions _options;
    private readonly ILogger<ShopifyApiClient> _logger;

    public ShopifyApiClient(
        HttpClient httpClient,
        IOptions<ShopifyOptions> options,
        ILogger<ShopifyApiClient> logger)
    {
        _http = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<bool> UpdateInventoryLevelAsync(
        long inventoryItemId, long locationId, int available,
        CancellationToken ct = default)
    {
        var url = $"/admin/api/{_options.ApiVersion}/inventory_levels/set.json";
        var payload = new
        {
            location_id = locationId,
            inventory_item_id = inventoryItemId,
            available
        };

        const int maxAttempts = 4;
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                var response = await _http.PostAsJsonAsync(url, payload, ct);

                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests && attempt < maxAttempts)
                {
                    var retryAfter = response.Headers.RetryAfter?.Delta ?? TimeSpan.FromSeconds(2);
                    _logger.LogWarning("Shopify rate limit hit updating inventory item {InventoryItemId}, retrying in {Delay}s (attempt {Attempt}/{Max})",
                        inventoryItemId, retryAfter.TotalSeconds, attempt, maxAttempts);
                    await Task.Delay(retryAfter, ct);
                    continue;
                }

                response.EnsureSuccessStatusCode();
                return true;
            }
            catch (Exception ex)
            {
                if (attempt >= maxAttempts)
                {
                    _logger.LogError(ex, "Failed to update inventory level for item {InventoryItemId}", inventoryItemId);
                    return false;
                }
            }
        }

        return false;
    }

    public async Task<ShopifyProductListResponse?> GetProductsAsync(
        int limit = 50, string? pageInfo = null, CancellationToken ct = default)
    {
        var query = $"limit={limit}";
        if (pageInfo is not null) query += $"&page_info={pageInfo}";

        var url = $"/admin/api/{_options.ApiVersion}/products.json?{query}";
        return await GetOrLogAsync<ShopifyProductListResponse>(url, ct);
    }

    public async Task<ShopifyOrderListResponse?> GetOrdersAsync(
        string status = "any", int limit = 50,
        DateTime? createdAtMin = null, string? pageInfo = null,
        CancellationToken ct = default)
    {
        var query = $"status={status}&limit={limit}";
        if (pageInfo is not null)
        {
            query += $"&page_info={pageInfo}";
        }
        else
        {
            // Newest-first so a busy day with >limit orders never drops the most recent ones from the
            // recent-orders sync. (order can't be combined with page_info, hence the branch.)
            if (createdAtMin.HasValue) query += $"&created_at_min={createdAtMin.Value:O}";
            query += "&order=created_at+desc";
        }

        var url = $"/admin/api/{_options.ApiVersion}/orders.json?{query}";
        return await GetOrLogAsync<ShopifyOrderListResponse>(url, ct);
    }

    public async Task<ShopifyVariantItem?> GetVariantAsync(long shopifyVariantId, CancellationToken ct = default)
    {
        var url = $"/admin/api/{_options.ApiVersion}/variants/{shopifyVariantId}.json";
        var response = await GetOrLogAsync<ShopifyVariantResponse>(url, ct);
        return response?.Variant;
    }

    public async Task<ShopifyLocationListResponse?> GetLocationsAsync(CancellationToken ct = default)
    {
        var url = $"/admin/api/{_options.ApiVersion}/locations.json";
        return await GetOrLogAsync<ShopifyLocationListResponse>(url, ct);
    }

    public async Task<List<ShopifyProductItem>> GetAllProductsAsync(CancellationToken ct = default)
    {
        var all = new List<ShopifyProductItem>();
        string? pageInfo = null;

        do
        {
            var query = "limit=250";
            if (pageInfo is not null) query += $"&page_info={pageInfo}";

            var url = $"/admin/api/{_options.ApiVersion}/products.json?{query}";
            // Let failures throw here (rather than the swallow-and-return-null pattern used by GetOrLogAsync):
            // a bulk import must not silently report a partial catalog as if it were complete.
            var (data, nextPageInfo) = await GetPageWithRetryAsync<ShopifyProductListResponse>(url, ct);
            if (data?.Products is not null) all.AddRange(data.Products);

            pageInfo = nextPageInfo;
        } while (pageInfo is not null && !ct.IsCancellationRequested);

        return all;
    }

    public async Task<List<ShopifyCollectionItem>> GetAllCollectionsAsync(CancellationToken ct = default)
    {
        var all = new List<ShopifyCollectionItem>();

        var custom = await GetOrLogAsync<ShopifyCollectionListResponse>(
            $"/admin/api/{_options.ApiVersion}/custom_collections.json?limit=250", ct);
        if (custom?.CustomCollections is not null) all.AddRange(custom.CustomCollections);

        var smart = await GetOrLogAsync<ShopifySmartCollectionListResponse>(
            $"/admin/api/{_options.ApiVersion}/smart_collections.json?limit=250", ct);
        if (smart?.SmartCollections is not null) all.AddRange(smart.SmartCollections);

        return all;
    }

    public async Task<List<ShopifyCollectItem>> GetAllCollectsAsync(CancellationToken ct = default)
    {
        var all = new List<ShopifyCollectItem>();
        string? pageInfo = null;

        do
        {
            var query = "limit=250";
            if (pageInfo is not null) query += $"&page_info={pageInfo}";

            var url = $"/admin/api/{_options.ApiVersion}/collects.json?{query}";
            var (data, nextPageInfo) = await GetPageWithRetryAsync<ShopifyCollectListResponse>(url, ct);
            if (data?.Collects is not null) all.AddRange(data.Collects);

            pageInfo = nextPageInfo;
        } while (pageInfo is not null && !ct.IsCancellationRequested);

        return all;
    }

    public async Task<List<ShopifyCustomerItem>> GetAllCustomersAsync(CancellationToken ct = default)
    {
        var all = new List<ShopifyCustomerItem>();
        string? pageInfo = null;

        do
        {
            var query = "limit=250";
            if (pageInfo is not null) query += $"&page_info={pageInfo}";

            var url = $"/admin/api/{_options.ApiVersion}/customers.json?{query}";
            (ShopifyCustomerListResponse? Data, string? NextPageInfo) page;
            try
            {
                page = await GetPageWithRetryAsync<ShopifyCustomerListResponse>(url, ct);
            }
            catch (InvalidOperationException ex) when (
                ex.Message.Contains("requires merchant approval", StringComparison.OrdinalIgnoreCase) ||
                ex.Message.Contains("Forbidden", StringComparison.OrdinalIgnoreCase))
            {
                throw new ShopifyCustomerAccessNotApprovedException(
                    "Shopify n'a pas encore approuvé l'accès aux données clients protégées pour cette app. " +
                    "Demandez l'accès dans dev.shopify.com > API access > Protected customer data access.");
            }

            if (page.Data?.Customers is not null) all.AddRange(page.Data.Customers);
            pageInfo = page.NextPageInfo;
        } while (pageInfo is not null && !ct.IsCancellationRequested);

        return all;
    }

    public async Task<List<ShopifyOrderItem>> GetAllOrdersAsync(CancellationToken ct = default)
    {
        var all = new List<ShopifyOrderItem>();
        string? pageInfo = null;

        do
        {
            // When paginating via page_info, Shopify forbids other filter params (status/order),
            // so status=any&limit is only sent on the first page.
            var query = pageInfo is null ? "status=any&limit=250" : $"limit=250&page_info={pageInfo}";

            var url = $"/admin/api/{_options.ApiVersion}/orders.json?{query}";
            var (data, nextPageInfo) = await GetPageWithRetryAsync<ShopifyOrderListResponse>(url, ct);
            if (data?.Orders is not null) all.AddRange(data.Orders);

            pageInfo = nextPageInfo;
        } while (pageInfo is not null && !ct.IsCancellationRequested);

        return all;
    }

    private async Task<T?> GetOrLogAsync<T>(string url, CancellationToken ct) where T : class
    {
        try
        {
            return (await GetPageWithRetryAsync<T>(url, ct)).Data;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Shopify API call to {Url} failed", url);
            return null;
        }
    }

    // Retries on 429 (rate limit, honoring Shopify's Retry-After header) and on transient network/TLS
    // failures (occasional dropped connections on long-lived HttpClient pools). Throws on any other
    // failure so callers that need completeness (e.g. bulk import pagination) don't silently truncate.
    private async Task<(T? Data, string? NextPageInfo)> GetPageWithRetryAsync<T>(string url, CancellationToken ct, int maxAttempts = 6) where T : class
    {
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            HttpResponseMessage response;
            try
            {
                response = await _http.GetAsync(url, ct);
            }
            catch (Exception ex) when (ex is HttpRequestException or IOException && attempt < maxAttempts)
            {
                var delay = TimeSpan.FromSeconds(Math.Min(2 * attempt, 10));
                _logger.LogWarning(ex, "Transient network error calling {Url}, retrying in {Delay}s (attempt {Attempt}/{Max})",
                    url, delay.TotalSeconds, attempt, maxAttempts);
                await Task.Delay(delay, ct);
                continue;
            }

            if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests && attempt < maxAttempts)
            {
                var retryAfter = response.Headers.RetryAfter?.Delta ?? TimeSpan.FromSeconds(2);
                _logger.LogWarning("Shopify rate limit hit for {Url}, retrying in {Delay}s (attempt {Attempt}/{Max})",
                    url, retryAfter.TotalSeconds, attempt, maxAttempts);
                await Task.Delay(retryAfter, ct);
                continue;
            }

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                throw new InvalidOperationException($"Shopify API call to {url} failed with {response.StatusCode}: {body}");
            }

            T? data;
            try
            {
                data = await response.Content.ReadFromJsonAsync<T>(JsonOptions, ct);
            }
            catch (Exception ex) when (ex is HttpRequestException or IOException && attempt < maxAttempts)
            {
                var delay = TimeSpan.FromSeconds(Math.Min(2 * attempt, 10));
                _logger.LogWarning(ex, "Transient network error reading response from {Url}, retrying in {Delay}s (attempt {Attempt}/{Max})",
                    url, delay.TotalSeconds, attempt, maxAttempts);
                await Task.Delay(delay, ct);
                continue;
            }
            var nextPageInfo = ExtractNextPageInfo(response);
            return (data, nextPageInfo);
        }

        throw new InvalidOperationException($"Shopify API call to {url} failed after {maxAttempts} attempts due to rate limiting");
    }

    private static readonly Regex NextLinkRegex = new("<[^>]*[?&]page_info=([^&>]+)[^>]*>;\\s*rel=\"next\"", RegexOptions.Compiled);

    private static string? ExtractNextPageInfo(HttpResponseMessage response)
    {
        if (!response.Headers.TryGetValues("Link", out var values)) return null;
        var link = string.Join(", ", values);
        var match = NextLinkRegex.Match(link);
        return match.Success ? Uri.UnescapeDataString(match.Groups[1].Value) : null;
    }

    public async Task<bool> RegisterWebhookAsync(
        string topic, string callbackUrl, CancellationToken ct = default)
    {
        try
        {
            var url = $"/admin/api/{_options.ApiVersion}/webhooks.json";
            var payload = new
            {
                webhook = new
                {
                    topic,
                    address = callbackUrl,
                    format = "json"
                }
            };

            var response = await _http.PostAsJsonAsync(url, payload, ct);
            response.EnsureSuccessStatusCode();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to register webhook for topic {Topic}", topic);
            return false;
        }
    }
}
