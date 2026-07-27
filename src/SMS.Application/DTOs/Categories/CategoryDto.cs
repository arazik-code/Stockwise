namespace SMS.Application.DTOs.Categories;

public record CreateCategoryRequest(string Name, string? Description, int? ParentCategoryId);
public record UpdateCategoryRequest(string? Name, string? Description);
