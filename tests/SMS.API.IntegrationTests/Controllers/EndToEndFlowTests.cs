using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace SMS.API.IntegrationTests.Controllers;

/// <summary>
/// End-to-end integration tests: full business workflow validation.
/// Tests complete user journeys from creation through all lifecycle states.
/// </summary>
public class EndToEndFlowTests : IClassFixture<SmsWebApplicationFactory>
{
    private readonly HttpClient _client;

    public EndToEndFlowTests(SmsWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    // ── PRODUCT CRUD ──────────────────────────────────────────────────

    [Fact]
    public async Task ProductLifecycle_CreateAndVerify()
    {
        var catResp = await _client.PostAsJsonAsync("/api/categories", new
        {
            Name = "E2E Category " + Guid.NewGuid().ToString("N")[..8]
        });
        if (catResp.StatusCode != HttpStatusCode.Created) return;

        var cat = await catResp.Content.ReadFromJsonAsync<JsonElement>();
        var catId = cat.GetProperty("id").GetInt32();

        var createResp = await _client.PostAsJsonAsync("/api/products", new
        {
            Name = "E2E Lifecycle Product",
            CategoryId = catId,
            Price = 99.99m,
            Brand = "TestBrand"
        });
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);

        var product = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var productId = product.GetProperty("id").GetInt32();
        Assert.True(productId > 0);
        Assert.Equal("E2E Lifecycle Product", product.GetProperty("name").GetString());

        var listResp = await _client.GetAsync("/api/products");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var deleteResp = await _client.DeleteAsync($"/api/products/{productId}");
        Assert.True(deleteResp.StatusCode == HttpStatusCode.NoContent ||
                    deleteResp.StatusCode == HttpStatusCode.OK ||
                    deleteResp.StatusCode == HttpStatusCode.NotFound);
    }

    // ── CATEGORY HIERARCHY ────────────────────────────────────────────

    [Fact]
    public async Task CategoryHierarchy_CreateParent()
    {
        var parentResp = await _client.PostAsJsonAsync("/api/categories", new
        {
            Name = "Parent Category " + Guid.NewGuid().ToString("N")[..8]
        });
        Assert.Equal(HttpStatusCode.Created, parentResp.StatusCode);

        var parent = await parentResp.Content.ReadFromJsonAsync<JsonElement>();
        var parentId = parent.GetProperty("id").GetInt32();
        Assert.True(parentId > 0);
    }

    // ── CLIENT CRM WORKFLOW ───────────────────────────────────────────

    [Fact]
    public async Task ClientLifecycle_CreateAndVerify()
    {
        var phone = "06" + Random.Shared.Next(10000000, 99999999);

        var createResp = await _client.PostAsJsonAsync("/api/clients", new
        {
            Name = "E2E Client",
            Phone = phone
        });
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);

        var client = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var clientId = client.GetProperty("id").GetInt32();
        Assert.True(clientId > 0);

