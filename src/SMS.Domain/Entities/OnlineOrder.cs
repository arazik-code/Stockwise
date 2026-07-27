using SMS.Domain.Enums;

namespace SMS.Domain.Entities;

public class OnlineOrder
{
    public int Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public OnlineOrderChannel Channel { get; set; }
    public OrderStatus Status { get; set; }
    public OnlinePaymentStatus PaymentStatus { get; set; }
    public OnlinePaymentMethod PaymentMethod { get; set; }

    public int? ClientId { get; set; }
    public Client? Client { get; set; }
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

    public bool StockReserved { get; set; }
    public long? ShopifyOrderId { get; set; }
    public string? Notes { get; set; }

    public int? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }

    public int LoyaltyPointsEarned { get; set; }
    public int LoyaltyPointsRedeemed { get; set; }
    public decimal LoyaltyDiscountAmount { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ConfirmedAt { get; set; }
    public DateTime? ShippedAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<OnlineOrderItem> Items { get; set; } = [];
}
