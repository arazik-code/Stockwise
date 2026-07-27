namespace SMS.Domain.Entities;

public class ReceiptBarcode
{
    public int Id { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public int SaleId { get; set; }
    public Sale Sale { get; set; } = null!;
    public bool IsUsed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
}
