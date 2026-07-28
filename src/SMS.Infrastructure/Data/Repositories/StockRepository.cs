using Microsoft.EntityFrameworkCore;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Infrastructure.Data.Repositories;

public class StockRepository : IStockRepository
{
    private readonly AppDbContext _context;

    public StockRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<StockItem?> GetByVariantIdAsync(int productVariantId, CancellationToken ct = default)
        => await _context.StockItems
            .Include(s => s.ProductVariant)
                .ThenInclude(v => v.Product)
            .Include(s => s.ProductVariant)
                .ThenInclude(v => v.Color)
            .Include(s => s.ProductVariant)
                .ThenInclude(v => v.Size)
            .FirstOrDefaultAsync(s => s.ProductVariantId == productVariantId, ct);

    public async Task<StockItem?> GetByVariantIdWithRowVersionAsync(int productVariantId, CancellationToken ct = default)
        => await _context.StockItems
            .Include(s => s.ProductVariant)
            .FirstOrDefaultAsync(s => s.ProductVariantId == productVariantId, ct);

    public async Task<IReadOnlyList<StockItem>> GetAllWithVariantAsync(CancellationToken ct = default)
        => await _context.StockItems
            .AsNoTracking()
            .Include(s => s.ProductVariant)
                .ThenInclude(v => v.Product)
            .Include(s => s.ProductVariant)
                .ThenInclude(v => v.Color)
            .Include(s => s.ProductVariant)
                .ThenInclude(v => v.Size)
            .OrderBy(s => s.ProductVariant.Product.Name)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<StockItem>> GetLowStockAsync(CancellationToken ct = default)
        => await _context.StockItems
            .AsNoTracking()
            .Include(s => s.ProductVariant)
                .ThenInclude(v => v.Product)
            .Include(s => s.ProductVariant)
                .ThenInclude(v => v.Color)
            .Include(s => s.ProductVariant)
                .ThenInclude(v => v.Size)
            .Where(s => s.QuantityOnHand <= s.ReorderLevel && s.ProductVariant.Product.IsActive)
            .OrderBy(s => s.QuantityOnHand)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<StockMovement>> GetMovementsAsync(
        int? productVariantId, DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        var query = _context.StockMovements
            .AsNoTracking()
            .Include(m => m.ProductVariant)
                .ThenInclude(v => v.Product)
            .Include(m => m.ProductVariant)
                .ThenInclude(v => v.Color)
            .Include(m => m.ProductVariant)
                .ThenInclude(v => v.Size)
            .Include(m => m.User)
            .AsQueryable();

        if (productVariantId.HasValue)
            query = query.Where(m => m.ProductVariantId == productVariantId.Value);
        if (from.HasValue)
            query = query.Where(m => m.CreatedAt >= from.Value);
        if (to.HasValue)
            query = query.Where(m => m.CreatedAt <= to.Value);

        return await query.OrderByDescending(m => m.CreatedAt).ToListAsync(ct);
    }

    public async Task<StockItem> AddItemAsync(StockItem item, CancellationToken ct = default)
    {
        await _context.StockItems.AddAsync(item, ct);
        return item;
    }

    public async Task AddMovementAsync(StockMovement movement, CancellationToken ct = default)
    {
        await _context.StockMovements.AddAsync(movement, ct);
    }

    public void Remove(StockItem item)
    {
        _context.StockItems.Remove(item);
    }
}
