using SMS.Domain.Enums;

namespace SMS.Application.DTOs.Online;

public class OnlineOrderDto
{
    public int Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public OnlineOrderChannel Channel { get; set; }
    public OrderStatus Status { get; set; }
    public OnlinePaymentStatus PaymentStatus { get; set; }
    public OnlinePaymentMethod PaymentMethod { get; set; }

    public int? ClientId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }
    public string? CustomerEmail { get; set; }

    public string? AddressLine { get; set; }
    public string? City { get; set; }
    public string? CarrierName { get; set; }
    public string? TrackingNumber { get; set; }
    public decimal DeliveryFee { get; set; }
    public DateTime? ExpectedDeliveryDate { get; set; }

    public decimal SubTotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal ShippingFee { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal AmountPaid { get; set; }
    public decimal BalanceDue => TotalAmount - AmountPaid;

    public string? Notes { get; set; }
    public string? CreatedByUserName { get; set; }

    public int LoyaltyPointsEarned { get; set; }
    public int LoyaltyPointsRedeemed { get; set; }
    public decimal LoyaltyDiscountAmount { get; set; }

    public List<OnlineOrderItemDto> Items { get; set; } = [];

    public DateTime CreatedAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public DateTime? ShippedAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
}

public class OnlineOrderItemDto
{
    public int Id { get; set; }
    public int ProductVariantId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string? ColorName { get; set; }
    public string? SizeValue { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal LineTotal { get; set; }
    public int StockAvailable { get; set; }
}
