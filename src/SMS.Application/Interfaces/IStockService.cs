using SMS.Application.DTOs.Stock;

namespace SMS.Application.Interfaces;

public interface IStockService
{
    Task<IReadOnlyList<StockItemDto>> GetAllStockAsync(CancellationToken ct = default);
    Task<StockItemDto?> GetStockByVariantAsync(int productVariantId, CancellationToken ct = default);
    Task<IReadOnlyList<StockItemDto>> GetLowStockAsync(CancellationToken ct = default);
    Task AdjustStockAsync(AdjustStockRequest request, int? userId = null, CancellationToken ct = default);
    Task SetQuantityAsync(int productVariantId, int newQuantity, string? notes = null, int? userId = null, CancellationToken ct = default);
    Task DeleteStockAsync(int productVariantId, CancellationToken ct = default);
    Task<IReadOnlyList<StockMovementDto>> GetMovementsAsync(int? productVariantId, DateTime? from, DateTime? to, CancellationToken ct = default);
}
