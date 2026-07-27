using Microsoft.EntityFrameworkCore;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Infrastructure.Data.Repositories;

public class OnlineOrderRepository : IOnlineOrderRepository
{
    private readonly AppDbContext _context;

    public OnlineOrderRepository(AppDbContext context)
    {
        _context = context;
    }

    private IQueryable<OnlineOrder> Query =>
        _context.OnlineOrders
            .Include(o => o.Client)
            .Include(o => o.CreatedByUser)
            .Include(o => o.Items).ThenInclude(i => i.ProductVariant).ThenInclude(v => v.Product)
            .Include(o => o.Items).ThenInclude(i => i.ProductVariant).ThenInclude(v => v.Color)
            .Include(o => o.Items).ThenInclude(i => i.ProductVariant).ThenInclude(v => v.Size)
            .Include(o => o.Items).ThenInclude(i => i.ProductVariant).ThenInclude(v => v.StockItem);

    public async Task<OnlineOrder?> GetByIdAsync(int id, CancellationToken ct = default)
        => await Query.FirstOrDefaultAsync(o => o.Id == id, ct);

    public async Task<OnlineOrder?> GetByOrderNumberAsync(string orderNumber, CancellationToken ct = default)
        => await Query.FirstOrDefaultAsync(o => o.OrderNumber == orderNumber, ct);

    public async Task<OnlineOrder?> GetByShopifyOrderIdAsync(long shopifyOrderId, CancellationToken ct = default)
        => await Query.FirstOrDefaultAsync(o => o.ShopifyOrderId == shopifyOrderId, ct);

    public async Task<IReadOnlyList<OnlineOrder>> GetAllAsync(
        OnlineOrderChannel? channel = null,
        OrderStatus? status = null,
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken ct = default)
    {
        var query = Query;

        if (channel.HasValue) query = query.Where(o => o.Channel == channel.Value);
        if (status.HasValue) query = query.Where(o => o.Status == status.Value);
        if (from.HasValue) query = query.Where(o => o.CreatedAt >= from.Value);
        if (to.HasValue) query = query.Where(o => o.CreatedAt < to.Value);

        return await query.OrderByDescending(o => o.CreatedAt).ToListAsync(ct);
    }

    public async Task<IReadOnlyList<OnlineOrder>> GetConflictsAsync(CancellationToken ct = default)
        => await Query
            .Where(o => o.Status == OrderStatus.InventoryConflict)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<OnlineOrder>> GetByClientIdAsync(int clientId, CancellationToken ct = default)
        => await Query
            .Where(o => o.ClientId == clientId)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(ct);

    public async Task<string> GenerateOrderNumberAsync(OnlineOrderChannel channel, CancellationToken ct = default)
    {
        var prefix = channel switch
        {
            OnlineOrderChannel.WhatsApp => "WA",
            OnlineOrderChannel.Shopify => "SHP",
            _ => "MAN"
        };
        var today = DateTime.UtcNow.ToString("yyyyMMdd");
        var count = await _context.OnlineOrders.CountAsync(o => o.OrderNumber.StartsWith($"{prefix}-{today}"), ct);
        return $"{prefix}-{today}-{(count + 1):D3}";
    }

    public async Task AddAsync(OnlineOrder order, CancellationToken ct = default)
        => await _context.OnlineOrders.AddAsync(order, ct);

    public void Update(OnlineOrder order)
        => _context.OnlineOrders.Update(order);
}
