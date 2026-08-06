using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SMS.Infrastructure.Data;

namespace SMS.API.Controllers;

// Real-Admin-only, not RequireSection-gated - the audit trail itself is one layer more
// sensitive than the Users/Roles pages it covers, so custom roles never get it even if
// granted AdminUsers/AdminRoles.
[ApiController]
[Route("api/admin/audit-log")]
[Authorize(Roles = "Admin")]
public class AdminAuditLogController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminAuditLogController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetRecent([FromQuery] int limit = 50, CancellationToken ct = default)
    {
        var capped = Math.Clamp(limit, 1, 200);
        var entries = await _db.AuditLogs
            .OrderByDescending(a => a.CreatedAt)
            .Take(capped)
            .Select(a => new AuditLogDto(a.Id, a.ActorUsername, a.Action, a.TargetType, a.TargetId, a.Details, a.CreatedAt))
            .ToListAsync(ct);

        return Ok(entries);
    }
}

public record AuditLogDto(int Id, string ActorUsername, string Action, string TargetType, string? TargetId, string? Details, DateTime CreatedAt);
