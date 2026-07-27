namespace SMS.Domain.Entities;

/// <summary>
/// One money-moving event tied to a COD parcel: cash the courier is expected to collect, cash
/// actually collected, a courier fee, a remittance payout, or a manual adjustment/write-off.
/// This is the thing that didn't exist at all before - 1654 delivered orders sat marked Unpaid
/// with nothing reconciling collected cash, courier remittance, or fees against them.
/// </summary>
public class CodLedgerEntry
{
    public long Id { get; set; }

    public int OnlineOrderId { get; set; }
    public OnlineOrder? OnlineOrder { get; set; }

    public int? OzonParcelId { get; set; }
    public OzonParcel? OzonParcel { get; set; }

    public CodLedgerEntryType Type { get; set; }
    // Signed: positive = money owed to the shop, negative = a cost/fee.
    public decimal Amount { get; set; }

    public int? CourierRemittanceId { get; set; }
    public CourierRemittance? CourierRemittance { get; set; }

    public string Source { get; set; } = string.Empty; // "Courier", "Manual", "System"
    public string? Note { get; set; }

    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum CodLedgerEntryType
{
    CodExpected = 0,
    CodCollected = 1,
    CourierFeeDelivered = 2,
    CourierFeeReturned = 3,
    CourierFeeRefused = 4,
    Remittance = 5,
    Adjustment = 6,
    WriteOff = 7
}
