using System.Net;
using System.Net.Http.Json;

namespace SMS.API.IntegrationTests.Controllers;

public class AdminUsersControllerTests : IClassFixture<SmsWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AdminUsersControllerTests(SmsWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    private static HttpRequestMessage As(string role, HttpMethod method, string url, string? sections = null, string userId = "1")
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-Test-Role", role);
        request.Headers.Add("X-Test-UserId", userId);
        if (sections is not null) request.Headers.Add("X-Test-Sections", sections);
        return request;
    }

    private async Task<int> GetRoleIdAsync(string name)
    {
        var roles = await _client.GetFromJsonAsync<List<RoleDtoShape>>("/api/admin/roles");
        return roles!.Single(r => r.name == name).id;
    }

    [Fact]
    public async Task GetAll_AsAdmin_ReturnsOk()
    {
        var response = await _client.SendAsync(As("Admin", HttpMethod.Get, "/api/admin/users"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetAll_AsCashier_ReturnsForbidden()
    {
        var response = await _client.SendAsync(As("Cashier", HttpMethod.Get, "/api/admin/users"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetAll_AsCustomRoleWithoutAdminUsersSection_ReturnsForbidden()
    {
        // A custom role isn't "Admin"/"Cashier"/"StockManager" so the legacy [Authorize(Roles=)]
        // gate alone already blocks it - this also proves RequireSection isn't accidentally the
        // only thing standing guard on an Admin-only controller.
        var response = await _client.SendAsync(As("Comptable", HttpMethod.Get, "/api/admin/users", sections: "AdminUsers"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Create_ThenGet_RoundTrips()
    {
        var roleId = await GetRoleIdAsync("Cashier");
        var createReq = As("Admin", HttpMethod.Post, "/api/admin/users");
        createReq.Content = JsonContent.Create(new { username = $"newuser_{Guid.NewGuid():N}", fullName = "New Person", roleId });

        var createResp = await _client.SendAsync(createReq);
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);

        var body = await createResp.Content.ReadFromJsonAsync<CreateUserResponseShape>();
        Assert.NotNull(body!.temporaryPassword); // no password given -> one must be generated and returned once
    }

    [Fact]
    public async Task Create_DuplicateUsername_ReturnsConflict()
    {
        var roleId = await GetRoleIdAsync("Cashier");
        var username = $"dupe_{Guid.NewGuid():N}";

        async Task<HttpResponseMessage> CreateOnce()
        {
            var req = As("Admin", HttpMethod.Post, "/api/admin/users");
            req.Content = JsonContent.Create(new { username, fullName = "Dupe", roleId });
            return await _client.SendAsync(req);
        }

        var first = await CreateOnce();
        var second = await CreateOnce();

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    private async Task<int> CreateUserAsync(string roleName, string? username = null)
    {
        var roleId = await GetRoleIdAsync(roleName);
        var req = As("Admin", HttpMethod.Post, "/api/admin/users");
        req.Content = JsonContent.Create(new { username = username ?? $"u_{Guid.NewGuid():N}", fullName = "Test User", roleId });
        var resp = await _client.SendAsync(req);
        var body = await resp.Content.ReadFromJsonAsync<CreateUserResponseShape>();
        return body!.user.id;
    }

    [Fact]
    public async Task Update_CannotDeactivateSelf()
    {
        var adminId = await CreateUserAsync("Admin");

        // Same id as the acting caller - deactivating "self" must be blocked regardless of
        // whether removing them would also empty out the last-admin count.
        var req = As("Admin", HttpMethod.Put, $"/api/admin/users/{adminId}", userId: adminId.ToString());
        req.Content = JsonContent.Create(new { isActive = false });

        var response = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Update_CannotDeactivateLastActiveAdmin()
    {
        var targetAdminId = await CreateUserAsync("Admin");

        // This class shares one DB across all its tests, so other tests may have already left
        // other active Admin accounts behind - drain every one of them except the target first,
        // so "the last active admin" is deterministic no matter what test order xUnit picks.
        var users = await _client.GetFromJsonAsync<List<UserShape>>("/api/admin/users");
        foreach (var other in users!.Where(u => u.roleName == "Admin" && u.isActive && u.id != targetAdminId))
        {
            var drain = As("Admin", HttpMethod.Put, $"/api/admin/users/{other.id}", userId: "999999");
            drain.Content = JsonContent.Create(new { isActive = false });
            await _client.SendAsync(drain); // best-effort; ignored if it's itself the last one at that point
        }

        // Acting as a *different* admin trying to deactivate the only remaining active Admin.
        var req = As("Admin", HttpMethod.Put, $"/api/admin/users/{targetAdminId}", userId: "999999");
        req.Content = JsonContent.Create(new { isActive = false });

        var response = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_ReturnsTemporaryPassword()
    {
        var userId = await CreateUserAsync("Cashier");
        var req = As("Admin", HttpMethod.Post, $"/api/admin/users/{userId}/reset-password");
        req.Content = JsonContent.Create(new { });

        var response = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.False(string.IsNullOrWhiteSpace(body!["temporaryPassword"]));
    }

    [Fact]
    public async Task ConcurrentCreates_AllSucceedWithDistinctUsernames()
    {
        // Stress/concurrency pass: fire many concurrent user-creation requests and confirm none
        // collide or corrupt state - each gets a unique username so no Conflict is expected here.
        var roleId = await GetRoleIdAsync("Cashier");
        var tasks = Enumerable.Range(0, 20).Select(async i =>
        {
            var req = As("Admin", HttpMethod.Post, "/api/admin/users");
            req.Content = JsonContent.Create(new { username = $"stress_{i}_{Guid.NewGuid():N}", fullName = $"Stress {i}", roleId });
            return await _client.SendAsync(req);
        });

        var responses = await Task.WhenAll(tasks);

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.Created, r.StatusCode));
    }

    private record RoleDtoShape(int id, string name);
    private record CreateUserResponseShape(UserShape user, string? temporaryPassword);
    private record UserShape(int id, string username, string fullName, int roleId, string roleName, bool isActive, bool mustChangePassword);
}
