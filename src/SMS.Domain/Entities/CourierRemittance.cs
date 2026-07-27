namespace SMS.Domain.Entities;

/// <summary>
/// A batch of cash the courier actually paid the shop, matched against the parcels it covers.
/// Created manually by an operator from the courier's payout statement - the integrated
/// OzonExpress API exposes parcel/tracking/delivery-note endpoints but no payout/statement
/// endpoint, so this side of the reconciliation can't be pulled automatically.
/// </summary>
public class CourierRemittance
{
    public int Id { get; set; }

    public string Carrier { get; set; } = "OzonExpress";
    public string? Reference { get; set; }

    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }

    // What the courier says they paid vs. what we can actually match to covered parcels.
    public decimal DeclaredAmount { get; set; }
    public decimal MatchedAmount { get; set; }
    public decimal VarianceAmount => DeclaredAmount - MatchedAmount;

    public CourierRemittanceStatus Status { get; set; } = CourierRemittanceStatus.Draft;

    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
    public string? BankRef { get; set; }
    public int? CreatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<CodLedgerEntry> LedgerEntries { get; set; } = [];
}

public enum CourierRemittanceStatus
{
    Draft = 0,
    Reconciled = 1,
    Disputed = 2,
    Closed = 3
}
