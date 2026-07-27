namespace SMS.Application.DTOs.Stock;

public class StockItemDto
{
    public int Id { get; set; }
    public int ProductVariantId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string ColorName { get; set; } = string.Empty;
    public string SizeValue { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public int QuantityOnHand { get; set; }
    public int QuantityReserved { get; set; }
    public int QuantityAvailable => QuantityOnHand - QuantityReserved;
    public int ReorderLevel { get; set; }
    public bool IsLowStock => QuantityOnHand <= ReorderLevel;
    public string? WarehouseName { get; set; }
    public DateTime LastUpdated { get; set; }
}

public class StockMovementDto
{
    public int Id { get; set; }
    public int ProductVariantId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string VariantSku { get; set; } = string.Empty;
    public string ColorName { get; set; } = string.Empty;
    public string SizeValue { get; set; } = string.Empty;
    public int QuantityChange { get; set; }
    public int PreviousQuantity { get; set; }
    public int QuantityAfter { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Reference { get; set; }
    public string? UserName { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AdjustStockRequest
{
    public int ProductVariantId { get; set; }
    public int? AdjustmentDelta { get; set; }
    public int? NewQuantity { get; set; }
    public string? Notes { get; set; }
    public string? Reference { get; set; }

    public int ResolveQuantityChange(int currentQuantity)
    {
        if (NewQuantity.HasValue)
            return NewQuantity.Value - currentQuantity;
        return AdjustmentDelta ?? 0;
    }
}

public class SetQuantityRequest
{
    public int ProductVariantId { get; set; }
    public int NewQuantity { get; set; }
    public string? Notes { get; set; }
}

public class StockSummaryDto
{
    public int TotalVariants { get; set; }
    public int LowStockCount { get; set; }
    public int OutOfStockCount { get; set; }
    public int TotalQuantity { get; set; }
    public decimal TotalValue { get; set; }
    public List<StockItemDto> LowStockItems { get; set; } = [];
}
