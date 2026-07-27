namespace SMS.Application.DTOs.Colors;

public class ColorDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string HexCode { get; set; } = "#000000";
    public int SortOrder { get; set; }
}

public class CreateColorRequest
{
    public string Name { get; set; } = string.Empty;
    public string HexCode { get; set; } = "#000000";
    public int SortOrder { get; set; }
}

public class UpdateColorRequest
{
    public string? Name { get; set; }
    public string? HexCode { get; set; }
    public int? SortOrder { get; set; }
}
