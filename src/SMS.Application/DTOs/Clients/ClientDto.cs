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
