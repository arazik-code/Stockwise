using SMS.Domain.Entities;

namespace SMS.Domain.Interfaces;

public interface IStockRepository
{
    Task<StockItem?> GetByVariantIdAsync(int productVariantId, CancellationToken ct = default);
    Task<StockItem?> GetByVariantIdWithRowVersionAsync(int productVariantId, CancellationToken ct = default);
    Task<IReadOnlyList<StockItem>> GetAllWithVariantAsync(CancellationToken ct = default);
    Task<IReadOnlyList<StockItem>> GetLowStockAsync(CancellationToken ct = default);
    Task<IReadOnlyList<StockMovement>> GetMovementsAsync(int? productVariantId, DateTime? from, DateTime? to, CancellationToken ct = default);
    Task<StockItem> AddItemAsync(StockItem item, CancellationToken ct = default);
    Task AddMovementAsync(StockMovement movement, CancellationToken ct = default);
    void Remove(StockItem item);
}
