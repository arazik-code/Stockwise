using SMS.Domain.Enums;

namespace SMS.Domain.Entities;

public class ShopifyOrder
{
    public int Id { get; set; }
    public long ShopifyOrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string FinancialStatus { get; set; } = string.Empty;
    public string FulfillmentStatus { get; set; } = string.Empty;
    public decimal TotalPrice { get; set; }
    public string Currency { get; set; } = "USD";
    public string? CustomerEmail { get; set; }
    public string? CustomerName { get; set; }
    public string? ShippingAddress { get; set; }
    public OrderStatus LocalStatus { get; set; }
    public bool InventoryDeducted { get; set; }
    public ICollection<ShopifyOrderLineItem> LineItems { get; set; } = [];
    public DateTime ShopifyCreatedAt { get; set; }
    public DateTime SyncedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