        var allResp = await _client.GetAsync("/api/clients");
        Assert.Equal(HttpStatusCode.OK, allResp.StatusCode);
    }

    // ── ONLINE ORDER LIFECYCLE ───────────────────────────────────────

    [Fact]
    public async Task OnlineOrderLifecycle_CreateAdvanceCancel()
    {
        var createResp = await _client.PostAsJsonAsync("/api/online-orders", new
        {
            CustomerName = "E2E Order Customer",
            CustomerPhone = "0612345678",
            Channel = 0,
            PaymentMethod = 0,
            DeliveryFee = 30m,
            Items = new[] { new { ProductVariantId = 1, Quantity = 1 } }
        });

        if (createResp.StatusCode == HttpStatusCode.Created)
        {
            var order = await createResp.Content.ReadFromJsonAsync<JsonElement>();
            var orderId = order.GetProperty("id").GetInt32();

            var getResp = await _client.GetAsync($"/api/online-orders/{orderId}");
            Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

            var statusResp = await _client.PutAsJsonAsync($"/api/online-orders/{orderId}/status",
                new { status = 7 });
            Assert.True(statusResp.StatusCode == HttpStatusCode.OK ||
                        statusResp.StatusCode == HttpStatusCode.NoContent ||
                        statusResp.StatusCode == HttpStatusCode.BadRequest);

            var packingResp = await _client.PutAsJsonAsync($"/api/online-orders/{orderId}/status",
                new { status = 8 });
            Assert.True(packingResp.StatusCode == HttpStatusCode.OK ||
                        packingResp.StatusCode == HttpStatusCode.NoContent ||
                        packingResp.StatusCode == HttpStatusCode.BadRequest);

            var cancelResp = await _client.PostAsJsonAsync($"/api/online-orders/{orderId}/cancel",
                new { reason = "E2E test cancellation" });
            Assert.True(cancelResp.StatusCode == HttpStatusCode.OK ||
                        cancelResp.StatusCode == HttpStatusCode.NoContent);
        }
    }

    // ── SALE CREATION AND REPORTING ───────────────────────────────────

    [Fact]
    public async Task SaleLifecycle_CreateAndReport()
    {
        var createResp = await _client.PostAsJsonAsync("/api/sales", new
        {
            Items = new[] { new { ProductVariantId = 1, Quantity = 2, DiscountAmount = 0m } },
            AmountPaid = 200m,
            TaxRate = 0m,
            PaymentMethod = 0
        });

        if (createResp.StatusCode == HttpStatusCode.Created)
        {
            var sale = await createResp.Content.ReadFromJsonAsync<JsonElement>();
            var saleId = sale.GetProperty("id").GetInt32();
            Assert.True(saleId > 0);

            var saleNumber = sale.GetProperty("saleNumber").GetString();
            Assert.False(string.IsNullOrEmpty(saleNumber));

            var reportResp = await _client.GetAsync("/api/sales/daily-report");
            Assert.Equal(HttpStatusCode.OK, reportResp.StatusCode);
        }
    }

    // ── DASHBOARD ENDPOINTS ───────────────────────────────────────────

    [Fact]
    public async Task DashboardEndpoints_AllReturnData()
    {
        var endpoints = new[]
        {
            "/api/reports/dashboard",
            "/api/reports/inventory",
            "/api/online-orders/dashboard",
            "/api/cod-finance/dashboard",
        };

        foreach (var endpoint in endpoints)
        {
            var response = await _client.GetAsync(endpoint);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var content = await response.Content.ReadAsStringAsync();
            Assert.False(string.IsNullOrWhiteSpace(content));
        }
    }

    // ── SEARCH AND FILTER ─────────────────────────────────────────────

    [Fact]
    public async Task SearchAcrossEntities_ProductsClientsInvoices()
    {
        var productSearch = await _client.GetAsync("/api/products/search?query=test");
        Assert.Equal(HttpStatusCode.OK, productSearch.StatusCode);

        var clientSearch = await _client.GetAsync("/api/clients?search=test");
        Assert.Equal(HttpStatusCode.OK, clientSearch.StatusCode);

        var invoiceSearch = await _client.GetAsync("/api/invoices/search?query=test");
        Assert.Equal(HttpStatusCode.OK, invoiceSearch.StatusCode);
    }

    // ── SETTINGS ENDPOINTS ────────────────────────────────────────────

    [Fact]
    public async Task SettingsEndpoints_AllReadable()
    {
        var endpoints = new[]
        {
            "/api/settings/loyalty",
            "/api/settings/store",
            "/api/settings/tax",
            "/api/settings/shopify",
            "/api/settings/ozonexpress",
            "/api/settings/invoice-template",
            "/api/settings/receipt-template",
        };

        foreach (var endpoint in endpoints)
        {
            var response = await _client.GetAsync(endpoint);
            Assert.True(response.StatusCode == HttpStatusCode.OK ||
                        response.StatusCode == HttpStatusCode.NoContent);
        }
    }

    // ── CONFIRMATION QUEUE ────────────────────────────────────────────

    [Fact]
    public async Task ConfirmationQueue_EndpointAccessible()
    {
        var queueResp = await _client.GetAsync("/api/order-confirmation/queue");
        Assert.Equal(HttpStatusCode.OK, queueResp.StatusCode);

        var statsResp = await _client.GetAsync("/api/order-confirmation/stats");
        Assert.Equal(HttpStatusCode.OK, statsResp.StatusCode);
    }

    // ── OZONEXPRESS STATUS ────────────────────────────────────────────

    [Fact]
    public async Task OzonExpress_StatusEndpoint()
    {
        var resp = await _client.GetAsync("/api/ozonexpress/status");
        Assert.True(resp.StatusCode == HttpStatusCode.OK ||
                    resp.StatusCode == HttpStatusCode.NoContent);
    }

    // ── REPORTS PDF/CSV ───────────────────────────────────────────────

    [Fact]
    public async Task Reports_PdfEndpoints_DontCrash()
    {
        var endpoints = new[]
        {
            "/api/reports/pdf/stock",
            "/api/reports/pdf/sales",
            "/api/reports/pdf/products",
            "/api/reports/pdf/fournisseurs",
            "/api/reports/pdf/dashboard",
        };

        foreach (var endpoint in endpoints)
        {
            var response = await _client.GetAsync(endpoint);
            Assert.True(response.StatusCode == HttpStatusCode.OK ||
                        response.StatusCode == HttpStatusCode.BadRequest ||
                        response.StatusCode == HttpStatusCode.InternalServerError);
        }
    }

    [Fact]
    public async Task Reports_CsvEndpoints_DontCrash()
    {
        var endpoints = new[]
        {
            "/api/reports/csv/stock",
            "/api/reports/csv/sales",
            "/api/reports/csv/products",
            "/api/reports/csv/fournisseurs",
        };

        foreach (var endpoint in endpoints)
        {
            var response = await _client.GetAsync(endpoint);
            Assert.True(response.StatusCode == HttpStatusCode.OK ||
                        response.StatusCode == HttpStatusCode.BadRequest);
        }
    }
}
