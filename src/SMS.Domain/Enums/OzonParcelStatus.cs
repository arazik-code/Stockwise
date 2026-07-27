namespace SMS.Domain.Enums;

public enum OzonParcelStatus
{
    New = 0,
    PickedUp = 1,
    AtHub = 2,
    InTransit = 3,
    OutForDelivery = 4,
    Delivered = 5,
    Returned = 6,
    Refused = 7,
    Cancelled = 8,
    Unknown = 99
}

public enum OzonDeliveryNoteStatus
{
    Draft = 0,
    Saved = 1
}
