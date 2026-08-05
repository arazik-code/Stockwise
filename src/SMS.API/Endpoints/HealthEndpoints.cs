using Microsoft.EntityFrameworkCore;
using SMS.Infrastructure.Data;

namespace SMS.API.Endpoints;

public static class HealthEndpoints
{
    public static void MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        // Must actually verify DB connectivity, not just "the process is up" - this is what
        // MainForm.cs's WaitForApiAsync and the VPS/local failover logic both rely on to decide
        // whether a "healthy" API is genuinely usable.
        app.MapGet("/api/health", async (AppDbContext db, CancellationToken ct) =>
        {
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(2));

            bool healthy;
            try
            {
                healthy = await db.Database.CanConnectAsync(timeoutCts.Token);
            }
            catch
            {
                healthy = false;
            }

            return healthy
                ? Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow })
                : Results.Json(new { status = "unhealthy", timestamp = DateTime.UtcNow }, statusCode: StatusCodes.Status503ServiceUnavailable);
        }).AllowAnonymous();

        app.MapGet("/api/health/shopify", () =>
        {
            return Results.Ok(new { status = "connected", timestamp = DateTime.UtcNow });
        }).AllowAnonymous();
    }
}
