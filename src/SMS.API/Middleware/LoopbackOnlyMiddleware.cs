using System.Net;

namespace SMS.API.Middleware;

// Printer/hardware endpoints only make sense against whichever API instance is physically on/near
// the store's LAN - never across the VPS/local-fallback boundary, and this deliberately avoids
// requiring these calls to carry a cross-domain JWT at all (the frontend's dedicated printer
// axios instance calls these with no Authorization header attached). Trusting the loopback bind
// (the local API is bound to 127.0.0.1 by default - see SMS.Desktop/MainForm.cs) is simpler and
// safer than making printer calls participate in the shared-JWT-secret story the main session
// needs for failover. Runs before UseAuthentication/UseAuthorization so it short-circuits first.
public class LoopbackOnlyMiddleware
{
    private static readonly string[] ProtectedPrefixes = ["/api/printer", "/api/devices"];

    private readonly RequestDelegate _next;

    public LoopbackOnlyMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path;
        var isProtected = ProtectedPrefixes.Any(prefix => path.StartsWithSegments(prefix));

        if (isProtected)
        {
            var remoteIp = context.Connection.RemoteIpAddress;
            var isLoopback = remoteIp is not null && IPAddress.IsLoopback(remoteIp);
            if (!isLoopback)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { message = "Accessible uniquement en local." });
                return;
            }
        }

        await _next(context);
    }
}

public static class LoopbackOnlyMiddlewareExtensions
{
    public static IApplicationBuilder UseLoopbackOnlyForHardwareEndpoints(this IApplicationBuilder app)
        => app.UseMiddleware<LoopbackOnlyMiddleware>();
}
