namespace SMS.Application.DTOs.Sizes;

public class SizeDto
{
    public int Id { get; set; }
    public string Value { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}

public class CreateSizeRequest
{
    public string Value { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}

public class UpdateSizeRequest
{
    public string? Value { get; set; }
    public int? SortOrder { get; set; }
}
