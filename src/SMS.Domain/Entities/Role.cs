namespace SMS.Domain.Entities;

public class Role
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // System roles (Admin/Cashier/StockManager) can't be renamed or deleted - every existing
    // [Authorize(Roles="Admin,...")] attribute across the API checks these exact name strings,
    // so their identity must stay fixed even though their granted Sections can still be edited.
    public bool IsSystem { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<RoleSection> Sections { get; set; } = new List<RoleSection>();
    public ICollection<User> Users { get; set; } = new List<User>();
}
