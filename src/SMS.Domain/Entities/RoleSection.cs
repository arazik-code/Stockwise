namespace SMS.Domain.Entities;

// Join row: a Role is granted access to one app Section (see SMS.Domain.Constants.Sections).
public class RoleSection
{
    public int RoleId { get; set; }
    public Role Role { get; set; } = null!;
    public string SectionKey { get; set; } = string.Empty;
}
