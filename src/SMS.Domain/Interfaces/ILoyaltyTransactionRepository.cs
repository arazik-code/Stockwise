using SMS.Domain.Entities;

namespace SMS.Domain.Interfaces;

public interface ILoyaltyTransactionRepository
{
    Task<IReadOnlyList<LoyaltyTransaction>> GetByClientIdAsync(int clientId, CancellationToken ct = default);
    void Add(LoyaltyTransaction transaction);
}
