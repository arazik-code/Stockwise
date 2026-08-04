using SMS.Domain.Enums;

namespace SMS.Application.DTOs.Clients;

public class ClientDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string QrCode { get; set; } = string.Empty;
    public int TotalPoints { get; set; }
    public int LifetimePoints { get; set; }
    public decimal TotalSpent { get; set; }
    public int VisitCount { get; set; }
    public int LoyaltyRate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastVisitAt { get; set; }
    public List<LoyaltyTransactionDto> RecentTransactions { get; set; } = [];

    // Loyalty tier (Nouveau/Bon/Premium) - EffectiveCategory drives the LoyaltyRate above; ManualCategory
    // is the explicit override (null = automatic); ComputedCategory is what the auto-categorization
    // currently suggests, shown even while a manual override is active.
    public ClientCategory EffectiveCategory { get; set; }
    public ClientCategory? ManualCategory { get; set; }
    public ClientCategory ComputedCategory { get; set; }
    public DateTime? CategoryUpdatedAt { get; set; }
}

public class LoyaltyTransactionDto
{
    public int Id { get; set; }
    public int PointsChange { get; set; }
    public string Type { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int BalanceAfter { get; set; }
    public DateTime CreatedAt { get; set; }
}

public record CreateClientRequest(string Name, string Phone);
public record UpdateClientRequest(string? Name, string? Phone);
public record AdjustPointsRequest(int Points, string? Reason);
public record RedeemPointsRequest(int ClientId, int Points, decimal DiscountAmount, int? SaleId);
// Category = null means "revert to automatic" (clear the manual override).
public record SetClientCategoryRequest(ClientCategory? Category, string? Reason);
