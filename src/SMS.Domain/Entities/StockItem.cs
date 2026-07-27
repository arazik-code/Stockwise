using System.ComponentModel.DataAnnotations.Schema;

namespace SMS.Domain.Entities;

public class StockItem
{
    public int Id { get; set; }
    public int ProductVariantId { get; set; }
    public ProductVariant ProductVariant { get; set; } = null!;
    public int QuantityOnHand { get; set; }
    public int QuantityReserved { get; set; }
    public int ReorderLevel { get; set; }
    public int ReorderQuantity { get; set; }
    public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;

    [NotMapped]
    public int QuantityAvailable => QuantityOnHand - QuantityReserved;
}
