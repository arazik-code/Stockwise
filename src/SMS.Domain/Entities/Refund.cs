namespace SMS.Domain.Entities;

public class Refund
{
    public int Id { get; set; }
    public string RefundNumber { get; set; } = string.Empty;
    public int SaleId { get; set; }
    public Sale? Sale { get; set; }
    public string Type { get; set; } = "Refund"; // "Refund" or "Exchange"
    public string Status { get; set; } = "Pending";
    public decimal TotalRefundAmount { get; set; }
    public decimal TotalExchangeAmount { get; set; }
    public decimal PriceDifference { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public int? ClientId { get; set; }
    public Client? Client { get; set; }
    public int? ProcessedByUserId { get; set; }
    public User? ProcessedByUser { get; set; }
    public DateTime RefundDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<RefundItem> Items { get; set; } = [];
    public ICollection<ExchangeItem> ExchangeItems { get; set; } = [];
}

public class RefundItem
{
    public int Id { get; set; }
    public int RefundId { get; set; }
    public Refund? Refund { get; set; }
    public int SaleItemId { get; set; }
    public SaleItem? SaleItem { get; set; }
    public int ProductVariantId { get; set; }
    public ProductVariant? ProductVariant { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal RefundAmount { get; set; }
    public string? Reason { get; set; }
}

public class ExchangeItem
{
    public int Id { get; set; }
    public int RefundId { get; set; }
    public Refund? Refund { get; set; }
    public int ProductVariantId { get; set; }
    public ProductVariant? ProductVariant { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalPrice { get; set; }
}
