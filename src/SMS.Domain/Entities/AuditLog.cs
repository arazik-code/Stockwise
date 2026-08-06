namespace SMS.Domain.Entities;

// Scoped to admin-dashboard actions (user/role create/edit/delete/reset-password) - not an
// app-wide audit trail.
public class AuditLog
{
    public int Id { get; set; }
    public int? ActorUserId { get; set; }
    public string ActorUsername { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string TargetType { get; set; } = string.Empty;
    public string? TargetId { get; set; }
    public string? Details { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
