using System.Text;
using System.Text.RegularExpressions;

namespace SMS.API.Middleware;

public partial class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers["X-Content-Type-Options"] = "nosniff";
            headers["X-Frame-Options"] = "DENY";
            headers["X-XSS-Protection"] = "1; mode=block";
            headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
            headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";

            if (!context.Request.Path.StartsWithSegments("/hubs"))
            {
                // script-src needs cdn.jsdelivr.net - printed barcode/label HTML (BarcodeLabel.tsx,
                // ReceiptDesigner.tsx) loads JsBarcode from there via a <script> tag, and that HTML is
                // opened in a same-origin window/frame that inherits this page's CSP. img-src needs
                // api.qrserver.com for the receipt template's demo QR preview, alongside Shopify's CDN
                // for product images. connect-src needs http://localhost:5001 - the desktop app's local
                // hardware bridge (api/hardwareClient.ts) polls the printer/scanner status endpoint
                // there directly from the renderer, outside the main API origin.
                headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://cdn.shopify.com https://*.shopifycdn.com https://api.qrserver.com; font-src 'self' data:; connect-src 'self' wss: ws: http://localhost:5001;";
            }

            if (context.Request.IsHttps)
            {
                headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
            }

            return Task.CompletedTask;
        });

        await _next(context);
    }
}
