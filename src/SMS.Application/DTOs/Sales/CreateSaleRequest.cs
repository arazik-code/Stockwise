using SMS.Domain.Enums;

namespace SMS.Application.DTOs.Sales;

public class CreateSaleRequest
{
    public SaleCategory Category { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public decimal AmountPaid { get; set; }
    public decimal TaxRate { get; set; }
    public int? ClientId { get; set; }
    public int? LoyaltyPointsToRedeem { get; set; }
    // Store credit from returning items as part of an exchange (POS ExchangeDialog flow) - deducted
    // from the total owed on this replacement sale. Distinct from LoyaltyPointsToRedeem.
    public decimal ExchangeCreditAmount { get; set; }
    public List<SaleItemRequest> Items { get; set; } = [];
}

public class SaleItemRequest
{
    public int ProductVariantId { get; set; }
    public int Quantity { get; set; }
    public decimal DiscountAmount { get; set; }
}
