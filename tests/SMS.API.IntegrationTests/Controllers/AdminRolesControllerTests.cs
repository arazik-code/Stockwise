using System.Net;
using System.Net.Http.Json;

namespace SMS.API.IntegrationTests.Controllers;

public class AdminRolesControllerTests : IClassFixture<SmsWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AdminRolesControllerTests(SmsWebApplicationFactory factory)
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
    public async Task GetAll_ReturnsTheThreeSeededSystemRoles()
    {
        var roles = await _client.GetFromJsonAsync<List<RoleShape>>("/api/admin/roles");
        Assert.Contains(roles!, r => r.name == "Admin" && r.isSystem);
        Assert.Contains(roles!, r => r.name == "Cashier" && r.isSystem);
        Assert.Contains(roles!, r => r.name == "StockManager" && r.isSystem);
    }

    [Fact]
    public async Task GetAvailableSections_ReturnsNonEmptyList()
    {
        var sections = await _client.GetFromJsonAsync<List<string>>("/api/admin/roles/sections");
        Assert.NotEmpty(sections!);
        Assert.Contains("AdminUsers", sections!);
    }

    [Fact]
    public async Task Create_WithInvalidSection_ReturnsBadRequest()
    {
        var req = As("Admin", HttpMethod.Post, "/api/admin/roles");
        req.Content = JsonContent.Create(new { name = $"Bad_{Guid.NewGuid():N}", sections = new[] { "NotARealSection" } });

        var response = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_ThenAssignAndFetch_SectionsRoundTrip()
    {
        var name = $"Comptable_{Guid.NewGuid():N}";
        var createReq = As("Admin", HttpMethod.Post, "/api/admin/roles");
        createReq.Content = JsonContent.Create(new { name, description = "Accès finance uniquement", sections = new[] { "Reports", "CodFinance" } });

        var createResp = await _client.SendAsync(createReq);
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);

        var roles = await _client.GetFromJsonAsync<List<RoleShape>>("/api/admin/roles");
        var created = roles!.Single(r => r.name == name);
        Assert.False(created.isSystem);
        Assert.Contains("Reports", created.sections);
        Assert.Contains("CodFinance", created.sections);
        Assert.DoesNotContain("AdminUsers", created.sections);
    }

    [Fact]
    public async Task Update_SystemRole_CannotLoseGuardedAdminSections()
    {
        var roles = await _client.GetFromJsonAsync<List<RoleShape>>("/api/admin/roles");
        var admin = roles!.Single(r => r.name == "Admin");

        var req = As("Admin", HttpMethod.Put, $"/api/admin/roles/{admin.id}");
        // Attempt to strip every section, including the Admin-guarded ones.
        req.Content = JsonContent.Create(new { sections = Array.Empty<string>() });
        var response = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var updated = await response.Content.ReadFromJsonAsync<RoleShape>();
        Assert.Contains("AdminUsers", updated!.sections);
        Assert.Contains("AdminRoles", updated.sections);
        Assert.Contains("AdminHealth", updated.sections);
    }

    [Fact]
    public async Task Delete_SystemRole_IsRejected()
    {
        var roles = await _client.GetFromJsonAsync<List<RoleShape>>("/api/admin/roles");
        var cashier = roles!.Single(r => r.name == "Cashier");

        var response = await _client.SendAsync(As("Admin", HttpMethod.Delete, $"/api/admin/roles/{cashier.id}"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Delete_RoleStillAssignedToUsers_IsRejected()
    {
        // Cashier has the seeded "cashier" account assigned to it in the Testing host? No - the
        // Testing host skips account seeding entirely, so instead: create a role, assign a user to
        // it, then try to delete it.
        var roleName = $"Temp_{Guid.NewGuid():N}";
        var createRoleReq = As("Admin", HttpMethod.Post, "/api/admin/roles");
        createRoleReq.Content = JsonContent.Create(new { name = roleName, sections = Array.Empty<string>() });
        var role = await (await _client.SendAsync(createRoleReq)).Content.ReadFromJsonAsync<RoleShape>();

        var createUserReq = As("Admin", HttpMethod.Post, "/api/admin/users");
        createUserReq.Content = JsonContent.Create(new { username = $"u_{Guid.NewGuid():N}", fullName = "Temp User", roleId = role!.id });
        await _client.SendAsync(createUserReq);

        var deleteResponse = await _client.SendAsync(As("Admin", HttpMethod.Delete, $"/api/admin/roles/{role.id}"));
        Assert.Equal(HttpStatusCode.BadRequest, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task GetAll_AsStockManager_ReturnsForbidden()
    {
        var response = await _client.SendAsync(As("StockManager", HttpMethod.Get, "/api/admin/roles"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private record RoleShape(int id, string name, string? description, bool isSystem, List<string> sections, int userCount);
}
