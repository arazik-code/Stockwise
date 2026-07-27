using SMS.Domain.Enums;

namespace SMS.Domain.Entities;

public class OzonParcel
{
    public int Id { get; set; }

    public int? OnlineOrderId { get; set; }
    public OnlineOrder? OnlineOrder { get; set; }

    public string TrackingNumber { get; set; } = string.Empty;
    public string Receiver { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public int CityId { get; set; }
    public string? CityName { get; set; }
    public string Address { get; set; } = string.Empty;
    public string? Note { get; set; }
    public string? Nature { get; set; }

    // COD amount the courier collects from the customer.
    public decimal Price { get; set; }
    // Courier fees returned by OzonExpress at creation time (per outcome).
    public decimal? DeliveredPrice { get; set; }
    public decimal? ReturnedPrice { get; set; }
    public decimal? RefusedPrice { get; set; }

    public bool IsStock { get; set; }      // 1 = from stock, 0 = pickup
    public bool Fragile { get; set; }
    public bool AllowOpen { get; set; } = true;
    public bool CanReplace { get; set; }

    public OzonParcelStatus Status { get; set; } = OzonParcelStatus.New;
    public string? StatusText { get; set; }
    public string? LastTrackingRaw { get; set; }
    public DateTime? LastSyncedAt { get; set; }

    public string? DeliveryNoteRef { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
