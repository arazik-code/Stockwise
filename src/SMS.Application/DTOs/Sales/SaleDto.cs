using SMS.Domain.Enums;

namespace SMS.Application.DTOs.Sales;

public class SaleDto
{
    public int Id { get; set; }
    public string SaleNumber { get; set; } = string.Empty;
    public SaleChannel Channel { get; set; }
    public SaleCategory Category { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public decimal SubTotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal AmountPaid { get; set; }
    public decimal ChangeGiven { get; set; }
    public OrderStatus Status { get; set; }
    public string? UserName { get; set; }
    public int? ClientId { get; set; }
    public string? ClientName { get; set; }
    public int LoyaltyPointsEarned { get; set; }
    public int LoyaltyPointsRedeemed { get; set; }
    public decimal LoyaltyDiscountAmount { get; set; }
    public List<SaleItemDto> Items { get; set; } = [];
    public string? ReceiptBarcode { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SaleItemDto
{
    public int Id { get; set; }
    public int SaleId { get; set; }
    public int ProductVariantId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string VariantSku { get; set; } = string.Empty;
    public string? VariantBarcode { get; set; }
    public string ColorName { get; set; } = string.Empty;
    public string SizeValue { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal CostPrice { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal LineTotal { get; set; }
}
