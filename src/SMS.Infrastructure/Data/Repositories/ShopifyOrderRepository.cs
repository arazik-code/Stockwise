using Microsoft.EntityFrameworkCore;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Infrastructure.Data.Repositories;

public class ShopifyOrderRepository : Repository<ShopifyOrder>, IShopifyOrderRepository
{
    public ShopifyOrderRepository(AppDbContext context) : base(context) { }

    public async Task<ShopifyOrder?> GetByShopifyOrderIdAsync(long shopifyOrderId, CancellationToken ct = default)
        => await _dbSet
            .Include(o => o.LineItems)
            .FirstOrDefaultAsync(o => o.ShopifyOrderId == shopifyOrderId, ct);

    public async Task<IReadOnlyList<ShopifyOrder>> GetRecentAsync(int count = 50, CancellationToken ct = default)
        => await _dbSet
            .Include(o => o.LineItems)
            .OrderByDescending(o => o.ShopifyCreatedAt)
            .Take(count)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ShopifyOrder>> GetPendingConflictsAsync(CancellationToken ct = default)
        => await _dbSet
            .Include(o => o.LineItems)
            .Where(o => o.LocalStatus == Domain.Enums.OrderStatus.InventoryConflict)
            .OrderByDescending(o => o.ShopifyCreatedAt)
            .ToListAsync(ct);
}
