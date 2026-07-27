using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMS.Application.DTOs.Online;
using SMS.Application.Interfaces;
using SMS.Domain.Enums;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/online-orders")]
[Authorize(Roles = "Admin,StockManager")]
public class OnlineOrdersController : ControllerBase
{
    private readonly IOnlineOrderService _service;
    private readonly IOzonExpressService _ozon;

    public OnlineOrdersController(IOnlineOrderService service, IOzonExpressService ozon)
    {
        _service = service;
        _ozon = ozon;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] OnlineOrderChannel? channel,
        [FromQuery] OrderStatus? status,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken ct)
    {
        var utcFrom = from.HasValue ? DateTime.SpecifyKind(from.Value, DateTimeKind.Utc) : (DateTime?)null;
        var utcTo = to.HasValue ? DateTime.SpecifyKind(to.Value, DateTimeKind.Utc) : (DateTime?)null;
        var orders = await _service.GetAllAsync(channel, status, utcFrom, utcTo, ct);
        return Ok(orders);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var order = await _service.GetByIdAsync(id, ct);
        return order is null ? NotFound() : Ok(order);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateManualOrderRequest request, CancellationToken ct)
    {
        var userId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var uid) ? uid : (int?)null;
        var order = await _service.CreateManualOrderAsync(request, userId, ct);
        return CreatedAtAction(nameof(GetById), new { id = order.Id }, order);
    }

    [HttpPut("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateOrderStatusRequest request, CancellationToken ct)
    {
        var order = await _service.UpdateStatusAsync(id, request.Status, ct);
        return order is null ? NotFound() : Ok(order);
    }

    // Confirm an order AND auto-create its OzonExpress parcel in one step (the WhatsApp-confirmation
    // workflow). Returns the updated order plus the parcel result so the client can print the Bon de Commande.
    [HttpPost("{id:int}/confirm-ship")]
    public async Task<IActionResult> ConfirmAndShip(int id, CancellationToken ct)
    {
        var order = await _service.UpdateStatusAsync(id, OrderStatus.Confirmed, ct);
        if (order is null) return NotFound();

        var parcel = await _ozon.CreateParcelForOrderAsync(id, ct);
        var updated = await _service.GetByIdAsync(id, ct);
        return Ok(new { order = updated ?? order, parcel });
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, [FromBody] CancelOrderRequest request, CancellationToken ct)
    {
        var result = await _service.CancelAsync(id, request.Reason, ct);
        return result ? Ok() : NotFound();
    }

    [HttpPost("{id:int}/pay")]
    public async Task<IActionResult> MarkPaid(int id, [FromBody] MarkPaidRequest request, CancellationToken ct)
    {
        var order = await _service.MarkPaidAsync(id, request.AmountPaid, ct);
        return order is null ? NotFound() : Ok(order);
    }

    [HttpPut("{id:int}/shipping")]
    public async Task<IActionResult> AssignShipping(int id, [FromBody] AssignShippingRequest request, CancellationToken ct)
    {
        var order = await _service.AssignShippingAsync(id, request, ct);
        return order is null ? NotFound() : Ok(order);
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard(CancellationToken ct)
    {
        var dashboard = await _service.GetDashboardAsync(ct);
        return Ok(dashboard);
    }

    [HttpGet("conflicts")]
    public async Task<IActionResult> GetConflicts(CancellationToken ct)
    {
        var conflicts = await _service.GetConflictsAsync(ct);
        return Ok(conflicts);
    }

    [HttpGet("reports")]
    public async Task<IActionResult> GetReport([FromQuery] DateTime from, [FromQuery] DateTime to, CancellationToken ct)
    {
        var utcFrom = DateTime.SpecifyKind(from, DateTimeKind.Utc);
        var utcTo = DateTime.SpecifyKind(to, DateTimeKind.Utc);
        var report = await _service.GetReportAsync(utcFrom, utcTo, ct);
        return Ok(report);
    }
}
