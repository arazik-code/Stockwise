using SMS.Domain.Enums;

namespace SMS.Domain.Entities;

// A "Bon de Livraison" (BL) — a manifest handed to the courier grouping several parcels for pickup.
public class OzonDeliveryNote
{
    public int Id { get; set; }
    public string Ref { get; set; } = string.Empty;
    public OzonDeliveryNoteStatus Status { get; set; } = OzonDeliveryNoteStatus.Draft;
    public int ParcelCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SavedAt { get; set; }
}
