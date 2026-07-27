using Microsoft.EntityFrameworkCore;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Infrastructure.Data.Repositories;

public class LoyaltyTransactionRepository : ILoyaltyTransactionRepository
{
    private readonly AppDbContext _context;

    public LoyaltyTransactionRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<LoyaltyTransaction>> GetByClientIdAsync(int clientId, CancellationToken ct = default)
        => await _context.LoyaltyTransactions
            .Where(t => t.ClientId == clientId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

    public void Add(LoyaltyTransaction transaction)
        => _context.LoyaltyTransactions.Add(transaction);
}
