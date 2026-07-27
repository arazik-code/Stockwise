using SMS.Application.Interfaces;

namespace SMS.Infrastructure.Shopify;

public class ShopifyAuthHandler : DelegatingHandler
{
    private readonly IShopifyTokenProvider _tokenProvider;

    public ShopifyAuthHandler(IShopifyTokenProvider tokenProvider)
    {
        _tokenProvider = tokenProvider;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var token = await _tokenProvider.GetAccessTokenAsync(ct);
        if (!string.IsNullOrEmpty(token))
        {
            request.Headers.Remove("X-Shopify-Access-Token");
            request.Headers.Add("X-Shopify-Access-Token", token);
        }

        return await base.SendAsync(request, ct);
    }
}
