using System.Net;
using System.Net.Http.Json;

namespace SMS.API.IntegrationTests.Controllers;

public class AdminHealthControllerTests : IClassFixture<SmsWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AdminHealthControllerTests(SmsWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    private static HttpRequestMessage As(string role, HttpMethod method, string url)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-Test-Role", role);
        request.Headers.Add("X-Test-UserId", "1");
        return request;
    }

    [Fact]
    public async Task GetFull_AsAdmin_ReturnsOverallStatusAndProbes()
    {
        var response = await _client.SendAsync(As("Admin", HttpMethod.Get, "/api/admin/health/full"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<BoardShape>();
        Assert.NotNull(body);
        Assert.Contains(body!.overallStatus, new[] { "healthy", "degraded", "down" });
        Assert.NotEmpty(body.probes);
        // The in-memory test DB is always reachable, so this specific probe must be healthy -
        // proves it's a real live check, not a hardcoded/fabricated status.
        Assert.Contains(body.probes, p => p.name == "Base de données" && p.status == "healthy");
    }

    [Fact]
    public async Task GetFull_NoProbeThrowsPast500_RegardlessOfIntegrationConfig()
    {
        // Whether Shopify/OzonExpress happen to be configured in this environment's appsettings
        // varies by machine - what this actually guards is that neither probe ever takes the whole
        // endpoint down (200 with every probe present, whatever its individual status is).
        var response = await _client.SendAsync(As("Admin", HttpMethod.Get, "/api/admin/health/full"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<BoardShape>();
        var validStatuses = new[] { "healthy", "degraded", "down", "not_configured" };

        Assert.Contains(body!.probes, p => p.name.Contains("Shopify") && validStatuses.Contains(p.status));
        Assert.Contains(body.probes, p => p.name.Contains("OzonExpress") && validStatuses.Contains(p.status));
    }

    [Fact]
    public async Task GetFull_AsCashier_ReturnsForbidden()
    {
        var response = await _client.SendAsync(As("Cashier", HttpMethod.Get, "/api/admin/health/full"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ConcurrentRequests_AllSucceed()
    {
        var tasks = Enumerable.Range(0, 10).Select(_ => _client.SendAsync(As("Admin", HttpMethod.Get, "/api/admin/health/full")));
        var responses = await Task.WhenAll(tasks);

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
    }

    private record BoardShape(string overallStatus, DateTime generatedAt, List<ProbeShape> probes);
    private record ProbeShape(string name, string category, string status, string message, long latencyMs, DateTime checkedAt);
}
