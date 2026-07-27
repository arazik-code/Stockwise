namespace SMS.Application.DTOs.Shopify;

public class ShopifyOrderDto
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
    public string LocalStatus { get; set; } = string.Empty;
    public bool InventoryDeducted { get; set; }
    public List<ShopifyOrderLineItemDto> LineItems { get; set; } = [];
    public DateTime ShopifyCreatedAt { get; set; }
    public DateTime SyncedAt { get; set; }
}

public class ShopifyOrderLineItemDto
{
    public string Title { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal Price { get; set; }
    public string? LocalProductName { get; set; }
}
