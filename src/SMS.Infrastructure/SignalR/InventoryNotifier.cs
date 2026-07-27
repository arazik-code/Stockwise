using Microsoft.AspNetCore.SignalR;
using SMS.Application.Interfaces;

namespace SMS.Infrastructure.SignalR;

public class InventoryNotifier : IInventoryNotifier
{
    private readonly IHubContext<InventoryHub> _hubContext;

    public InventoryNotifier(IHubContext<InventoryHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifyStockChangedAsync(int productId, int newQuantity, CancellationToken ct = default)
    {
        await _hubContext.Clients.Group("pos")
            .SendAsync("StockChanged", new { productVariantId = productId, newQuantity }, ct);
    }

    public async Task NotifyLowStockAsync(int productId, string productName, int quantity, CancellationToken ct = default)
    {
        await _hubContext.Clients.Group("pos")
            .SendAsync("LowStockAlert", new { productId, productName, quantity }, ct);
    }

    public async Task NotifyNewShopifyOrderAsync(string orderNumber, decimal total, CancellationToken ct = default)
    {
        await _hubContext.Clients.Group("pos")
            .SendAsync("NewShopifyOrder", new { orderNumber, total }, ct);
    }

    public async Task NotifyNewOnlineOrderAsync(string channel, string orderNumber, decimal total, CancellationToken ct = default)
    {
        await _hubContext.Clients.Group("pos")
            .SendAsync("NewOnlineOrder", new { channel, orderNumber, total }, ct);
    }

    public async Task NotifyOrderStatusChangedAsync(int orderId, string status, CancellationToken ct = default)
    {
        await _hubContext.Clients.Group("pos")
            .SendAsync("OrderStatusChanged", new { orderId, status }, ct);
    }
}
