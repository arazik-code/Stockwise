using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SMS.API.Authorization;
using SMS.Domain.Constants;
using SMS.Domain.Entities;
using SMS.Domain.Security;
using SMS.Infrastructure.Data;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
[RequireSection(Sections.AdminUsers)]
public class AdminUsersController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminUsersController(AppDbContext db)
    {
        _db = db;
    }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search, CancellationToken ct)
    {
        var query = _db.Users.Include(u => u.Role).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(u => u.Username.ToLower().Contains(term) || u.FullName.ToLower().Contains(term));
        }

        var users = await query.OrderBy(u => u.Username).Select(u => new UserSummaryDto(
            u.Id, u.Username, u.FullName, u.RoleId, u.Role.Name, u.IsActive, u.MustChangePassword, u.CreatedAt
        )).ToListAsync(ct);

        return Ok(users);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.FullName))
            return BadRequest(new { message = "Nom d'utilisateur et nom complet requis" });

        var existing = await _db.Users.FirstOrDefaultAsync(u => u.Username == request.Username, ct);
        if (existing is not null)
            return Conflict(new { message = "Ce nom d'utilisateur existe déjà" });

        var role = await _db.Roles.FindAsync([request.RoleId], ct);
        if (role is null)
            return BadRequest(new { message = "Rôle introuvable" });

        var password = string.IsNullOrWhiteSpace(request.Password)
            ? PasswordHasher.GenerateTempPassword()
            : request.Password;

        var passwordError = PasswordPolicy.Validate(password);
        if (passwordError is not null)
            return BadRequest(new { message = passwordError });

        var user = new User
        {
            Username = request.Username.Trim(),
            FullName = request.FullName.Trim(),
            PasswordHash = PasswordHasher.Hash(password),
            RoleId = role.Id,
            IsActive = true,
            MustChangePassword = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        WriteAudit("UserCreated", "User", user.Id.ToString(), $"username={user.Username}, role={role.Name}");
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetAll), new
        {
            user = new UserSummaryDto(user.Id, user.Username, user.FullName, role.Id, role.Name, user.IsActive, user.MustChangePassword, user.CreatedAt),
            // Only ever returned once, at creation time - there is no "view password" later.
            temporaryPassword = string.IsNullOrWhiteSpace(request.Password) ? password : null
        });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserRequest request, CancellationToken ct)
    {
        var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(request.FullName))
            user.FullName = request.FullName.Trim();

        if (request.RoleId.HasValue && request.RoleId.Value != user.RoleId)
        {
            var newRole = await _db.Roles.FindAsync([request.RoleId.Value], ct);
            if (newRole is null)
                return BadRequest(new { message = "Rôle introuvable" });

            if (user.Role.Name == "Admin" && newRole.Name != "Admin" && await IsLastActiveAdminAsync(id, ct))
                return BadRequest(new { message = "Impossible de retirer le rôle Admin du dernier administrateur actif" });

            user.RoleId = newRole.Id;
        }

        if (request.IsActive.HasValue && request.IsActive.Value != user.IsActive)
        {
            if (id == CurrentUserId && !request.IsActive.Value)
                return BadRequest(new { message = "Vous ne pouvez pas désactiver votre propre compte" });

            if (!request.IsActive.Value && user.Role.Name == "Admin" && await IsLastActiveAdminAsync(id, ct))
                return BadRequest(new { message = "Impossible de désactiver le dernier administrateur actif" });

            user.IsActive = request.IsActive.Value;
        }

        WriteAudit("UserUpdated", "User", user.Id.ToString(), $"fullName={user.FullName}, roleId={user.RoleId}, isActive={user.IsActive}");
        await _db.SaveChangesAsync(ct);

        await _db.Entry(user).Reference(u => u.Role).LoadAsync(ct);
        return Ok(new UserSummaryDto(user.Id, user.Username, user.FullName, user.RoleId, user.Role.Name, user.IsActive, user.MustChangePassword, user.CreatedAt));
    }

    [HttpPost("{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordRequest? request, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();

        var password = string.IsNullOrWhiteSpace(request?.NewPassword)
            ? PasswordHasher.GenerateTempPassword()
            : request!.NewPassword!;

        var passwordError = PasswordPolicy.Validate(password);
        if (passwordError is not null)
            return BadRequest(new { message = passwordError });

        user.PasswordHash = PasswordHasher.Hash(password);
        user.MustChangePassword = true;

        WriteAudit("PasswordReset", "User", user.Id.ToString(), $"username={user.Username}");
        await _db.SaveChangesAsync(ct);

        return Ok(new { temporaryPassword = password });
    }

    private async Task<bool> IsLastActiveAdminAsync(int excludingUserId, CancellationToken ct)
    {
        var activeAdminCount = await _db.Users
            .Where(u => u.IsActive && u.Role.Name == "Admin" && u.Id != excludingUserId)
            .CountAsync(ct);
        return activeAdminCount == 0;
    }

    private void WriteAudit(string action, string targetType, string targetId, string details)
    {
        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            ActorUsername = User.FindFirstValue(ClaimTypes.Name) ?? "unknown",
            Action = action,
            TargetType = targetType,
            TargetId = targetId,
            Details = details,
            CreatedAt = DateTime.UtcNow
        });
    }
}

public record UserSummaryDto(int Id, string Username, string FullName, int RoleId, string RoleName, bool IsActive, bool MustChangePassword, DateTime CreatedAt);
public record CreateUserRequest(string Username, string FullName, int RoleId, string? Password);
public record UpdateUserRequest(string? FullName, int? RoleId, bool? IsActive);
public record ResetPasswordRequest(string? NewPassword);
