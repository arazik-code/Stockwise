using SMS.Domain.Enums;

namespace SMS.Domain.Entities;

public class StockMovement
{
    public long Id { get; set; }
    public int ProductVariantId { get; set; }
    public ProductVariant ProductVariant { get; set; } = null!;
    public StockMovementType Type { get; set; }
    public int QuantityChange { get; set; }
    public int QuantityAfter { get; set; }
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public int? UserId { get; set; }
    public User? User { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
