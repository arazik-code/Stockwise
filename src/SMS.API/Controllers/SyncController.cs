using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMS.Application.DTOs.Sync;
using SMS.Application.Interfaces;

namespace SMS.API.Controllers;

// Protected by a static shared key (Sync:ApiKey), not JWT - the whole point is the local sync
// worker can pull/push data without needing a user session first (avoids a bootstrap dependency
// on being able to log in, which is exactly the thing this sync exists to keep working). Both
// endpoints exist on every deployment (VPS and local-fallback alike, same codebase) - which side
// is "source" vs "destination" is just which URL the sync worker script calls for which verb.
[ApiController]
[Route("api/sync")]
[AllowAnonymous]
public class SyncController : ControllerBase
{
    private readonly ISyncSnapshotService _syncService;
    private readonly IConfiguration _configuration;

    public SyncController(ISyncSnapshotService syncService, IConfiguration configuration)
    {
        _syncService = syncService;
        _configuration = configuration;
    }

    [HttpGet("snapshot")]
    public async Task<IActionResult> GetSnapshot(CancellationToken ct)
    {
        if (!IsAuthorized()) return Unauthorized();
        return Ok(await _syncService.BuildSnapshotAsync(ct));
    }

    [HttpPost("apply")]
    public async Task<IActionResult> ApplySnapshot([FromBody] SyncSnapshotDto snapshot, CancellationToken ct)
    {
        if (!IsAuthorized()) return Unauthorized();
        return Ok(await _syncService.ApplySnapshotAsync(snapshot, ct));
    }

    private bool IsAuthorized()
    {
        var expectedKey = _configuration["Sync:ApiKey"];
        if (string.IsNullOrEmpty(expectedKey)) return false; // unconfigured = disabled, not wide open

        var providedKey = Request.Headers["X-Sync-Api-Key"].ToString();
        if (string.IsNullOrEmpty(providedKey)) return false;

        var providedBytes = Encoding.UTF8.GetBytes(providedKey);
        var expectedBytes = Encoding.UTF8.GetBytes(expectedKey);
        return providedBytes.Length == expectedBytes.Length &&
               CryptographicOperations.FixedTimeEquals(providedBytes, expectedBytes);
    }
}
