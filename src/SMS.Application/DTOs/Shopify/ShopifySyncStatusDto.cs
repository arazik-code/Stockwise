namespace SMS.Application.DTOs.Shopify;

public class ShopifySyncStatusDto
{
    public DateTime? LastSyncTime { get; set; }
    public int PendingOrders { get; set; }
    public int PendingProducts { get; set; }
    public bool IsSyncing { get; set; }
}
