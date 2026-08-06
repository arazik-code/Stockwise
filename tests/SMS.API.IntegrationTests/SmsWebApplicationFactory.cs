using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SMS.Infrastructure.Data;

namespace SMS.API.IntegrationTests;

public class SmsWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = "TestDb_" + Guid.NewGuid();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            var descriptors = services.Where(
                d => d.ServiceType == typeof(DbContextOptions<AppDbContext>)).ToList();
            foreach (var d in descriptors)
                services.Remove(d);

            var configDesc = services.Where(
                d => d.ServiceType.FullName != null &&
                     d.ServiceType.FullName.Contains("DbContextOptionsConfiguration")).ToList();
            foreach (var d in configDesc)
                services.Remove(d);

            var npgsqlDesc = services.Where(
                d => d.ImplementationInstance != null &&
                     d.ImplementationInstance.GetType().Name.Contains("Npgsql")).ToList();
            foreach (var d in npgsqlDesc)
                services.Remove(d);

            // AddDbContext re-invokes this configure delegate once per DI scope (its options
            // lifetime defaults to Scoped) - a fresh Guid evaluated *inside* the lambda would hand
            // every HTTP request its own empty, isolated in-memory database, disconnected from
            // whatever the startup seeding scope wrote. The Guid must be fixed per factory
            // instance so every scope (startup seeding, every request) shares the same store.
            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseInMemoryDatabase(_databaseName);
                options.ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning));
            });

            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = "Test";
                options.DefaultChallengeScheme = "Test";
            })
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("Test", _ => { });

            services.AddLogging(logging => logging.ClearProviders());
        });
    }
}

public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder) : base(options, logger, encoder) { }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // Existing tests send no Authorization header and rely on always being "logged in"
        // as Admin. Regression tests for the auth holes need to simulate a genuinely
        // anonymous caller, so they opt in with this header instead of us flipping the
        // default (which would silently 401 every other test in the suite).
        if (Request.Headers.ContainsKey("X-Test-Anonymous"))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        // Opt-in overrides for RequireSection/role-boundary tests - absent headers preserve the
        // original default (Admin, no explicit section claims - Admin bypasses section checks
        // anyway) so every pre-existing test keeps behaving exactly as before.
        var role = Request.Headers.TryGetValue("X-Test-Role", out var roleHeader) ? roleHeader.ToString() : "Admin";
        var userId = Request.Headers.TryGetValue("X-Test-UserId", out var idHeader) ? idHeader.ToString() : "1";

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId),
            new(ClaimTypes.Name, "TestUser"),
            new(ClaimTypes.Role, role)
        };
        if (Request.Headers.TryGetValue("X-Test-Sections", out var sectionsHeader))
        {
            claims.AddRange(sectionsHeader.ToString().Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => new Claim("section", s)));
        }
        var identity = new ClaimsIdentity(claims, "Test");
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, "Test");
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
