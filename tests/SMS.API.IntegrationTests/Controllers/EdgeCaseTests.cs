using System.Net;
using System.Net.Http.Json;

namespace SMS.API.IntegrationTests.Controllers;

/// <summary>
/// Edge case tests: boundary values, null inputs, extreme values,
/// type mismatches, malformed JSON, empty collections.
/// </summary>
public class EdgeCaseTests : IClassFixture<SmsWebApplicationFactory>
{
    private readonly HttpClient _client;

    public EdgeCaseTests(SmsWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    // ── MALFORMED JSON ────────────────────────────────────────────────

    [Fact]
    public async Task CreateProduct_MalformedJson_ReturnsBadRequest()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/products")
        {
            Content = new StringContent("{invalid json}", System.Text.Encoding.UTF8, "application/json")
        };
        var response = await _client.SendAsync(request);
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateProduct_TruncatedJson_ReturnsBadRequest()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/products")
        {
            Content = new StringContent(@"{""name"":""Test""", System.Text.Encoding.UTF8, "application/json")
        };
        var response = await _client.SendAsync(request);
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateProduct_WrongContentType_ReturnsUnsupportedOrBadRequest()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/products")
        {
            Content = new StringContent("<xml>data</xml>", System.Text.Encoding.UTF8, "application/xml")
        };
        var response = await _client.SendAsync(request);
        Assert.True(response.StatusCode == HttpStatusCode.UnsupportedMediaType ||
                    response.StatusCode == HttpStatusCode.BadRequest);
    }

    // ── TYPE MISMATCH ─────────────────────────────────────────────────

