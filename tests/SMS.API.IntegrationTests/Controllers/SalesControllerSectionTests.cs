using System.Net;

namespace SMS.API.IntegrationTests.Controllers;

// Regression coverage for splitting SalesController's reporting actions (daily-report, report,
// sales-report - the "Ventes" analytics page) onto the Reports section, separate from the
// checkout-critical actions (Create, GetAll, GetById) that stay under Pos alone. Removing Reports
// from a role must not also break their ability to ring up sales, look up sales for exchanges, or
// process refunds.
public class SalesControllerSectionTests : IClassFixture<SmsWebApplicationFactory>
{
    private readonly HttpClient _client;

    public SalesControllerSectionTests(SmsWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    private static HttpRequestMessage As(string role, string sections, HttpMethod method, string url)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-Test-Role", role);
        request.Headers.Add("X-Test-UserId", "1");
        request.Headers.Add("X-Test-Sections", sections);
        return request;
    }

    [Fact]
    public async Task SalesReport_WithoutReportsSection_ReturnsForbidden()
    {
        var response = await _client.SendAsync(As("Cashier", "POS", HttpMethod.Get,
            "/api/sales/sales-report?from=2026-01-01&to=2026-01-31"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DailyReport_WithoutReportsSection_ReturnsForbidden()
    {
        var response = await _client.SendAsync(As("Cashier", "POS", HttpMethod.Get, "/api/sales/daily-report"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task SalesReport_WithReportsSection_Succeeds()
    {
        var response = await _client.SendAsync(As("Cashier", "POS,Reports", HttpMethod.Get,
            "/api/sales/sales-report?from=2026-01-01&to=2026-01-31"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetAll_WithoutReportsSection_StillSucceeds()
    {
        // Checkout, exchanges (ExchangeDialog.tsx), and refunds (RefundsPage.tsx) all depend on
        // this endpoint - it must keep working for a Cashier who only has Pos, not Reports.
        var response = await _client.SendAsync(As("Cashier", "POS", HttpMethod.Get, "/api/sales"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetAll_WithoutPosSection_ReturnsForbidden()
    {
        var response = await _client.SendAsync(As("Comptable", "Reports", HttpMethod.Get, "/api/sales"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
