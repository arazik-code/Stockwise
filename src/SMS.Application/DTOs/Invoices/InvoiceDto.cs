using SMS.Domain.Enums;

namespace SMS.Application.DTOs.Invoices;

public class InvoiceDto
{
    public int Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public int FournisseurId { get; set; }
    public string FournisseurNom { get; set; } = string.Empty;
    public InvoiceStatus Status { get; set; }
    public decimal SubTotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TaxRate { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal BalanceDue => TotalAmount - PaidAmount;
    public string PaymentTerms { get; set; } = "Comptant";
    public DateTime InvoiceDate { get; set; }
    public DateTime? DueDate { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime? ReceivedAt { get; set; }
    public string? Notes { get; set; }
    public string? Reference { get; set; }
    public string? CreatedByUserName { get; set; }
    public List<InvoiceLineItemDto> Items { get; set; } = [];
    public List<InvoicePaymentDto> Payments { get; set; } = [];
    public DateTime CreatedAt { get; set; }
    public DateTime? ArchivedAt { get; set; }
}

public class InvoiceLineItemDto
{
    public int Id { get; set; }
    public int? ProductVariantId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? VariantSku { get; set; }
    public string? VariantBarcode { get; set; }
    public string ColorName { get; set; } = string.Empty;
    public string SizeValue { get; set; } = string.Empty;
    public int? ProductId { get; set; }
    public int? ColorId { get; set; }
    public int? SizeId { get; set; }
    public string? Description { get; set; }
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal LineTotal { get; set; }
}

public class InvoicePaymentDto
{
    public int Id { get; set; }
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public DateTime PaymentDate { get; set; }
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateInvoiceRequest
{
    public int FournisseurId { get; set; }
    public DateTime? InvoiceDate { get; set; }
    public DateTime? DueDate { get; set; }
    public string PaymentTerms { get; set; } = "Comptant";
    public decimal DiscountAmount { get; set; }
    public decimal TaxRate { get; set; }
    public string? Notes { get; set; }
    public string? Reference { get; set; }
    public List<CreateInvoiceLineItemRequest> Items { get; set; } = [];
}

public class CreateInvoiceLineItemRequest
{
    public int? ProductVariantId { get; set; }
    public int? ProductId { get; set; }
    public int? ColorId { get; set; }
    public int? SizeId { get; set; }
    public string? Description { get; set; }
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal DiscountPercent { get; set; }
}

public class PayInvoiceRequest
{
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = "Cash";
    public string? Reference { get; set; }
    public string? Notes { get; set; }
}

public class InvoiceSummaryDto
{
    public decimal TotalOwed { get; set; }
    public decimal TotalOverdue { get; set; }
    public int PendingCount { get; set; }
    public int OverdueCount { get; set; }
    public int PaidCount { get; set; }
    public int TotalCount { get; set; }
    public List<FournisseurBalanceDto> FournisseurBalances { get; set; } = [];
}

public class FournisseurBalanceDto
{
    public int FournisseurId { get; set; }
    public string FournisseurNom { get; set; } = string.Empty;
    public decimal TotalOwed { get; set; }
    public int InvoiceCount { get; set; }
}
