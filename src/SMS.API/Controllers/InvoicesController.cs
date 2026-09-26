using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using SMS.API.Authorization;
using SMS.Application.DTOs.Invoices;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireSection(Sections.Invoices)]
public class InvoicesController : ControllerBase
{
    private readonly IInvoiceService _invoiceService;

    public InvoicesController(IInvoiceService invoiceService)
    {
        _invoiceService = invoiceService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Ok(await _invoiceService.GetAllAsync(ct));

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
        => Ok(await _invoiceService.GetSummaryAsync(ct));

    [HttpGet("search")]
    public async Task<IActionResult> Search(
        [FromQuery] string? query,
        [FromQuery] string? status,
        [FromQuery] int? fournisseurId,
        CancellationToken ct)
        => Ok(await _invoiceService.SearchAsync(query, status, fournisseurId, ct));

    [HttpGet("fournisseur/{fournisseurId:int}")]
    public async Task<IActionResult> GetByFournisseur(int fournisseurId, CancellationToken ct)
        => Ok(await _invoiceService.GetByFournisseurAsync(fournisseurId, ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var invoice = await _invoiceService.GetByIdAsync(id, ct);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateInvoiceRequest request, CancellationToken ct)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "1");
        var invoice = await _invoiceService.CreateAsync(request, userId, ct);
        return CreatedAtAction(nameof(GetById), new { id = invoice.Id }, invoice);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateInvoiceRequest request, CancellationToken ct)
    {
        var invoice = await _invoiceService.UpdateAsync(id, request, ct);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [HttpPost("{id:int}/pay")]
    public async Task<IActionResult> Pay(int id, [FromBody] PayInvoiceRequest request, CancellationToken ct)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "1");
        var invoice = await _invoiceService.PayAsync(id, request, userId, ct);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [HttpPost("{id:int}/payments/{paymentId:int}/undo")]
    public async Task<IActionResult> UndoPayment(int id, int paymentId, CancellationToken ct)
    {
        var invoice = await _invoiceService.UndoPaymentAsync(id, paymentId, ct);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [HttpPost("{id:int}/toggle-paid")]
    public async Task<IActionResult> TogglePaid(int id, CancellationToken ct)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "1");
        var invoice = await _invoiceService.TogglePaidAsync(id, userId, ct);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [HttpPost("cancel-many")]
    public async Task<IActionResult> CancelMany([FromBody] DeleteManyRequest request, CancellationToken ct)
    {
        var cancelled = await _invoiceService.CancelManyAsync(request.Ids, ct);
        return Ok(new { cancelled });
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, [FromBody] CancelInvoiceRequest? request, CancellationToken ct)
    {
        var invoice = await _invoiceService.CancelAsync(id, request?.Reason, ct);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [HttpPost("{id:int}/receive")]
    public async Task<IActionResult> Receive(int id, CancellationToken ct)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "1");
        var invoice = await _invoiceService.ReceiveAsync(id, userId, ct);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [HttpGet("{id:int}/labels")]
    public async Task<IActionResult> GetLabels(int id, CancellationToken ct)
    {
        var labels = await _invoiceService.GetLabelDataAsync(id, ct);
        return Ok(labels);
    }

    [HttpGet("archived")]
    public async Task<IActionResult> GetArchived(CancellationToken ct)
        => Ok(await _invoiceService.GetArchivedAsync(ct));

    [HttpPost("{id:int}/archive")]
    public async Task<IActionResult> Archive(int id, CancellationToken ct)
    {
        var invoice = await _invoiceService.ArchiveAsync(id, ct);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [HttpPost("{id:int}/unarchive")]
    public async Task<IActionResult> Unarchive(int id, CancellationToken ct)
    {
        var invoice = await _invoiceService.UnarchiveAsync(id, ct);
        return invoice is null ? NotFound() : Ok(invoice);
    }
}

public class CancelInvoiceRequest
{
    public string? Reason { get; set; }
}

public class DeleteManyRequest
{
    public List<int> Ids { get; set; } = new();
}
