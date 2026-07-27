using System.Net;
using System.Net.Http.Json;

namespace SMS.API.IntegrationTests.Controllers;

public class HealthEndpointsTests : IClassFixture<SmsWebApplicationFactory>
{
    private readonly HttpClient _client;

    public HealthEndpointsTests(SmsWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Health_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task HealthShopify_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/health/shopify");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
