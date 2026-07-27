using SMS.Domain.Enums;

namespace SMS.Domain.Entities;

public class LoyaltyTransaction
{
    public int Id { get; set; }
    public int ClientId { get; set; }
    public Client Client { get; set; } = null!;
    public int? SaleId { get; set; }
    public Sale? Sale { get; set; }
    public int PointsChange { get; set; } // Positive = earn, Negative = redeem
    public LoyaltyTransactionType Type { get; set; }
    public string? Description { get; set; }
    public int BalanceAfter { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
