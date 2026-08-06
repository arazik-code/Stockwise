using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using SMS.API.Authorization;
using SMS.Application.DTOs.Online;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/order-confirmation")]
[RequireSection(Sections.OrderConfirmation)]
public class OrderConfirmationController : ControllerBase
{
    private readonly IOrderConfirmationService _service;

    public OrderConfirmationController(IOrderConfirmationService service) => _service = service;

    [HttpGet("queue")]
    public async Task<IActionResult> GetQueue(CancellationToken ct) => Ok(await _service.GetQueueAsync(ct));

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats(CancellationToken ct) => Ok(await _service.GetStatsAsync(ct));

    [HttpGet("{onlineOrderId:int}/attempts")]
    public async Task<IActionResult> GetAttempts(int onlineOrderId, CancellationToken ct) => Ok(await _service.GetAttemptsAsync(onlineOrderId, ct));

    [HttpPost("{onlineOrderId:int}/attempts")]
    public async Task<IActionResult> LogAttempt(int onlineOrderId, [FromBody] LogConfirmationAttemptRequest request, CancellationToken ct)
    {
        var userId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var uid) ? uid : (int?)null;
        await _service.LogAttemptAsync(onlineOrderId, request, userId, ct);
        return Ok();
    }
}
