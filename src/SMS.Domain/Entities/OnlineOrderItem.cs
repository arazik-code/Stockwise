namespace SMS.Domain.Entities;

public class OnlineOrderItem
{
    public int Id { get; set; }
    public int OnlineOrderId { get; set; }
    public OnlineOrder OnlineOrder { get; set; } = null!;

    public int ProductVariantId { get; set; }
    public ProductVariant ProductVariant { get; set; } = null!;

    public string ProductNameSnapshot { get; set; } = string.Empty;
    public string SkuSnapshot { get; set; } = string.Empty;

    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal LineTotal { get; set; }

    public int QuantityReserved { get; set; }
    public int QuantityFulfilled { get; set; }
}
