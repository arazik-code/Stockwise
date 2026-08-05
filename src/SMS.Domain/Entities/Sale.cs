using SMS.Domain.Enums;

namespace SMS.Domain.Entities;

public class Sale
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
    public string? Notes { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int? ClientId { get; set; }
    public Client? Client { get; set; }
    public int LoyaltyPointsEarned { get; set; }
    public int LoyaltyPointsRedeemed { get; set; }
    public decimal LoyaltyDiscountAmount { get; set; }
    public ICollection<SaleItem> Items { get; set; } = [];
    public ICollection<ReceiptBarcode> ReceiptBarcodes { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Set at creation time from the IsLocalFallback deployment config (see Program.cs) - true
    // when this sale was rung up while the desktop shell had failed over to the local API rather
    // than the VPS. Never touched by the nightly sync (Sales isn't a synced table); reconciled
    // manually by the owner re-keying it into the VPS, then marking ReconciledAt.
    public bool IsLocalFallbackOrigin { get; set; }
    public DateTime? ReconciledAt { get; set; }
}
