namespace SMS.Domain.Entities;

public class CashDrawerMovement
{
    public int Id { get; set; }

    public CashDrawerMovementType Type { get; set; }
    public decimal Amount { get; set; }
    public string? Reason { get; set; }

    public int UserId { get; set; }
    public User? User { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum CashDrawerMovementType
{
    Deposit = 0,
    Withdrawal = 1
}
