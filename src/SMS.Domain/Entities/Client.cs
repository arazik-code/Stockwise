namespace SMS.Domain.Entities;

public class Client
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string QrCode { get; set; } = string.Empty; // Unique identifier for QR
    public int TotalPoints { get; set; }
    public int LifetimePoints { get; set; }
    public decimal TotalSpent { get; set; }
    public int LoyaltyRate { get; set; } = 5; // points per 100 DH (8% ancient, 5% new)
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastVisitAt { get; set; }
    public long? ShopifyCustomerId { get; set; }
    public string? Tags { get; set; }
    public string? City { get; set; }
    public string? AddressLine { get; set; }
    // Authoritative lifetime figures straight from the Shopify customer record — used as a fallback
    // for segmentation when a client's itemized orders haven't (or can't) be imported.
    public decimal? ShopifyTotalSpent { get; set; }
    public int? ShopifyOrdersCount { get; set; }

    public ICollection<LoyaltyTransaction> LoyaltyTransactions { get; set; } = [];
    public ICollection<Sale> Sales { get; set; } = [];
    public ICollection<OnlineOrder> OnlineOrders { get; set; } = [];
}
