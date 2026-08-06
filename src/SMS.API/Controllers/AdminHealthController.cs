using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SMS.API.Authorization;
using SMS.Application.DTOs.Ozon;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;
using SMS.Infrastructure.Data;
using SMS.Infrastructure.SignalR;

namespace SMS.API.Controllers;

// Every probe here does a REAL live check (DB round-trip, actual outbound API call, in-process
// service resolution) - none of this is fabricated or cached history. No probe can throw past
// its own try/catch, so one dead integration never 500s the rest of the board.
[ApiController]
[Route("api/admin/health")]
[Authorize(Roles = "Admin")]
[RequireSection(Sections.AdminHealth)]
public class AdminHealthController : ControllerBase
{
    private static readonly TimeSpan ProbeTimeout = TimeSpan.FromSeconds(5);

    private readonly AppDbContext _db;
    private readonly IServiceProvider _services;
    private readonly IOptions<ShopifyOptions> _shopifyOptions;
    private readonly IOptions<OzonExpressOptions> _ozonOptions;
    private readonly IHubContext<InventoryHub>? _hub;

    public AdminHealthController(
        AppDbContext db,
        IServiceProvider services,
        IOptions<ShopifyOptions> shopifyOptions,
        IOptions<OzonExpressOptions> ozonOptions,
        IHubContext<InventoryHub>? hub = null)
    {
        _db = db;
        _services = services;
        _shopifyOptions = shopifyOptions;
        _ozonOptions = ozonOptions;
        _hub = hub;
    }

    [HttpGet("full")]
    public async Task<IActionResult> GetFull(CancellationToken ct)
    {
        var probes = await Task.WhenAll(
            RunProbe("Base de données", "Core", () => CheckDatabaseAsync(ct)),
            RunProbe("Table Produits", "Core", () => CheckTableAsync("Products", () => _db.Products.CountAsync(ct))),
            RunProbe("Table Ventes", "Core", () => CheckTableAsync("Sales", () => _db.Sales.CountAsync(ct))),
            RunProbe("Table Clients", "Core", () => CheckTableAsync("Clients", () => _db.Clients.CountAsync(ct))),
            RunProbe("Temps réel (SignalR)", "Core", () => CheckSignalRAsync()),
            RunProbe("Intégration Shopify", "Intégrations", () => CheckShopifyAsync(ct)),
            RunProbe("Intégration OzonExpress", "Intégrations", () => CheckOzonExpressAsync(ct)),
            RunProbe("Synchronisation VPS ↔ local", "Intégrations", () => CheckSyncFreshnessAsync(ct))
        );

        var overall = probes.Any(p => p.Status == "down" && p.Category == "Core")
            ? "down"
            : probes.Any(p => p.Status is "down" or "degraded")
                ? "degraded"
                : "healthy";

        return Ok(new HealthBoardDto(overall, DateTime.UtcNow, probes.ToList()));
    }

    private async Task<HealthProbeResult> RunProbe(string name, string category, Func<Task<(string status, string message)>> probe)
    {
        var start = DateTime.UtcNow;
        try
        {
            var task = probe();
            var winner = await Task.WhenAny(task, Task.Delay(ProbeTimeout));
            if (winner != task)
                return new HealthProbeResult(name, category, "down", "Délai dépassé (>5s)", (long)(DateTime.UtcNow - start).TotalMilliseconds, DateTime.UtcNow);

            var (status, message) = await task;
            return new HealthProbeResult(name, category, status, message, (long)(DateTime.UtcNow - start).TotalMilliseconds, DateTime.UtcNow);
        }
        catch (Exception ex)
        {
            return new HealthProbeResult(name, category, "down", ex.Message, (long)(DateTime.UtcNow - start).TotalMilliseconds, DateTime.UtcNow);
        }
    }

    private async Task<(string, string)> CheckDatabaseAsync(CancellationToken ct)
    {
        var canConnect = await _db.Database.CanConnectAsync(ct);
        return canConnect ? ("healthy", "Connexion PostgreSQL OK") : ("down", "Impossible de se connecter");
    }

    private async Task<(string, string)> CheckTableAsync(string label, Func<Task<int>> countAsync)
    {
        var count = await countAsync();
        return ("healthy", $"{count} enregistrement(s) accessibles");
    }

    private Task<(string, string)> CheckSignalRAsync()
    {
        // In-process resolution check, not a real client round-trip - if the hub context resolves,
        // the SignalR pipeline is wired correctly; genuine connectivity is exercised continuously
        // by every open POS session already.
        return Task.FromResult(_hub is not null
            ? ("healthy", "Hub InventoryHub actif")
            : ("down", "Hub InventoryHub non résolu"));
    }

    private async Task<(string, string)> CheckShopifyAsync(CancellationToken ct)
    {
        if (!_shopifyOptions.Value.Enabled)
            return ("not_configured", "Désactivé (installation locale de secours)");
        if (string.IsNullOrEmpty(_shopifyOptions.Value.ShopDomain))
            return ("not_configured", "Aucun domaine Shopify configuré");

        var client = _services.GetService<IShopifyApiClient>();
        if (client is null)
            return ("not_configured", "Identifiants Shopify manquants ou incomplets");

        try
        {
            var locations = await client.GetLocationsAsync(ct);
            return locations is not null
                ? ("healthy", $"API Shopify accessible ({locations.Locations?.Count ?? 0} emplacement(s))")
                : ("degraded", "Réponse Shopify vide");
        }
        catch (Exception ex)
        {
            return ("down", $"Appel Shopify échoué: {ex.Message}");
        }
    }

    private async Task<(string, string)> CheckOzonExpressAsync(CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_ozonOptions.Value.CustomerId) || string.IsNullOrWhiteSpace(_ozonOptions.Value.ApiKey))
            return ("not_configured", "Identifiants OzonExpress manquants");

        var client = _services.GetService<IOzonExpressApiClient>();
        if (client is null)
            return ("not_configured", "Client OzonExpress non initialisé");

        try
        {
            var cities = await client.GetCitiesAsync(ct);
            return ("healthy", $"API OzonExpress accessible ({cities.Count} ville(s))");
        }
        catch (Exception ex)
        {
            return ("down", $"Appel OzonExpress échoué: {ex.Message}");
        }
    }

    private async Task<(string, string)> CheckSyncFreshnessAsync(CancellationToken ct)
    {
        var state = await _db.SyncStates.FirstOrDefaultAsync(ct);
        if (state?.LastSyncedAt is null)
            return ("not_configured", "Aucune synchronisation reçue (normal côté VPS)");

        var age = DateTime.UtcNow - state.LastSyncedAt.Value;
        return age <= TimeSpan.FromHours(36)
            ? ("healthy", $"Dernière synchronisation il y a {FormatAge(age)}")
            : ("degraded", $"Dernière synchronisation il y a {FormatAge(age)} - vérifier la tâche planifiée");
    }

    private static string FormatAge(TimeSpan age) =>
        age.TotalHours < 1 ? $"{(int)age.TotalMinutes} min" : $"{age.TotalHours:0.#} h";
}

public record HealthProbeResult(string Name, string Category, string Status, string Message, long LatencyMs, DateTime CheckedAt);
public record HealthBoardDto(string OverallStatus, DateTime GeneratedAt, List<HealthProbeResult> Probes);
