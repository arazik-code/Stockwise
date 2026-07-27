using SMS.Domain.Entities;

namespace SMS.Domain.Interfaces;

public interface IShopifyOrderRepository : IRepository<ShopifyOrder>
{
    Task<ShopifyOrder?> GetByShopifyOrderIdAsync(long shopifyOrderId, CancellationToken ct = default);
    Task<IReadOnlyList<ShopifyOrder>> GetRecentAsync(int count = 50, CancellationToken ct = default);
    Task<IReadOnlyList<ShopifyOrder>> GetPendingConflictsAsync(CancellationToken ct = default);
}
