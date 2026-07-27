using SMS.Domain.Entities;
using SMS.Domain.Enums;

namespace SMS.Domain.Interfaces;

public interface IOnlineOrderRepository
{
    Task<OnlineOrder?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<OnlineOrder?> GetByOrderNumberAsync(string orderNumber, CancellationToken ct = default);
    Task<OnlineOrder?> GetByShopifyOrderIdAsync(long shopifyOrderId, CancellationToken ct = default);
    Task<IReadOnlyList<OnlineOrder>> GetAllAsync(
        OnlineOrderChannel? channel = null,
        OrderStatus? status = null,
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken ct = default);
    Task<IReadOnlyList<OnlineOrder>> GetConflictsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<OnlineOrder>> GetByClientIdAsync(int clientId, CancellationToken ct = default);
    Task<string> GenerateOrderNumberAsync(OnlineOrderChannel channel, CancellationToken ct = default);
    Task AddAsync(OnlineOrder order, CancellationToken ct = default);
    void Update(OnlineOrder order);
}
