namespace SMS.Application.Interfaces;

public interface IInventoryNotifier
{
    Task NotifyStockChangedAsync(int productId, int newQuantity, CancellationToken ct = default);
    Task NotifyLowStockAsync(int productId, string productName, int quantity, CancellationToken ct = default);
    Task NotifyNewShopifyOrderAsync(string orderNumber, decimal total, CancellationToken ct = default);
    Task NotifyNewOnlineOrderAsync(string channel, string orderNumber, decimal total, CancellationToken ct = default);
    Task NotifyOrderStatusChangedAsync(int orderId, string status, CancellationToken ct = default);
}
