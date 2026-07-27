namespace SMS.Domain.Entities;

public class SizePreset
{
    public int Id { get; set; }
    public string Value { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
