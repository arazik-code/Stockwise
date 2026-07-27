using SMS.Domain.Enums;

namespace SMS.Domain.Entities;

/// <summary>
/// Audit trail of every order status transition. A cash-on-delivery business needs to be able
/// to answer "who/what changed this order and when" - previously status changes overwrote the
/// single Status column with no history at all.
/// </summary>
public class OrderStatusHistory
{
    public long Id { get; set; }
    public int OnlineOrderId { get; set; }
    public OnlineOrder? OnlineOrder { get; set; }

    public OrderStatus FromStatus { get; set; }
    public OrderStatus ToStatus { get; set; }
    public OrderStatusChangeSource Source { get; set; }
    public string? Reason { get; set; }
    public int? ActorUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum OrderStatusChangeSource
{
    Manual = 0,
    Courier = 1,
    Shopify = 2,
    System = 3
}