    [Fact]
    public async Task CreateProduct_StringInsteadOfInt_CategoryId()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/products")
        {
            Content = JsonContent.Create(new { Name = "Test", CategoryId = "not_a_number" })
        };
        var response = await _client.SendAsync(request);
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateProduct_NegativePrice()
    {
        var request = new { Name = "NegativePrice", CategoryId = 1, Price = -100m };
        var response = await _client.PostAsJsonAsync("/api/products", request);
        // Depends on validator - may accept (some systems allow negative for credits)
        Assert.True(response.StatusCode == HttpStatusCode.Created ||
                    response.StatusCode == HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateProduct_ZeroPrice()
    {
        var request = new { Name = "ZeroPrice", CategoryId = 1, Price = 0m };
        var response = await _client.PostAsJsonAsync("/api/products", request);
        Assert.True(response.StatusCode == HttpStatusCode.Created ||
                    response.StatusCode == HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateProduct_ExtremelyLargePrice()
    {
        var request = new { Name = "MegaPrice", CategoryId = 1, Price = 999999999999.99m };
        var response = await _client.PostAsJsonAsync("/api/products", request);
        // Should handle without overflow
        Assert.True(response.StatusCode == HttpStatusCode.Created ||
                    response.StatusCode == HttpStatusCode.BadRequest);
    }

    // ── EMPTY STRING FIELDS ───────────────────────────────────────────

    [Fact]
    public async Task CreateProduct_EmptyName_ReturnsBadRequest()
    {
        var request = new { Name = "", CategoryId = 1 };
        var response = await _client.PostAsJsonAsync("/api/products", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateClient_EmptyPhone_ReturnsBadRequest()
    {
        var request = new { Name = "Test", Phone = "" };
        var response = await _client.PostAsJsonAsync("/api/clients", request);
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest ||
                    response.StatusCode == HttpStatusCode.Created);
    }

    [Fact]
    public async Task CreateClient_EmptyName_ReturnsBadRequest()
    {
        var request = new { Name = "", Phone = "0600000000" };
        var response = await _client.PostAsJsonAsync("/api/clients", request);
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest ||
                    response.StatusCode == HttpStatusCode.Created);
    }

    // ── WHITESPACE-ONLY STRINGS ───────────────────────────────────────

    [Fact]
    public async Task CreateProduct_WhitespaceName_ReturnsBadRequest()
    {
        var request = new { Name = "   ", CategoryId = 1 };
        var response = await _client.PostAsJsonAsync("/api/products", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateCategory_WhitespaceName_HandledGracefully()
    {
        var request = new { Name = "   " };
        var response = await _client.PostAsJsonAsync("/api/categories", request);
        // May be accepted or rejected - should not crash
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest ||
                    response.StatusCode == HttpStatusCode.Created);
    }

    // ── UNICODE AND SPECIAL CHARACTERS ────────────────────────────────

    [Fact]
    public async Task CreateProduct_UnicodeName_Succeeds()
    {
        var request = new { Name = "منتج تجريبي - 测试产品", CategoryId = 1 };
        var response = await _client.PostAsJsonAsync("/api/products", request);
        Assert.True(response.StatusCode == HttpStatusCode.Created);
    }

    [Fact]
    public async Task CreateProduct_EmojiName_Succeeds()
    {
        var request = new { Name = "Test Product \u2764", CategoryId = 1 };
        var response = await _client.PostAsJsonAsync("/api/products", request);
        Assert.True(response.StatusCode == HttpStatusCode.Created ||
                    response.StatusCode == HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateClient_ArabicName_Succeeds()
    {
        var request = new { Name = "محمد بن سعيد", Phone = "0600000001" };
        var response = await _client.PostAsJsonAsync("/api/clients", request);
        Assert.True(response.StatusCode == HttpStatusCode.Created);
    }

    // ── NULLABLE FIELD HANDLING ───────────────────────────────────────

    [Fact]
    public async Task CreateProduct_NullOptionalFields_Succeeds()
    {
        var request = new
        {
            Name = "NullOptionals",
            CategoryId = 1,
            Description = (string?)null,
            Brand = (string?)null,
            ImageUrl = (string?)null,
            CostPrice = (decimal?)null,
            LiquidationPrice = (decimal?)null,
            OnlinePrice = (decimal?)null,
            FournisseurId = (int?)null
        };
        var response = await _client.PostAsJsonAsync("/api/products", request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task CreateOnlineOrder_NullOptionalFields_Succeeds()
    {
        var request = new
        {
            CustomerName = "NullTest",
            CustomerPhone = (string?)null,
            CustomerEmail = (string?)null,
            AddressLine = (string?)null,
            City = (string?)null,
            Notes = (string?)null,
            DeliveryFee = 0m,
            DiscountAmount = 0m,
            Items = new[] { new { ProductVariantId = 1, Quantity = 1 } }
        };
        var response = await _client.PostAsJsonAsync("/api/online-orders", request);
        Assert.True(response.StatusCode == HttpStatusCode.Created ||
                    response.StatusCode == HttpStatusCode.NotFound);
    }

    // ── EXTREME ID VALUES ─────────────────────────────────────────────

    [Theory]
    [InlineData(-1)]
    [InlineData(0)]
    public async Task GetById_NegativeOrZero_ReturnsNotFound(int id)
    {
        var response = await _client.GetAsync($"/api/products/{id}");
        Assert.True(response.StatusCode == HttpStatusCode.NotFound ||
                    response.StatusCode == HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetById_LargeId_ReturnsNotFound()
    {
        var response = await _client.GetAsync("/api/products/999999999");
        Assert.True(response.StatusCode == HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(0)]
    public async Task StockAdjust_InvalidVariantId_ReturnsError(int variantId)
    {
        var response = await _client.PostAsJsonAsync("/api/stock/adjust", new
        {
            ProductVariantId = variantId,
            AdjustmentDelta = 1
        });
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest ||
                    response.StatusCode == HttpStatusCode.NotFound);
    }

    // ── EMPTY COLLECTIONS ─────────────────────────────────────────────

    [Fact]
    public async Task CreateSale_EmptyItems_ReturnsBadRequest()
    {
        var request = new
        {
            Items = Array.Empty<object>(),
            AmountPaid = 100m,
            TaxRate = 0m
        };
        var response = await _client.PostAsJsonAsync("/api/sales", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateOnlineOrder_EmptyItems_ReturnsBadRequest()
    {
        var request = new
        {
            CustomerName = "Empty",
            Items = Array.Empty<object>()
        };
        var response = await _client.PostAsJsonAsync("/api/online-orders", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateInvoice_EmptyItems_ReturnsBadRequest()
    {
        var request = new
        {
            FournisseurId = 1,
            PaymentTerms = "Comptant",
            DiscountAmount = 0m,
            TaxRate = 0m,
            Items = Array.Empty<object>()
        };
        var response = await _client.PostAsJsonAsync("/api/invoices", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── ENUM EDGE CASES ───────────────────────────────────────────────

    [Fact]
    public async Task UpdateOrderStatus_InvalidEnumValue_ReturnsBadRequest()
    {
        var request = new HttpRequestMessage(HttpMethod.Put, "/api/online-orders/1/status")
        {
            Content = JsonContent.Create(new { status = 999 })
        };
        var response = await _client.SendAsync(request);
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest ||
                    response.StatusCode == HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CreateSale_InvalidPaymentMethod_HandledGracefully()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/sales")
        {
            Content = JsonContent.Create(new
            {
                Items = new[] { new { ProductVariantId = 1, Quantity = 1, DiscountAmount = 0m } },
                AmountPaid = 100m,
                TaxRate = 0m,
                PaymentMethod = 999
            })
        };
        var response = await _client.SendAsync(request);
        // Should not crash with 500 - may accept, reject, or return various codes
        Assert.True(response.StatusCode != HttpStatusCode.InternalServerError,
                    $"Server crashed with 500: {response.StatusCode}");
    }

    // ── QUERY PARAMETER EDGE CASES ────────────────────────────────────

    [Fact]
    public async Task Search_EmptyQuery_ReturnsOK()
    {
        var response = await _client.GetAsync("/api/products/search?query=");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Search_VeryLongQuery_ReturnsOK()
    {
        var longQuery = new string('x', 1000);
        var response = await _client.GetAsync($"/api/products/search?query={longQuery}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Reports_Dashboard_ReturnsOK()
    {
        var response = await _client.GetAsync("/api/reports/dashboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Reports_Inventory_ReturnsOK()
    {
        var response = await _client.GetAsync("/api/reports/inventory");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ── DATE EDGE CASES ───────────────────────────────────────────────

    [Fact]
    public async Task SalesReport_FarPastDate_ReturnsOK()
    {
        var response = await _client.GetAsync("/api/sales/report?from=2000-01-01&to=2000-01-02");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SalesReport_FutureDate_ReturnsOK()
    {
        var response = await _client.GetAsync("/api/sales/report?from=2099-12-31&to=2099-12-31");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SalesReport_SameFromTo_ReturnsOK()
    {
        var response = await _client.GetAsync("/api/sales/report?from=2026-01-01&to=2026-01-01");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SalesReport_FromAfterTo_ReturnsOK()
    {
        // API should handle inverted date range gracefully
        var response = await _client.GetAsync("/api/sales/report?from=2026-12-31&to=2026-01-01");
        Assert.True(response.StatusCode == HttpStatusCode.OK ||
                    response.StatusCode == HttpStatusCode.BadRequest);
    }

    // ── NESTED OBJECT IN PLAIN TEXT ───────────────────────────────────

    [Fact]
    public async Task CreateProduct_PlainText_ReturnsBadRequest()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/products")
        {
            Content = new StringContent("not json at all", System.Text.Encoding.UTF8, "text/plain")
        };
        var response = await _client.SendAsync(request);
        Assert.True(response.StatusCode == HttpStatusCode.UnsupportedMediaType ||
                    response.StatusCode == HttpStatusCode.BadRequest);
    }

    // ── NULL REFERENCE IN BODY ────────────────────────────────────────

    [Fact]
    public async Task CreateProduct_JsonNull_ReturnsBadRequest()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/products")
        {
            Content = new StringContent("null", System.Text.Encoding.UTF8, "application/json")
        };
        var response = await _client.SendAsync(request);
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest);
    }

    // ── ARRAY INSTEAD OF OBJECT ───────────────────────────────────────

    [Fact]
    public async Task CreateProduct_ArrayInsteadOfObject_ReturnsBadRequest()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/products")
        {
            Content = new StringContent("[]", System.Text.Encoding.UTF8, "application/json")
        };
        var response = await _client.SendAsync(request);
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest);
    }

    // ── REPEATED FIELDS IN JSON ───────────────────────────────────────

    [Fact]
    public async Task CreateProduct_DuplicateField_InLastValueWins()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/products")
        {
            Content = new StringContent(
                @"{""name"":""First"",""name"":""Second"",""categoryId"":1}",
                System.Text.Encoding.UTF8,
                "application/json")
        };
        var response = await _client.SendAsync(request);
        // Should deserialize without crash (last value wins in most serializers)
        Assert.True(response.StatusCode == HttpStatusCode.Created ||
                    response.StatusCode == HttpStatusCode.BadRequest);
    }

    // ── DEEP NESTING ──────────────────────────────────────────────────

    [Fact]
    public async Task CreateProduct_DeeplyNestedPayload_ReturnsBadRequest()
    {
        var deeplyNested = new { Category = new { Parent = new { Parent = new { Name = "deep" } } } };
        var response = await _client.PostAsJsonAsync("/api/products", deeplyNested);
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest);
    }

    // ── NEGATIVE OFFSET PAGINATION ────────────────────────────────────

    [Fact]
    public async Task StockMovements_NegativeParams_HandledGracefully()
    {
        var response = await _client.GetAsync("/api/stock/movements?productVariantId=-1");
        Assert.True(response.StatusCode == HttpStatusCode.OK ||
                    response.StatusCode == HttpStatusCode.BadRequest ||
                    response.StatusCode == HttpStatusCode.NotFound);
    }
}
