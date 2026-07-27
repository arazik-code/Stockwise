using Microsoft.EntityFrameworkCore;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Infrastructure.Data.Repositories;

public class ProductRepository : Repository<Product>, IProductRepository
{
    public ProductRepository(AppDbContext context) : base(context) { }

    public async Task<Product?> GetWithStockAsync(int id, CancellationToken ct = default)
        => await _dbSet
            .Include(p => p.Variants)
                .ThenInclude(v => v.StockItem)
            .Include(p => p.Variants)
                .ThenInclude(v => v.Color)
            .Include(p => p.Variants)
                .ThenInclude(v => v.Size)
            .Include(p => p.Category)
            .Include(p => p.Fournisseur)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task<Product?> GetByBarcodeAsync(string barcode, CancellationToken ct = default)
        => await _dbSet
            .Include(p => p.Variants)
                .ThenInclude(v => v.StockItem)
            .Include(p => p.Variants)
                .ThenInclude(v => v.Color)
            .Include(p => p.Variants)
                .ThenInclude(v => v.Size)
            .Include(p => p.Category)
            .Include(p => p.Fournisseur)
            .FirstOrDefaultAsync(p => p.Barcode == barcode && p.IsActive, ct);

    public async Task<IReadOnlyList<Product>> SearchAsync(string query, CancellationToken ct = default)
    {
        var lowerQuery = query.ToLower();
        return await _dbSet
            .Include(p => p.Variants)
                .ThenInclude(v => v.Color)
            .Include(p => p.Variants)
                .ThenInclude(v => v.Size)
            .Include(p => p.Variants)
                .ThenInclude(v => v.StockItem)
            .Include(p => p.Category)
            .Where(p => p.IsActive &&
                (p.Name.ToLower().Contains(lowerQuery) ||
                 p.Brand != null && p.Brand.ToLower().Contains(lowerQuery) ||
                 p.Variants.Any(v => v.Sku.ToLower().Contains(lowerQuery) ||
                                     (v.Barcode != null && v.Barcode.Contains(query)))))
            .OrderBy(p => p.Name)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<Product>> GetByCategoryAsync(int categoryId, CancellationToken ct = default)
        => await _dbSet
            .Include(p => p.Variants)
                .ThenInclude(v => v.Color)
            .Include(p => p.Variants)
                .ThenInclude(v => v.Size)
            .Include(p => p.Variants)
                .ThenInclude(v => v.StockItem)
            .Include(p => p.Category)
            .Where(p => p.CategoryId == categoryId && p.IsActive)
            .OrderBy(p => p.Name)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Product>> GetByFournisseurAsync(int fournisseurId, CancellationToken ct = default)
        => await _dbSet
            .Include(p => p.Variants)
                .ThenInclude(v => v.Color)
            .Include(p => p.Variants)
                .ThenInclude(v => v.Size)
            .Include(p => p.Variants)
                .ThenInclude(v => v.StockItem)
            .Include(p => p.Category)
            .Where(p => p.FournisseurId == fournisseurId && p.IsActive)
            .OrderBy(p => p.Name)
            .ToListAsync(ct);

    public override async Task<IReadOnlyList<Product>> GetAllAsync(CancellationToken ct = default)
        => await _dbSet
            .Include(p => p.Variants)
                .ThenInclude(v => v.Color)
            .Include(p => p.Variants)
                .ThenInclude(v => v.Size)
            .Include(p => p.Variants)
                .ThenInclude(v => v.StockItem)
            .Include(p => p.Category)
            .Include(p => p.Fournisseur)
            .Where(p => p.IsActive)
            .OrderBy(p => p.Name)
            .ToListAsync(ct);
}
