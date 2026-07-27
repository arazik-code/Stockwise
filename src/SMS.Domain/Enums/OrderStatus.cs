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
    ReadyToShip = 9
}
