using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using SMS.API.Authorization;
using SMS.Application.DTOs;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;

namespace SMS.API.Controllers;

// Admin-only by default: recording cash taken out of / put into the physical register is an
// owner-level action. RequireSection still lets an Admin explicitly grant a custom role the
// CashDrawer section if a store owner wants that - opt-in, not the default for anyone else.
[ApiController]
[Route("api/cash-drawer")]
[RequireSection(Sections.CashDrawer)]
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
