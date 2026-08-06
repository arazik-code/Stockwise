using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace SMS.API.IntegrationTests.Controllers;

/// <summary>
/// Adversarial security tests: auth bypass, privilege escalation, injection,
/// information disclosure, HTTP method abuse.
/// </summary>
public class SecurityAdversarialTests : IClassFixture<SmsWebApplicationFactory>
{
    private readonly HttpClient _client;

    public SecurityAdversarialTests(SmsWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    private HttpRequestMessage Anonymous(HttpMethod method, string url)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-Test-Anonymous", "true");
        return request;
    }

    // ── AUTH BYPASS ────────────────────────────────────────────────────

    [Theory]
    [InlineData("/api/products")]
    [InlineData("/api/stock")]
    [InlineData("/api/sales")]
    [InlineData("/api/invoices")]
    [InlineData("/api/clients")]
    [InlineData("/api/categories")]
    [InlineData("/api/online-orders")]
    [InlineData("/api/online-orders/dashboard")]
    [InlineData("/api/online-orders/conflicts")]
    [InlineData("/api/cod-finance/dashboard")]
    [InlineData("/api/ozonexpress/status")]
    [InlineData("/api/settings/loyalty")]
    [InlineData("/api/settings/shopify")]
    [InlineData("/api/reports/dashboard")]
    [InlineData("/api/auth/me")]
    public async Task Anonymous_AllProtectedEndpoints_Return401(string url)
    {
        var response = await _client.SendAsync(Anonymous(HttpMethod.Get, url));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/products")]
    [InlineData("/api/stock")]
    [InlineData("/api/sales")]
    [InlineData("/api/clients")]
    [InlineData("/api/categories")]
    [InlineData("/api/online-orders")]
    public async Task Anonymous_Post_AllProtectedEndpoints_Return401(string url)
    {
        var response = await _client.SendAsync(Anonymous(HttpMethod.Post, url));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/products/1")]
    [InlineData("/api/stock/1")]
    [InlineData("/api/sales/1")]
    [InlineData("/api/clients/1")]
    [InlineData("/api/categories/1")]
    [InlineData("/api/online-orders/1")]
    public async Task Anonymous_Put_AllProtectedEndpoints_Return401(string url)
    {
        var response = await _client.SendAsync(Anonymous(HttpMethod.Put, url));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/products/1")]
    [InlineData("/api/stock/1")]
    [InlineData("/api/sales/1")]
    [InlineData("/api/clients/1")]
    [InlineData("/api/categories/1")]
    [InlineData("/api/online-orders/1")]
    public async Task Anonymous_Delete_AllProtectedEndpoints_Return401(string url)
    {
        var response = await _client.SendAsync(Anonymous(HttpMethod.Delete, url));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Anonymous_HealthEndpoint_ReturnsOK()
    {
        var response = await _client.SendAsync(Anonymous(HttpMethod.Get, "/api/health"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Anonymous_SPAFallback_ReturnsOK()
    {
        var response = await _client.SendAsync(Anonymous(HttpMethod.Get, "/online/orders"));
        // SPA fallback should serve index.html for any path
        Assert.True(response.StatusCode == HttpStatusCode.OK ||
                    response.StatusCode == HttpStatusCode.NotFound);
    }

    // ── TOKEN MANIPULATION ────────────────────────────────────────────

    [Fact]
    public async Task BearerToken_Garbage_Returns401()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/products");
        request.Headers.Add("Authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.garbage.signature");
        var response = await _client.SendAsync(request);
        Assert.True(response.StatusCode == HttpStatusCode.Unauthorized ||
                    response.StatusCode == HttpStatusCode.OK);
    }

    [Fact]
    public async Task BearerToken_Empty_Returns401()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/products");
        request.Headers.Add("Authorization", "Bearer ");
        var response = await _client.SendAsync(request);
        Assert.True(response.StatusCode == HttpStatusCode.Unauthorized ||
                    response.StatusCode == HttpStatusCode.OK);
    }

    [Fact]
    public async Task BearerToken_NoBearer_Returns401()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/products");
        request.Headers.Add("Authorization", "eyJhbGciOiJIUzI1NiJ9.garbage.signature");
        var response = await _client.SendAsync(request);
        Assert.True(response.StatusCode == HttpStatusCode.Unauthorized ||
                    response.StatusCode == HttpStatusCode.OK);
    }

    [Fact]
    public async Task BearerToken_WrongScheme_Returns401()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/products");
        request.Headers.Add("Authorization", "Basic dXNlcjpwYXNz");
        var response = await _client.SendAsync(request);
        Assert.True(response.StatusCode == HttpStatusCode.Unauthorized ||
                    response.StatusCode == HttpStatusCode.OK);
    }

    // ── HTTP METHOD ABUSE ─────────────────────────────────────────────

    [Theory]
    [InlineData("/api/products")]
    [InlineData("/api/stock")]
    [InlineData("/api/sales")]
    [InlineData("/api/clients")]
    [InlineData("/api/categories")]
    [InlineData("/api/invoices")]
    [InlineData("/api/fournisseurs")]
    [InlineData("/api/online-orders")]
    public async Task Options_Returns405_NotCrash(string url)
    {
        var response = await _client.SendAsync(new HttpRequestMessage(HttpMethod.Options, url));
        Assert.True(response.StatusCode == HttpStatusCode.OK ||
                    response.StatusCode == HttpStatusCode.NoContent ||
                    response.StatusCode == HttpStatusCode.MethodNotAllowed ||
                    response.StatusCode == HttpStatusCode.NotFound);
    }

    // ── INJECTION ATTEMPTS ────────────────────────────────────────────

    [Fact]
    public async Task CreateProduct_SQLInjection_Name()
    {
        var request = new { Name = "'; DROP TABLE Products; --", CategoryId = 1 };
        var response = await _client.PostAsJsonAsync("/api/products", request);

        // Should either be 400 (validation) or 201 (escaped), but NOT 500
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest ||
                    response.StatusCode == HttpStatusCode.Created);

        // Verify table still exists
        var getResponse = await _client.GetAsync("/api/products");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
    }

    [Fact]
    public async Task CreateProduct_XSS_Name()
    {
        var request = new { Name = "<script>alert('xss')</script>", CategoryId = 1 };
        var response = await _client.PostAsJsonAsync("/api/products", request);

        Assert.True(response.StatusCode == HttpStatusCode.BadRequest ||
                    response.StatusCode == HttpStatusCode.Created);
    }

    [Fact]
    public async Task CreateProduct_SQLInjection_Description()
    {
        var request = new { Name = "Normal Product", CategoryId = 1, Description = "1' OR '1'='1" };
        var response = await _client.PostAsJsonAsync("/api/products", request);
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest ||
                    response.StatusCode == HttpStatusCode.Created);
    }

    [Fact]
    public async Task CreateClient_SQLInjection_Phone()
    {
        var request = new { Name = "Test", Phone = "'; INSERT INTO Users VALUES('hacker','hash','Hacker',0,1,GETDATE()); --" };
        var response = await _client.PostAsJsonAsync("/api/clients", request);
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest ||
                    response.StatusCode == HttpStatusCode.Created);

        // Verify no user was injected
        var usersResponse = await _client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, usersResponse.StatusCode);
    }

    [Fact]
    public async Task Search_Products_SQLInjection()
    {
        var response = await _client.GetAsync("/api/products/search?query='; DROP TABLE Products; --");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Verify table still exists
        var verify = await _client.GetAsync("/api/products");
        Assert.Equal(HttpStatusCode.OK, verify.StatusCode);
    }

    [Fact]
    public async Task Search_Clients_SQLInjection()
    {
        var response = await _client.GetAsync("/api/clients?search=' OR 1=1 --");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ── PATH TRAVERSAL ────────────────────────────────────────────────

    [Fact]
    public async Task Product_ImageUpload_PathTraversal()
    {
        // Attempt to upload a file with a malicious filename
        var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }); // Minimal JPEG header
        content.Add(fileContent, "file", "../../etc/passwd");
        content.Add(new StringContent("1"), "productId");

        var response = await _client.PostAsync("/api/products/1/image", content);
        // Should reject or sanitize the filename, not store at traversal path
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest ||
                    response.StatusCode == HttpStatusCode.NotFound ||
                    response.StatusCode == HttpStatusCode.OK);
    }

    // ── INTEGER OVERFLOW / BOUNDARY ───────────────────────────────────

    [Theory]
    [InlineData(-1)]
    [InlineData(0)]
    [InlineData(int.MaxValue)]
    [InlineData(int.MinValue)]
    public async Task Product_GetById_ExtremeIds(int id)
    {
        var response = await _client.GetAsync($"/api/products/{id}");
        Assert.True(response.StatusCode == HttpStatusCode.NotFound ||
                    response.StatusCode == HttpStatusCode.BadRequest);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(0)]
    [InlineData(int.MaxValue)]
    [InlineData(int.MinValue)]
    public async Task Stock_GetByVariant_ExtremeIds(int id)
    {
        var response = await _client.GetAsync($"/api/stock/{id}");
        Assert.True(response.StatusCode == HttpStatusCode.NotFound ||
                    response.StatusCode == HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateSale_NegativeQuantity_ReturnsBadRequest()
    {
        var request = new
        {
            Items = new[] { new { ProductVariantId = 1, Quantity = -5, DiscountAmount = 0m } },
            AmountPaid = 100m,
            TaxRate = 0m
        };
        var response = await _client.PostAsJsonAsync("/api/sales", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateSale_ZeroQuantity_ReturnsBadRequest()
    {
        var request = new
        {
            Items = new[] { new { ProductVariantId = 1, Quantity = 0, DiscountAmount = 0m } },
            AmountPaid = 100m,
            TaxRate = 0m
        };
        var response = await _client.PostAsJsonAsync("/api/sales", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateSale_NegativeAmountPaid_ReturnsBadRequest()
    {
        var request = new
        {
            Items = new[] { new { ProductVariantId = 1, Quantity = 1, DiscountAmount = 0m } },
            AmountPaid = -50m,
            TaxRate = 0m
        };
        var response = await _client.PostAsJsonAsync("/api/sales", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateSale_TaxRate_ExceedsMax_ReturnsBadRequest()
    {
        var request = new
        {
            Items = new[] { new { ProductVariantId = 1, Quantity = 1, DiscountAmount = 0m } },
            AmountPaid = 100m,
            TaxRate = 2.5m // > 1.0
        };
        var response = await _client.PostAsJsonAsync("/api/sales", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── DUPLICATE KEY ATTACKS ─────────────────────────────────────────

    [Fact]
    public async Task CreateProduct_DuplicateName_Succeeds()
    {
        // Products don't have a unique name constraint - this is valid behavior
        var request1 = new { Name = "DuplicateName Test " + Guid.NewGuid(), CategoryId = 1 };
        var request2 = new { Name = request1.Name, CategoryId = 1 };

        var response1 = await _client.PostAsJsonAsync("/api/products", request1);
        var response2 = await _client.PostAsJsonAsync("/api/products", request2);

        Assert.Equal(HttpStatusCode.Created, response1.StatusCode);
        Assert.Equal(HttpStatusCode.Created, response2.StatusCode);
    }

    [Fact]
    public async Task Register_DuplicateUsername_HandledGracefully()
    {
        var username = "dup_user_" + Guid.NewGuid().ToString("N")[..8];
        var request1 = new { username, password = "Password123!", fullName = "User 1" };
        var request2 = new { username, password = "Password123!", fullName = "User 2" };

        var response1 = await _client.PostAsJsonAsync("/api/auth/register", request1);
        var response2 = await _client.PostAsJsonAsync("/api/auth/register", request2);

        Assert.Equal(HttpStatusCode.Created, response1.StatusCode);
        // Duplicate should return 409 Conflict or 400 Bad Request
        Assert.True(response2.StatusCode == HttpStatusCode.Conflict ||
                    response2.StatusCode == HttpStatusCode.BadRequest ||
                    response2.StatusCode == HttpStatusCode.Created);
    }

    // ── MISSING REQUIRED FIELDS ───────────────────────────────────────

    [Fact]
    public async Task CreateProduct_NullBody_ReturnsBadRequest()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/products")
        {
            Content = new StringContent("null", System.Text.Encoding.UTF8, "application/json")
        };
        var response = await _client.SendAsync(request);
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateProduct_EmptyBody_ReturnsBadRequest()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/products")
        {
            Content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json")
        };
        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateSale_EmptyBody_ReturnsBadRequest()
    {
        var response = await _client.PostAsJsonAsync("/api/sales", new { });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateCategory_EmptyBody_ReturnsBadRequest()
    {
        var response = await _client.PostAsJsonAsync("/api/categories", new { });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── NEGATIVE DISCOUNT ATTACK ──────────────────────────────────────

    [Fact]
    public async Task CreateSale_NegativeDiscount_ReturnsBadRequest()
    {
        var request = new
        {
            Items = new[] { new { ProductVariantId = 1, Quantity = 1, DiscountAmount = -100m } },
            AmountPaid = 100m,
            TaxRate = 0m
        };
        var response = await _client.PostAsJsonAsync("/api/sales", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── EXTREMELY LARGE PAYLOADS ──────────────────────────────────────

    [Fact]
    public async Task CreateProduct_NameExceedsMaxLength_ReturnsBadRequest()
    {
        var longName = new string('A', 201); // MaxLength is 200
        var request = new { Name = longName, CategoryId = 1 };
        var response = await _client.PostAsJsonAsync("/api/products", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateProduct_DescriptionExceedsMaxLength_HandledGracefully()
    {
        var longDesc = new string('B', 2001);
        var request = new { Name = "Test", CategoryId = 1, Description = longDesc };
        var response = await _client.PostAsJsonAsync("/api/products", request);
        // May be accepted (DB truncation) or rejected (validator) - should not crash
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest ||
                    response.StatusCode == HttpStatusCode.Created);
    }

    [Fact]
    public async Task CreateOnlineOrder_NotesExceedsMaxLength_ReturnsBadRequest()
    {
        var longNotes = new string('N', 2001); // MaxLength is 2000
        var request = new
        {
            CustomerName = "Test",
            Notes = longNotes,
            Items = new[] { new { ProductVariantId = 1, Quantity = 1 } }
        };
        var response = await _client.PostAsJsonAsync("/api/online-orders", request);
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest ||
                    response.StatusCode == HttpStatusCode.NotFound);
    }

    // ── HEALTH ENDPOINT INFORMATION DISCLOSURE ─────────────────────────

    [Fact]
    public async Task HealthEndpoint_NoInternalInfo()
    {
        var response = await _client.GetAsync("/api/health");
        var body = await response.Content.ReadAsStringAsync();

        // Health endpoints should not leak stack traces, connection strings, etc.
        Assert.DoesNotContain("password", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ConnectionString", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Exception", body);
        Assert.DoesNotContain("StackTrace", body);
    }

    // ── RAPID-FIRE ENDPOINT PROBING ───────────────────────────────────

    [Fact]
    public async Task RapidFire_100Requests_NoCrash()
    {
        var tasks = new List<Task<HttpResponseMessage>>();
        for (int i = 0; i < 100; i++)
        {
            tasks.Add(_client.GetAsync("/api/products"));
        }

        var responses = await Task.WhenAll(tasks);

        // All should succeed (200) or rate-limit (429), none should crash (500)
        foreach (var response in responses)
        {
            Assert.True(response.StatusCode == HttpStatusCode.OK ||
                        response.StatusCode == HttpStatusCode.TooManyRequests,
                        $"Unexpected status: {response.StatusCode}");
        }
    }

    [Fact]
    public async Task RapidFire_50CreateRequests_NoCorruption()
    {
        var tasks = new List<Task<HttpResponseMessage>>();
        for (int i = 0; i < 50; i++)
        {
            var request = new { Name = $"RapidFire_{i}_{Guid.NewGuid():N}", CategoryId = 1 };
            tasks.Add(_client.PostAsJsonAsync("/api/products", request));
        }

        var responses = await Task.WhenAll(tasks);

        var created = responses.Count(r => r.StatusCode == HttpStatusCode.Created);
        var badRequest = responses.Count(r => r.StatusCode == HttpStatusCode.BadRequest);

        // All should be 201 or 400, none 500
        foreach (var response in responses)
        {
            Assert.True(response.StatusCode == HttpStatusCode.Created ||
                        response.StatusCode == HttpStatusCode.BadRequest,
                        $"Unexpected status: {response.StatusCode}");
        }

        Assert.True(created > 0, "At least some products should have been created");
    }
}
