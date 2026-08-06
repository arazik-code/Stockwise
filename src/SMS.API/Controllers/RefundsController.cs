using Microsoft.AspNetCore.Mvc;
using SMS.API.Authorization;
using SMS.Application.DTOs.Refunds;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireSection(Sections.Refunds)]
public class RefundsController : ControllerBase
{
    private readonly IRefundService _refundService;

    public RefundsController(IRefundService refundService)
    {
        _refundService = refundService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var refunds = await _refundService.GetAllAsync(ct);
        return Ok(refunds);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var refund = await _refundService.GetByIdAsync(id, ct);
        return refund is null ? NotFound() : Ok(refund);
    }

    [HttpGet("sale/{saleId:int}")]
    public async Task<IActionResult> GetSaleForRefund(int saleId, CancellationToken ct)
    {
        var sale = await _refundService.GetSaleForRefundAsync(saleId, ct);
        return sale is null ? NotFound() : Ok(sale);
    }

    [HttpGet("scan-barcode/{barcode}")]
    public async Task<IActionResult> ScanBarcode(string barcode, CancellationToken ct)
    {
        try
        {
            var sale = await _refundService.ScanReceiptBarcodeAsync(barcode, ct);
            return sale is null ? NotFound(new { message = "Bon introuvable" }) : Ok(sale);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("scan-client-qr/{qrCode}")]
    public async Task<IActionResult> ScanClientQr(string qrCode, CancellationToken ct)
    {
        var sales = await _refundService.ScanClientQrCodeAsync(qrCode, ct);
        return Ok(sales);
    }

    [HttpGet("search-variants")]
    public async Task<IActionResult> SearchVariants([FromQuery] string query, CancellationToken ct)
    {
        var variants = await _refundService.SearchVariantsForExchangeAsync(query, ct);
        return Ok(variants);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRefundRequest request, CancellationToken ct)
    {
        try
        {
            var sub = User.FindFirst("sub")?.Value;
            int? userId = int.TryParse(sub, out var id) && id > 0 ? id : null;
            var refund = await _refundService.CreateAsync(request, userId, ct);
            return Ok(refund);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/process")]
    public async Task<IActionResult> Process(int id, CancellationToken ct)
    {
        var refund = await _refundService.ProcessAsync(id, ct);
        if (refund is null) return NotFound();
        return Ok(refund);
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, CancellationToken ct)
    {
        var refund = await _refundService.CancelAsync(id, ct);
        if (refund is null) return NotFound();
        return Ok(refund);
    }
}
