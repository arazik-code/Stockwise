namespace SMS.Application.Interfaces;

/// <summary>
/// On-demand "make Shopify match local stock" reconciliation, with progress the UI can poll.
/// Replaces the unconditional full-catalog sweep that used to run on every app start.
/// </summary>
public interface IShopifyBulkSync
{
    /// <summary>Returns false if a run is already in progress.</summary>
    bool TryStart();

    ShopifyBulkSyncProgress GetProgress();
}

public class ShopifyBulkSyncProgress
{
    public bool IsRunning { get; set; }
    public string Phase { get; set; } = "Inactif";
    public int TotalLinked { get; set; }
    public int Compared { get; set; }
    public int Differing { get; set; }
    public int Pushed { get; set; }
    public int Failed { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public string? LastError { get; set; }
    public List<string> Recent { get; set; } = [];
}
