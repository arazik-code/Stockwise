using System.Net;
using System.Net.Http.Json;

namespace SMS.API.IntegrationTests.Controllers;

/// <summary>
/// Regression tests for the security holes closed during the Phase 1 audit:
/// register/me/devices/printer were all reachable without authentication, and
/// register additionally accepted an arbitrary Role, making it a full
/// unauthenticated admin-mint path.
/// </summary>
public class AuthSecurityTests : IClassFixture<SmsWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AuthSecurityTests(SmsWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    private HttpRequestMessage Anonymous(HttpMethod method, string url)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-Test-Anonymous", "true");
        return request;
    }

    [Fact]
    public async Task Register_Anonymous_ReturnsUnauthorized()
    {
        var request = Anonymous(HttpMethod.Post, "/api/auth/register");
        request.Content = JsonContent.Create(new
        {
            username = "hacker",
            password = "pwned123",
            fullName = "Hacker",
            role = 0 // UserRole.Admin
        });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_Anonymous_ReturnsUnauthorized()
    {
        var response = await _client.SendAsync(Anonymous(HttpMethod.Get, "/api/auth/me"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Devices_Anonymous_ReturnsUnauthorized()
    {
        var response = await _client.SendAsync(Anonymous(HttpMethod.Get, "/api/devices/status"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Printer_Anonymous_ReturnsUnauthorized()
    {
        var response = await _client.SendAsync(Anonymous(HttpMethod.Get, "/api/printer/label-sizes"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_Anonymous_IsReachable()
    {
        // Login must stay reachable without a token - it's how you get one.
        var request = Anonymous(HttpMethod.Post, "/api/auth/login");
        request.Content = JsonContent.Create(new { username = "nonexistent", password = "wrong" });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode); // bad creds, not 404/blocked-by-auth
    }

    [Fact]
    public async Task Register_AsAdmin_Succeeds()
    {
        // The default Test auth handler authenticates as Admin, so this confirms
        // Register still works for the role it's meant for - only anonymous callers
        // (and, by the same [Authorize(Roles = "Admin")] gate, non-Admin roles) are
        // rejected.
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            username = "newstaffmember",
            password = "password123",
            fullName = "New Staff Member",
            role = 2 // UserRole.Cashier
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }
}
