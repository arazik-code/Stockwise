using SMS.Domain.Enums;

namespace SMS.Application.DTOs.Online;

public class CreateManualOrderRequest
{
    public OnlineOrderChannel Channel { get; set; } = OnlineOrderChannel.Manual;
    public OnlinePaymentMethod PaymentMethod { get; set; } = OnlinePaymentMethod.COD;

    public int? ClientId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }
    public string? CustomerEmail { get; set; }

    public string? AddressLine { get; set; }
    public string? City { get; set; }
    public decimal DeliveryFee { get; set; }

    public decimal DiscountAmount { get; set; }
    public int? LoyaltyPointsToRedeem { get; set; }
    public string? Notes { get; set; }

    public List<CreateOnlineOrderItemRequest> Items { get; set; } = [];
}

public class CreateOnlineOrderItemRequest
{
    public int ProductVariantId { get; set; }
    public int Quantity { get; set; }
    public decimal? UnitPriceOverride { get; set; }
    public decimal DiscountAmount { get; set; }
}
