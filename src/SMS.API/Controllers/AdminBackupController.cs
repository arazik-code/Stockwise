using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SMS.API.Authorization;
using SMS.Application.DTOs.Admin;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;
using SMS.Domain.Entities;
using SMS.Domain.Security;
using SMS.Infrastructure.Data;

namespace SMS.API.Controllers;

// Genuinely destructive surface (restore replaces the whole database; reset wipes it), so every
// mutating action here requires the caller's own current password on top of the JWT/role/section
// gates every other admin controller already has - a stolen/replayed session token alone is not
// enough to trigger either.
[ApiController]
[Route("api/admin/backup")]
[Authorize(Roles = "Admin")]
[RequireSection(Sections.AdminBackup)]
public class AdminBackupController : ControllerBase
{
    private const string ResetConfirmationPhrase = "REINITIALISER";

    private readonly IBackupService _backupService;
    private readonly AppDbContext _db;

    public AdminBackupController(IBackupService backupService, AppDbContext db)
    {
        _backupService = backupService;
        _db = db;
    }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string CurrentUsername => User.FindFirstValue(ClaimTypes.Name) ?? "unknown";

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
        => Ok(await _backupService.ListAsync(ct));

    [HttpPost]
    public async Task<IActionResult> Create(CancellationToken ct)
    {
        var result = await _backupService.CreateBackupAsync("manual", CurrentUsername, ct);

        if (result.Success)
        {
            WriteAudit("BackupCreated", "Backup", result.Backup!.FileName, $"size={result.Backup.SizeBytes}");
            await _db.SaveChangesAsync(ct);
        }

        return result.Success ? Ok(result) : StatusCode(500, result);
    }

    [HttpPost("{fileName}/restore")]
    public async Task<IActionResult> Restore(string fileName, [FromBody] RestoreBackupRequest request, CancellationToken ct)
    {
        var passwordError = await VerifyCurrentPasswordAsync(request.Password, ct);
        if (passwordError is not null) return BadRequest(new { message = passwordError });

        // Written and saved BEFORE the restore runs: the restore replaces this row's own table
        // wholesale, so this "started" entry only survives if it lands ahead of that.
        WriteAudit("BackupRestoreStarted", "Backup", fileName, $"by {CurrentUsername}");
        await _db.SaveChangesAsync(ct);

        var result = await _backupService.RestoreAsync(fileName, CurrentUsername, ct);
        return result.Success ? Ok(result) : StatusCode(500, result);
    }

    [HttpPost("reset")]
    public async Task<IActionResult> Reset([FromBody] ResetSystemRequest request, CancellationToken ct)
    {
        if (!string.Equals(request.Confirmation?.Trim(), ResetConfirmationPhrase, StringComparison.Ordinal))
            return BadRequest(new { message = $"Veuillez taper exactement « {ResetConfirmationPhrase} » pour confirmer." });

        var passwordError = await VerifyCurrentPasswordAsync(request.Password, ct);
        if (passwordError is not null) return BadRequest(new { message = passwordError });

        WriteAudit("SystemResetStarted", "System", "-", $"by {CurrentUsername}");
        await _db.SaveChangesAsync(ct);

        var result = await _backupService.ResetSystemAsync(CurrentUsername, ct);
        return result.Success ? Ok(result) : StatusCode(500, result);
    }

    private async Task<string?> VerifyCurrentPasswordAsync(string? password, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(password))
            return "Mot de passe requis.";

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == CurrentUserId, ct);
        if (user is null || !PasswordHasher.Verify(password, user.PasswordHash))
            return "Mot de passe incorrect.";

        return null;
    }

    private void WriteAudit(string action, string targetType, string targetId, string details)
    {
        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            ActorUsername = CurrentUsername,
            Action = action,
            TargetType = targetType,
            TargetId = targetId,
            Details = details,
            CreatedAt = DateTime.UtcNow
        });
    }
}
