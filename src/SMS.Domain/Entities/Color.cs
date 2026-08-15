namespace SMS.Domain.Entities;

public class Color
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string HexCode { get; set; } = "#000000";
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<ProductVariant> Variants { get; set; } = [];
    public ICollection<ProductColorway> Colorways { get; set; } = [];
}
