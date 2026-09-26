namespace SMS.Domain.Entities;

public class Invoice
{
    public int Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public int FournisseurId { get; set; }
    public Fournisseur? Fournisseur { get; set; }
    public string Status { get; set; } = "Pending";
    public decimal SubTotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TaxRate { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public string PaymentTerms { get; set; } = "Comptant";
    public DateTime InvoiceDate { get; set; }
    public DateTime? DueDate { get; set; }
    public DateTime? PaidAt { get; set; }
    // Set once by ReceiveAsync and never cleared afterwards - tracks whether stock was ever
    // physically received for this invoice, independent of Status, which keeps moving on to
    // PartiallyPaid/Paid as payments come in and would otherwise make "was this received"
    // unrecoverable (see the label-printing gate, which needs to survive payment status changes).
    public DateTime? ReceivedAt { get; set; }
    public string? Notes { get; set; }
    public string? Reference { get; set; }
    public int? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }
    public ICollection<InvoiceLineItem> LineItems { get; set; } = [];
    public ICollection<InvoicePayment> Payments { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // A financial record with payments/stock effects attached is never hard-deleted - archiving
    // hides it from the default list (restorable) instead of destroying the audit trail.
    public DateTime? ArchivedAt { get; set; }
}

public class InvoiceLineItem
{
    public int Id { get; set; }
    public int InvoiceId { get; set; }
    public Invoice? Invoice { get; set; }
    public int? ProductVariantId { get; set; }
    public ProductVariant? ProductVariant { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductSku { get; set; }
    public string? Description { get; set; }
    // Denormalized like ColorId/SizeId below, not a navigation - lets the edit form re-populate
    // the product picker (and, transitively, the colour/size dropdowns it gates) without having
    // to re-derive it from ProductVariantId, which is null for a line with no stock-tracked match.
    public int? ProductId { get; set; }
    public int? ColorId { get; set; }
    public int? SizeId { get; set; }
    public string? ColorName { get; set; }
    public string? SizeValue { get; set; }
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal LineTotal => (Quantity * UnitCost) - DiscountAmount;
}

public class InvoicePayment
{
    public int Id { get; set; }
    public int InvoiceId { get; set; }
    public Invoice? Invoice { get; set; }
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public DateTime PaymentDate { get; set; }
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public int? RecordedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
