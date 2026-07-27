using SMS.Domain.Entities;

namespace SMS.Domain.Interfaces;

public interface IProductRepository : IRepository<Product>
{
    Task<Product?> GetWithStockAsync(int id, CancellationToken ct = default);
    Task<Product?> GetByBarcodeAsync(string barcode, CancellationToken ct = default);
    Task<IReadOnlyList<Product>> SearchAsync(string query, CancellationToken ct = default);
    Task<IReadOnlyList<Product>> GetByCategoryAsync(int categoryId, CancellationToken ct = default);
    Task<IReadOnlyList<Product>> GetByFournisseurAsync(int fournisseurId, CancellationToken ct = default);
}
