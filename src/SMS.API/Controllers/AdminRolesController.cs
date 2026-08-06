using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SMS.API.Authorization;
using SMS.Domain.Constants;
using SMS.Domain.Entities;
using SMS.Infrastructure.Data;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/admin/roles")]
[Authorize(Roles = "Admin")]
[RequireSection(Sections.AdminRoles)]
public class AdminRolesController : ControllerBase
{
    // The Admin role can never lose access to its own management surface - otherwise a mis-edit
    // here could permanently lock every admin out of Users/Roles/Health with no way back in short
    // of a direct database fix.
    private static readonly string[] AdminGuardedSections = [Sections.AdminUsers, Sections.AdminRoles, Sections.AdminHealth];

    private readonly AppDbContext _db;

    public AdminRolesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var roles = await _db.Roles.Include(r => r.Sections).OrderBy(r => r.Name).ToListAsync(ct);
        var userCounts = await _db.Users.GroupBy(u => u.RoleId).Select(g => new { RoleId = g.Key, Count = g.Count() }).ToListAsync(ct);
        var countByRole = userCounts.ToDictionary(x => x.RoleId, x => x.Count);

        var result = roles.Select(r => new RoleDto(
            r.Id, r.Name, r.Description, r.IsSystem,
            r.Sections.Select(s => s.SectionKey).OrderBy(s => s).ToList(),
            countByRole.GetValueOrDefault(r.Id, 0)
        ));
        return Ok(result);
    }

    [HttpGet("sections")]
    public IActionResult GetAvailableSections() => Ok(Sections.All);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRoleRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Le nom du rôle est requis" });

        var name = request.Name.Trim();
        var existing = await _db.Roles.FirstOrDefaultAsync(r => r.Name == name, ct);
        if (existing is not null)
            return Conflict(new { message = "Un rôle avec ce nom existe déjà" });

        var invalidSections = (request.Sections ?? []).Where(s => !Sections.All.Contains(s)).ToList();
        if (invalidSections.Count > 0)
            return BadRequest(new { message = $"Section(s) invalide(s): {string.Join(", ", invalidSections)}" });

        var role = new Role
        {
            Name = name,
            Description = request.Description?.Trim(),
            IsSystem = false,
            CreatedAt = DateTime.UtcNow
        };
        foreach (var key in (request.Sections ?? []).Distinct())
            role.Sections.Add(new RoleSection { SectionKey = key });

        _db.Roles.Add(role);
        WriteAudit("RoleCreated", "Role", role.Name, $"sections={string.Join(",", role.Sections.Select(s => s.SectionKey))}");
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetAll), new RoleDto(role.Id, role.Name, role.Description, role.IsSystem,
            role.Sections.Select(s => s.SectionKey).ToList(), 0));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateRoleRequest request, CancellationToken ct)
    {
        var role = await _db.Roles.Include(r => r.Sections).FirstOrDefaultAsync(r => r.Id == id, ct);
        if (role is null) return NotFound();

        // System role identity (Name/IsSystem) is fixed - every [Authorize(Roles="Admin,...")]
        // attribute across the API checks these exact strings. Description and Sections stay
        // editable even for system roles - that's the whole point of the feature.
        if (request.Description is not null)
            role.Description = request.Description.Trim();

        if (request.Sections is not null)
        {
            var invalidSections = request.Sections.Where(s => !Sections.All.Contains(s)).ToList();
            if (invalidSections.Count > 0)
                return BadRequest(new { message = $"Section(s) invalide(s): {string.Join(", ", invalidSections)}" });

            var requested = request.Sections.Distinct().ToHashSet();
            if (role.Name == "Admin")
                foreach (var guarded in AdminGuardedSections)
                    requested.Add(guarded);

            var current = role.Sections.Select(s => s.SectionKey).ToHashSet();
            foreach (var toRemove in role.Sections.Where(s => !requested.Contains(s.SectionKey)).ToList())
                role.Sections.Remove(toRemove);
            foreach (var toAdd in requested.Where(s => !current.Contains(s)))
                role.Sections.Add(new RoleSection { RoleId = role.Id, SectionKey = toAdd });
        }

        WriteAudit("RoleUpdated", "Role", role.Name, $"sections={string.Join(",", role.Sections.Select(s => s.SectionKey))}");
        await _db.SaveChangesAsync(ct);

        return Ok(new RoleDto(role.Id, role.Name, role.Description, role.IsSystem,
            role.Sections.Select(s => s.SectionKey).OrderBy(s => s).ToList(),
            await _db.Users.CountAsync(u => u.RoleId == role.Id, ct)));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (role is null) return NotFound();

        if (role.IsSystem)
            return BadRequest(new { message = "Les rôles système ne peuvent pas être supprimés" });

        var assignedCount = await _db.Users.CountAsync(u => u.RoleId == id, ct);
        if (assignedCount > 0)
            return BadRequest(new { message = $"Ce rôle est encore utilisé par {assignedCount} utilisateur(s) - réaffectez-les avant de le supprimer" });

        _db.Roles.Remove(role);
        WriteAudit("RoleDeleted", "Role", role.Name, string.Empty);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    private void WriteAudit(string action, string targetType, string targetId, string details)
    {
        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!),
            ActorUsername = User.FindFirstValue(ClaimTypes.Name) ?? "unknown",
            Action = action,
            TargetType = targetType,
            TargetId = targetId,
            Details = details,
            CreatedAt = DateTime.UtcNow
        });
    }
}

public record RoleDto(int Id, string Name, string? Description, bool IsSystem, List<string> Sections, int UserCount);
public record CreateRoleRequest(string Name, string? Description, List<string>? Sections);
public record UpdateRoleRequest(string? Description, List<string>? Sections);
