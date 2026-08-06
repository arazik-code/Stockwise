using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMS.API.Authorization;
using SMS.Application.DTOs.Sales;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;
using SMS.Domain.Enums;
using System.Security.Claims;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireSection(Sections.Pos)]
public class SalesController : ControllerBase
{
    private readonly ISaleService _saleService;

    public SalesController(ISaleService saleService)
    {
        _saleService = saleService;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSaleRequest request, CancellationToken ct)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "1");
        var sale = await _saleService.CreateSaleAsync(request, userId, ct);
        return CreatedAtAction(nameof(GetById), new { id = sale.Id }, sale);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var sales = await _saleService.GetAllAsync(ct);
        return Ok(sales);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var sale = await _saleService.GetByIdAsync(id, ct);
        return sale is null ? NotFound() : Ok(sale);
    }

    [HttpGet("daily-report")]
    public async Task<IActionResult> GetDailyReport([FromQuery] DateTime? date, CancellationToken ct)
    {
        DateTime? utcDate = date.HasValue ? DateTime.SpecifyKind(date.Value, DateTimeKind.Utc) : (DateTime?)null;
        var report = await _saleService.GetDailyReportAsync(utcDate, ct);
        return Ok(report);
    }

    [HttpGet("report")]
    public async Task<IActionResult> GetReport(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] SaleChannel? channel,
        CancellationToken ct)
    {
        var utcFrom = DateTime.SpecifyKind(from, DateTimeKind.Utc);
        var utcTo = DateTime.SpecifyKind(to, DateTimeKind.Utc);
        var sales = await _saleService.GetByDateRangeAsync(utcFrom, utcTo, channel, ct);
        return Ok(sales);
    }

    [HttpGet("sales-report")]
    public async Task<IActionResult> GetSalesReport(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] int? fournisseurId,
        [FromQuery] SaleCategory? category,
        CancellationToken ct)
    {
        var utcFrom = DateTime.SpecifyKind(from, DateTimeKind.Utc);
        var utcTo = DateTime.SpecifyKind(to, DateTimeKind.Utc);
        var report = await _saleService.GetSalesReportAsync(utcFrom, utcTo, fournisseurId, category, ct);
        return Ok(report);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Void(int id, CancellationToken ct)
    {
        await _saleService.VoidAsync(id, ct);
        return Ok();
    }

    [HttpPost("bulk-delete")]
    public async Task<IActionResult> VoidBulk([FromBody] BulkDeleteRequest request, CancellationToken ct)
    {
        var deleted = await _saleService.VoidManyAsync(request.Ids, ct);
        return Ok(new { deleted });
    }

    [HttpGet("offline")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetOfflineSales(CancellationToken ct)
    {
        var sales = await _saleService.GetUnreconciledOfflineSalesAsync(ct);
        return Ok(sales);
    }

    [HttpPost("{id:int}/reconcile")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> MarkReconciled(int id, CancellationToken ct)
    {
        var sale = await _saleService.MarkReconciledAsync(id, ct);
        return sale is null ? NotFound() : Ok(sale);
    }
}
