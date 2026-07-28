using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMS.Application.DTOs;
using SMS.Application.Interfaces;

namespace SMS.API.Controllers;

// Admin-only: recording cash taken out of / put into the physical register is an owner-level
// action, not something a cashier should be able to log themselves.
[ApiController]
[Route("api/cash-drawer")]
[Authorize(Roles = "Admin")]
public class CashDrawerController : ControllerBase
{
    private readonly ICashDrawerService _service;

    public CashDrawerController(ICashDrawerService service) => _service = service;

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) => Ok(await _service.GetSummaryAsync(ct: ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCashDrawerMovementRequest request, CancellationToken ct)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _service.CreateAsync(userId, request, ct);
        return Ok(result);
    }
}
