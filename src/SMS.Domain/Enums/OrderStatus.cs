namespace SMS.Domain.Enums;

public enum OrderStatus
{
    Pending = 0,
    Processing = 1,
    Shipped = 2,
    Delivered = 3,
    Cancelled = 4,
    Refunded = 5,
    InventoryConflict = 6,
    Confirmed = 7,
    Packing = 8,
    ReadyToShip = 9,
    // Added so courier delivery-failure outcomes are actually representable - previously the
    // courier tracking sync had nowhere to route Returned/Refused parcels, so it silently
    // never wrote them back to the order at all (see OzonExpressAppService.ApplyOrderStatusFromParcel).
    Returned = 10,
    Refused = 11
}
