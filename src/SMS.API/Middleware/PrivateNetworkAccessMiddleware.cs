namespace SMS.API.Middleware;

// Chrome/Edge's Private Network Access policy blocks a page served from a public origin
// (https://flexshoes.cloud) from calling a private/loopback address (http://localhost:5001 - the
// hardware axios instance in hardwareClient.ts, deliberately always-local for printer/scanner
// calls) unless the target explicitly opts in. The browser sends a CORS preflight carrying
// "Access-Control-Request-Private-Network: true"; without a matching
// "Access-Control-Allow-Private-Network: true" on the response, it blocks the real request with
// "Permission was denied for this request to access the loopback address space" - no error the
// server ever sees, since the browser never sends the actual request. ASP.NET Core's built-in CORS
// middleware doesn't add this header, so it has to be injected here, before UseCors runs.
public class PrivateNetworkAccessMiddleware
{
    private readonly RequestDelegate _next;

    public PrivateNetworkAccessMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Headers.TryGetValue("Access-Control-Request-Private-Network", out var value) &&
            value == "true")
        {
            context.Response.Headers["Access-Control-Allow-Private-Network"] = "true";
        }

        await _next(context);
    }
}

public static class PrivateNetworkAccessMiddlewareExtensions
{
    public static IApplicationBuilder UsePrivateNetworkAccess(this IApplicationBuilder app)
        => app.UseMiddleware<PrivateNetworkAccessMiddleware>();
}
