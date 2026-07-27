namespace SMS.Application.DTOs.ColorPresets;

public record CreateColorPresetRequest(string Name, string HexCode, int SortOrder = 0);
public record UpdateColorPresetRequest(string? Name, string? HexCode, int? SortOrder);
