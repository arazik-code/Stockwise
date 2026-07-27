namespace SMS.Application.DTOs.Refunds;

public record RefundDto
{
    public int Id { get; init; }
    public string RefundNumber { get; init; } = string.Empty;
    public int SaleId { get; init; }
    public string SaleNumber { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public decimal TotalRefundAmount { get; init; }
    public decimal TotalExchangeAmount { get; init; }
    public decimal PriceDifference { get; init; }
    public string Reason { get; init; } = string.Empty;
    public string? Notes { get; init; }
    public int? ClientId { get; init; }
    public string? ClientName { get; init; }
    public DateTime RefundDate { get; init; }
    public List<RefundItemDto> Items { get; init; } = [];
    public List<ExchangeItemDto> ExchangeItems { get; init; } = [];
}

public record RefundItemDto
{
    public int Id { get; init; }
    public int SaleItemId { get; init; }
    public int ProductVariantId { get; init; }
    public string ProductName { get; init; } = string.Empty;
    public string? ProductSku { get; init; }
    public string? ColorName { get; init; }
    public string? SizeValue { get; init; }
    public int Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal RefundAmount { get; init; }
    public string? Reason { get; init; }
}

public record ExchangeItemDto
{
    public int Id { get; init; }
    public int ProductVariantId { get; init; }
    public string ProductName { get; init; } = string.Empty;
    public string? ProductSku { get; init; }
    public string? ColorName { get; init; }
    public string? SizeValue { get; init; }
    public int Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal TotalPrice { get; init; }
}

public record CreateRefundRequest
{
    public int SaleId { get; init; }
    public string Type { get; init; } = "Refund";
    public string? Reason { get; init; }
    public string? Notes { get; init; }
    public List<CreateRefundItemRequest> Items { get; init; } = [];
    public List<CreateExchangeItemRequest> ExchangeItems { get; init; } = [];
}

public record CreateRefundItemRequest
{
    public int SaleItemId { get; init; }
    public int Quantity { get; init; }
    public string? Reason { get; init; }
}

public record CreateExchangeItemRequest
{
    public int ProductVariantId { get; init; }
    public int Quantity { get; init; }
}

public record SaleForRefundDto
{
    public int Id { get; init; }
    public string SaleNumber { get; init; } = string.Empty;
    public string? ClientName { get; init; }
    public int? ClientId { get; init; }
    public decimal TotalAmount { get; init; }
    public decimal AmountPaid { get; init; }
    public string PaymentMethod { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public List<SaleItemForRefundDto> Items { get; init; } = [];
}

public record SaleItemForRefundDto
{
    public int Id { get; init; }
    public int ProductVariantId { get; init; }
    public string ProductName { get; init; } = string.Empty;
    public string? ProductSku { get; init; }
    public string? ColorName { get; init; }
    public string? SizeValue { get; init; }
    public int Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal LineTotal { get; init; }
    public int AlreadyRefundedQuantity { get; init; }
    public int AvailableForRefund => Quantity - AlreadyRefundedQuantity;
}

public record ProductVariantForExchangeDto
{
    public int Id { get; init; }
    public int ProductId { get; init; }
    public string ProductName { get; init; } = string.Empty;
    public string? ProductDescription { get; init; }
    public string Sku { get; init; } = string.Empty;
    public string? Barcode { get; init; }
    public string? ImageUrl { get; init; }
    public string ColorName { get; init; } = string.Empty;
    public string ColorHexCode { get; init; } = string.Empty;
    public string SizeValue { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public int StockQuantity { get; init; }
}
