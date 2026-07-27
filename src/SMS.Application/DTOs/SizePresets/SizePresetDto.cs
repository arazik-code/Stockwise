namespace SMS.Application.DTOs.SizePresets;

public record CreateSizePresetRequest(string Value, int SortOrder = 0);
public record UpdateSizePresetRequest(string? Value, int? SortOrder);
