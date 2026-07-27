namespace SMS.Domain.Entities;

public class ColorPreset
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string HexCode { get; set; } = "#000000";
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
