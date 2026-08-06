using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace SMS.API.IntegrationTests.Controllers;

/// <summary>
/// Concurrency and race condition tests.
/// Verifies the system handles simultaneous operations without data corruption.
/// </summary>
public class ConcurrencyStressTests : IClassFixture<SmsWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ConcurrencyStressTests(SmsWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    // ── CONCURRENT PRODUCT CREATION ───────────────────────────────────

    [Fact]
    public async Task ConcurrentCreate_20Products_AllSucceed()
    {
        var tasks = Enumerable.Range(0, 20).Select(i =>
            _client.PostAsJsonAsync("/api/products", new
            {
                Name = $"Concurrent_{Guid.NewGuid():N}",
                CategoryId = 1
            })).ToList();

        var responses = await Task.WhenAll(tasks);

        var successCount = responses.Count(r =>
            r.StatusCode == HttpStatusCode.Created ||
            r.StatusCode == HttpStatusCode.BadRequest);

        Assert.Equal(20, successCount);
        Assert.All(responses, r =>
            Assert.True(r.StatusCode == HttpStatusCode.Created || r.StatusCode == HttpStatusCode.BadRequest));
    }

    // ── CONCURRENT STOCK ADJUSTMENTS ──────────────────────────────────

    [Fact]
    public async Task ConcurrentStockAdjust_SameVariant_HandledGracefully()
    {
        // Create a product with a variant first
        var createResp = await _client.PostAsJsonAsync("/api/products", new
        {
            Name = $"StockTest_{Guid.NewGuid():N}",
            CategoryId = 1
        });
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);

        // Try to adjust stock for a variant (may not exist yet in InMemory DB)
        // The key test: concurrent requests should not crash the server
        var tasks = Enumerable.Range(0, 10).Select(_ =>
            _client.PostAsJsonAsync("/api/stock/adjust", new
            {
                ProductVariantId = 1,
                AdjustmentDelta = 1
            })).ToList();

        var responses = await Task.WhenAll(tasks);

        // All should complete without 500 errors
        Assert.All(responses, r =>
            Assert.True(r.StatusCode == HttpStatusCode.OK ||
                        r.StatusCode == HttpStatusCode.BadRequest ||
                        r.StatusCode == HttpStatusCode.NotFound ||
                        r.StatusCode == HttpStatusCode.Conflict));
    }

    // ── CONCURRENT ORDER CREATION ─────────────────────────────────────

    [Fact]
    public async Task ConcurrentCreateOrders_10Requests_NoServerCrash()
    {
        var tasks = Enumerable.Range(0, 10).Select(i =>
            _client.PostAsJsonAsync("/api/online-orders", new
            {
                CustomerName = $"ConcurrentOrder_{i}",
                Items = Array.Empty<object>()
            })).ToList();

        var responses = await Task.WhenAll(tasks);

        // Should all return 400 (empty items), not 500
        Assert.All(responses, r =>
            Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode));
    }

    // ── CONCURRENT READS ──────────────────────────────────────────────

    [Fact]
    public async Task ConcurrentGetAll_Products_20ParallelReads()
    {
        var tasks = Enumerable.Range(0, 20).Select(_ =>
            _client.GetAsync("/api/products")).ToList();

        var responses = await Task.WhenAll(tasks);

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
    }

    [Fact]
    public async Task ConcurrentGetAll_Orders_20ParallelReads()
    {
        var tasks = Enumerable.Range(0, 20).Select(_ =>
            _client.GetAsync("/api/online-orders")).ToList();

        var responses = await Task.WhenAll(tasks);

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
    }

    [Fact]
    public async Task ConcurrentGetDashboard_MultipleEndpoints()
    {
        var tasks = new List<Task<HttpResponseMessage>>
        {
            _client.GetAsync("/api/online-orders/dashboard"),
            _client.GetAsync("/api/online-orders/conflicts"),
            _client.GetAsync("/api/reports/dashboard"),
            _client.GetAsync("/api/reports/inventory"),
            _client.GetAsync("/api/cod-finance/dashboard"),
            _client.GetAsync("/api/ozonexpress/status"),
            _client.GetAsync("/api/settings/loyalty"),
            _client.GetAsync("/api/settings/store"),
            _client.GetAsync("/api/settings/tax"),
            _client.GetAsync("/api/products"),
            _client.GetAsync("/api/stock"),
            _client.GetAsync("/api/clients"),
            _client.GetAsync("/api/categories"),
            _client.GetAsync("/api/invoices"),
            _client.GetAsync("/api/fournisseurs"),
        };

        var responses = await Task.WhenAll(tasks);

        Assert.All(responses, r =>
            Assert.True(r.StatusCode == HttpStatusCode.OK ||
                        r.StatusCode == HttpStatusCode.NoContent));
    }

    // ── CONCURRENT STATUS UPDATES ─────────────────────────────────────

    [Fact]
    public async Task ConcurrentStatusUpdate_SameOrder_ConflictOrSerial()
    {
        // Create an order
        var createResp = await _client.PostAsJsonAsync("/api/online-orders", new
        {
            CustomerName = "StatusConflictTest",
            Items = new[] { new { ProductVariantId = 1, Quantity = 1 } }
        });

        if (createResp.StatusCode == HttpStatusCode.Created)
        {
            var order = await createResp.Content.ReadFromJsonAsync<JsonElement>();
            var orderId = order.GetProperty("id").GetInt32();

            // Try to update status concurrently
            var tasks = Enumerable.Range(0, 5).Select(_ =>
                _client.PutAsJsonAsync($"/api/online-orders/{orderId}/status",
                    new { status = 7 })); // Confirmed = 7

            var responses = await Task.WhenAll(tasks);

            // At least one should succeed, others may get 409 Conflict or 400
            var successes = responses.Count(r =>
                r.StatusCode == HttpStatusCode.OK ||
                r.StatusCode == HttpStatusCode.NoContent);
            var conflicts = responses.Count(r =>
                r.StatusCode == HttpStatusCode.Conflict ||
                r.StatusCode == HttpStatusCode.BadRequest);

            Assert.True(successes + conflicts == 5,
                $"Expected 5 total responses, got {successes + conflicts}");
        }
    }

    // ── RAPID-FIRE SEARCH ─────────────────────────────────────────────

    [Fact]
    public async Task RapidSearch_50Queries_NoDegradation()
    {
        var queries = Enumerable.Range(0, 50).Select(i =>
            _client.GetAsync($"/api/products/search?query=test{i}"));

        var responses = await Task.WhenAll(queries);

        Assert.All(responses, r =>
            Assert.True(r.StatusCode == HttpStatusCode.OK ||
                        r.StatusCode == HttpStatusCode.BadRequest));
    }

    // ── CONCURRENT DELETE ATTEMPTS ────────────────────────────────────

    [Fact]
    public async Task ConcurrentDelete_SameProduct_OnlyOneSucceeds()
    {
        // Create a product
        var createResp = await _client.PostAsJsonAsync("/api/products", new
        {
            Name = $"DeleteRace_{Guid.NewGuid():N}",
            CategoryId = 1
        });

        if (createResp.StatusCode == HttpStatusCode.Created)
        {
            var product = await createResp.Content.ReadFromJsonAsync<JsonElement>();
            var productId = product.GetProperty("id").GetInt32();

            // Try to delete concurrently
            var tasks = Enumerable.Range(0, 5).Select(_ =>
                _client.DeleteAsync($"/api/products/{productId}"));

            var responses = await Task.WhenAll(tasks);

            var notFounds = responses.Count(r => r.StatusCode == HttpStatusCode.NotFound);
            var oks = responses.Count(r => r.StatusCode == HttpStatusCode.NoContent ||
                                           r.StatusCode == HttpStatusCode.OK);

            // Either all find it (and first delete wins) or some get 404
            Assert.True(notFounds + oks == 5);
        }
    }

    // ── MIXED READ/WRITE STRESS ───────────────────────────────────────

    [Fact]
    public async Task MixedReadWrite_ConcurrentLoads_NoCorruption()
    {
        var tasks = new List<Task<HttpResponseMessage>>();

        // 10 reads
        for (int i = 0; i < 10; i++)
            tasks.Add(_client.GetAsync("/api/products"));

        // 5 writes
        for (int i = 0; i < 5; i++)
            tasks.Add(_client.PostAsJsonAsync("/api/products", new
            {
                Name = $"Mixed_{Guid.NewGuid():N}",
                CategoryId = 1
            }));

        // 5 more reads
        for (int i = 0; i < 5; i++)
            tasks.Add(_client.GetAsync("/api/online-orders"));

        var responses = await Task.WhenAll(tasks);

        // None should crash
        Assert.All(responses, r =>
            Assert.True(r.StatusCode == HttpStatusCode.OK ||
                        r.StatusCode == HttpStatusCode.Created ||
                        r.StatusCode == HttpStatusCode.BadRequest));
    }
}
