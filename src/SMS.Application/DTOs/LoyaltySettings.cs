namespace SMS.Application.DTOs;

public class LoyaltySettings
{
    public const string SectionName = "Loyalty";

    public int NewClientRate { get; set; } = 5;
    public int AncientClientRate { get; set; } = 8;
    public int PointsForRedemption { get; set; } = 10;
    public decimal DhPerRedemption { get; set; } = 1.00m;
    public int WelcomePoints { get; set; } = 50;
    public bool Enabled { get; set; } = true;
}
