using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;

namespace SMS.Infrastructure.Shopify;

public static class ShopifyWebhookValidator
{
    public static async Task<bool> VerifyAsync(HttpRequest request, string webhookSecret)
    {
        request.EnableBuffering();

        using var reader = new StreamReader(request.Body, Encoding.UTF8, leaveOpen: true);
        var body = await reader.ReadToEndAsync();
        request.Body.Position = 0;

        var hmacHeader = request.Headers["X-Shopify-Hmac-Sha256"].FirstOrDefault();
        if (string.IsNullOrEmpty(hmacHeader))
            return false;

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(webhookSecret));
        var computedHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(body));
        var computedHmac = Convert.ToBase64String(computedHash);

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(computedHmac),
            Encoding.UTF8.GetBytes(hmacHeader));
    }
}
