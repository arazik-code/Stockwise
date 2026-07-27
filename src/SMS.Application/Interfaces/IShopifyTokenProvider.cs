namespace SMS.Application.Interfaces;

public interface IShopifyTokenProvider
{
    Task<string?> GetAccessTokenAsync(CancellationToken ct = default);
}
