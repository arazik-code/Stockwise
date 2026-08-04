using SMS.Domain.Enums;

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
    // Denormalized display cache of the earn rate implied by EffectiveCategory - kept in sync by
    // IClientLoyaltyCategoryService whenever the category changes. Never read back for the actual
    // point calculation (ILoyaltyRateResolver resolves that live from EffectiveCategory + current
    // settings), so it can never go stale in a way that affects money, only in a way that affects
    // what's displayed until the next recategorization trigger.
    public int LoyaltyRate { get; set; } = 5;
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

    // Explicit admin override (null = no override, EffectiveCategory follows ComputedCategory).
    public ClientCategory? ManualCategory { get; set; }
    // What the auto-categorization algorithm currently believes from purchase history, kept fresh
    // by IClientLoyaltyCategoryService.RecategorizeAsync. Never overwritten by a manual override.
    public ClientCategory ComputedCategory { get; set; } = ClientCategory.Nouveau;
    // ManualCategory ?? ComputedCategory - what actually drives the loyalty rate and what's shown
    // by default. Indexed so the clients list can filter/sort on it cheaply.
    public ClientCategory EffectiveCategory { get; set; } = ClientCategory.Nouveau;
    public DateTime? CategoryUpdatedAt { get; set; }

    public ICollection<LoyaltyTransaction> LoyaltyTransactions { get; set; } = [];
    public ICollection<Sale> Sales { get; set; } = [];
    public ICollection<OnlineOrder> OnlineOrders { get; set; } = [];
}
