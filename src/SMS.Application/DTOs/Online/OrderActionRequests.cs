using SMS.Domain.Enums;

namespace SMS.Application.DTOs.Online;

public class UpdateOrderStatusRequest
{
    public OrderStatus Status { get; set; }
}

public class AssignShippingRequest
{
    public string CarrierName { get; set; } = string.Empty;
    public string? TrackingNumber { get; set; }
    public decimal? DeliveryFee { get; set; }
    public DateTime? ExpectedDeliveryDate { get; set; }
}

public class MarkPaidRequest
{
    public decimal? AmountPaid { get; set; }
}

public class CancelOrderRequest
{
    public string? Reason { get; set; }
}
