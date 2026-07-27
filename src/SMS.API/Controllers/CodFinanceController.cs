using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMS.Application.DTOs.Finance;
using SMS.Application.Interfaces;
using System.Security.Claims;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/cod-finance")]
[Authorize(Roles = "Admin,StockManager")]
public class CodFinanceController : ControllerBase
{
    private readonly ICodLedgerService _ledgerService;

    public CodFinanceController(ICodLedgerService ledgerService)
    {
        _ledgerService = ledgerService;
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard(CancellationToken ct)
        => Ok(await _ledgerService.GetDashboardAsync(ct));

    [HttpGet("ledger")]
    public async Task<IActionResult> GetLedger([FromQuery] int? onlineOrderId, CancellationToken ct)
        => Ok(await _ledgerService.GetLedgerAsync(onlineOrderId, ct));

    [HttpGet("remittances")]
    public async Task<IActionResult> GetRemittances(CancellationToken ct)
        => Ok(await _ledgerService.GetRemittancesAsync(ct));

    [HttpPost("remittances")]
    public async Task<IActionResult> CreateRemittance([FromBody] CreateRemittanceRequest request, CancellationToken ct)
    {
        var userId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var uid) ? uid : (int?)null;
        var result = await _ledgerService.CreateRemittanceAsync(request, userId, ct);
        return Ok(result);
    }
}
