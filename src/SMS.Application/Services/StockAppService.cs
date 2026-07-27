using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SMS.Application.DTOs.Stock;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class StockAppService : IStockService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IInventoryNotifier _notifier;
    private readonly ILogger<StockAppService> _logger;

    public StockAppService(IUnitOfWork unitOfWork, IInventoryNotifier notifier, ILogger<StockAppService> logger)
    {
        _unitOfWork = unitOfWork;
        _notifier = notifier;
        _logger = logger;
    }

    public async Task<IReadOnlyList<StockItemDto>> GetAllStockAsync(CancellationToken ct = default)
    {
        var items = await _unitOfWork.Stock.GetAllWithVariantAsync(ct);
        return items.Select(MapToDto).ToList();
    }

    public async Task<StockItemDto?> GetStockByVariantAsync(int productVariantId, CancellationToken ct = default)
    {
        var item = await _unitOfWork.Stock.GetByVariantIdAsync(productVariantId, ct);
        return item is null ? null : MapToDto(item);
    }

    public async Task<IReadOnlyList<StockItemDto>> GetLowStockAsync(CancellationToken ct = default)
    {
        var items = await _unitOfWork.Stock.GetLowStockAsync(ct);
        return items.Select(MapToDto).ToList();
    }

    public async Task AdjustStockAsync(AdjustStockRequest request, int? userId = null, CancellationToken ct = default)
    {
        const int maxRetries = 3;

        for (int attempt = 0; attempt < maxRetries; attempt++)
        {
            try
            {
                var stockItem = await _unitOfWork.Stock.GetByVariantIdWithRowVersionAsync(request.ProductVariantId, ct)
                    ?? throw new KeyNotFoundException($"Stock not found for product variant {request.ProductVariantId}");

                var previousQuantity = stockItem.QuantityOnHand;
                var quantityChange = request.ResolveQuantityChange(previousQuantity);
                var newQuantity = previousQuantity + quantityChange;

                if (newQuantity < 0)
                    throw new InvalidOperationException("Stock quantity cannot be negative.");

                stockItem.QuantityOnHand = newQuantity;
                stockItem.LastUpdatedAt = DateTime.UtcNow;

                var movement = new StockMovement
                {
                    ProductVariantId = request.ProductVariantId,
                    Type = StockMovementType.Adjustment,
                    QuantityChange = quantityChange,
                    QuantityAfter = newQuantity,
                    Reference = request.Reference,
                    Notes = request.Notes,
                    UserId = userId
                };

                await _unitOfWork.Stock.AddMovementAsync(movement, ct);
                await _unitOfWork.SaveChangesAsync(ct);

                await _notifier.NotifyStockChangedAsync(request.ProductVariantId, newQuantity, ct);

                if (newQuantity <= stockItem.ReorderLevel)
                {
                    var variantName = stockItem.ProductVariant?.Product?.Name ?? "Unknown";
                    await _notifier.NotifyLowStockAsync(request.ProductVariantId, variantName, newQuantity, ct);
                }

                return;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogWarning(ex, "Concurrency conflict adjusting stock for variant {ProductVariantId}, attempt {Attempt}",
                    request.ProductVariantId, attempt + 1);

                if (attempt == maxRetries - 1)
                    throw new InvalidOperationException("Stock adjustment failed due to concurrent modification. Please try again.");

                await Task.Delay(100 * (attempt + 1), ct);
            }
        }
    }

    public async Task SetQuantityAsync(int productVariantId, int newQuantity, string? notes = null, int? userId = null, CancellationToken ct = default)
    {
        if (newQuantity < 0)
            throw new InvalidOperationException("Stock quantity cannot be negative.");

        var stockItem = await _unitOfWork.Stock.GetByVariantIdWithRowVersionAsync(productVariantId, ct)
            ?? throw new KeyNotFoundException($"Stock not found for product variant {productVariantId}");

        var previousQuantity = stockItem.QuantityOnHand;
        var quantityChange = newQuantity - previousQuantity;

        stockItem.QuantityOnHand = newQuantity;
        stockItem.LastUpdatedAt = DateTime.UtcNow;

        var movement = new StockMovement
        {
            ProductVariantId = productVariantId,
            Type = StockMovementType.Adjustment,
            QuantityChange = quantityChange,
            QuantityAfter = newQuantity,
            Reference = "Manual",
            Notes = notes ?? $"Set quantity from {previousQuantity} to {newQuantity}",
            UserId = userId
        };

        await _unitOfWork.Stock.AddMovementAsync(movement, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _notifier.NotifyStockChangedAsync(productVariantId, newQuantity, ct);

        if (newQuantity <= stockItem.ReorderLevel)
        {
            var variantName = stockItem.ProductVariant?.Product?.Name ?? "Unknown";
            await _notifier.NotifyLowStockAsync(productVariantId, variantName, newQuantity, ct);
        }
    }

    public async Task DeleteStockAsync(int productVariantId, CancellationToken ct = default)
    {
        var stockItem = await _unitOfWork.Stock.GetByVariantIdAsync(productVariantId, ct)
            ?? throw new KeyNotFoundException($"Stock not found for product variant {productVariantId}");

        _unitOfWork.Stock.Remove(stockItem);
        await _unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<StockMovementDto>> GetMovementsAsync(int? productVariantId, DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        var movements = await _unitOfWork.Stock.GetMovementsAsync(productVariantId, from, to, ct);
        return movements.Select(m => new StockMovementDto
        {
            Id = (int)m.Id,
            ProductVariantId = m.ProductVariantId,
            ProductName = m.ProductVariant?.Product?.Name ?? string.Empty,
            VariantSku = m.ProductVariant?.Sku ?? string.Empty,
            ColorName = m.ProductVariant?.Color?.Name ?? string.Empty,
            SizeValue = m.ProductVariant?.Size?.Value ?? string.Empty,
            QuantityChange = m.QuantityChange,
            PreviousQuantity = m.QuantityAfter - m.QuantityChange,
            QuantityAfter = m.QuantityAfter,
            Reason = m.Notes ?? string.Empty,
            Reference = m.Reference,
            UserName = m.User?.FullName,
            CreatedAt = m.CreatedAt
        }).ToList();
    }

    private static StockItemDto MapToDto(StockItem s) => new()
    {
        Id = s.Id,
        ProductVariantId = s.ProductVariantId,
        ProductName = s.ProductVariant?.Product?.Name ?? string.Empty,
        ColorName = s.ProductVariant?.Color?.Name ?? string.Empty,
        SizeValue = s.ProductVariant?.Size?.Value ?? string.Empty,
        Sku = s.ProductVariant?.Sku ?? string.Empty,
        Barcode = s.ProductVariant?.Barcode,
        QuantityOnHand = s.QuantityOnHand,
        QuantityReserved = s.QuantityReserved,
        ReorderLevel = s.ReorderLevel,
        LastUpdated = s.LastUpdatedAt
    };
}
