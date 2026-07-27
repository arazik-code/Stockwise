using SMS.Application.DTOs.Shopify;

namespace SMS.Application.Interfaces;

public interface IShopifySyncService
{
    Task ProcessOrderCreatedAsync(long shopifyOrderId, string orderNumber, string financialStatus,
        string fulfillmentStatus, decimal totalPrice, string currency, string? customerEmail,
        string? customerName, List<ShopifyLineItemDto> lineItems, DateTime createdAt,
        string? customerPhone = null, string? city = null, string? addressLine = null,
        long? shopifyCustomerId = null, CancellationToken ct = default);
    Task ProcessOrderCancelledAsync(long shopifyOrderId, CancellationToken ct = default);
    Task SyncRecentOrdersAsync(CancellationToken ct = default);
    Task SyncInventoryLevelsAsync(CancellationToken ct = default);
    Task<ShopifySyncStatusDto> GetSyncStatusAsync(CancellationToken ct = default);
    Task<IReadOnlyList<ShopifyLocationDto>> GetLocationsAsync(CancellationToken ct = default);
}

public class ShopifyLocationDto
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? City { get; set; }
    public bool Active { get; set; }
}

public class ShopifyLineItemDto
{
    public long ProductId { get; set; }
    public long VariantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal Price { get; set; }
}
