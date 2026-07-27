namespace SMS.API.Endpoints;

public static class HealthEndpoints
{
    public static void MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }))
            .AllowAnonymous();

        app.MapGet("/api/health/shopify", () =>
        {
            return Results.Ok(new { status = "connected", timestamp = DateTime.UtcNow });
        }).AllowAnonymous();
    }
}
