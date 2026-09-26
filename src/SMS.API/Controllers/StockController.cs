using Microsoft.AspNetCore.Mvc;
using SMS.API.Authorization;
using SMS.Application.DTOs.Stock;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireSection(Sections.Stock)]
public class StockController : ControllerBase
{
    private readonly IStockService _stockService;

    public StockController(IStockService stockService)
    {
        _stockService = stockService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await _stockService.GetAllStockAsync(ct);
        return Ok(items);
    }

    [HttpGet("{variantId:int}")]
    public async Task<IActionResult> GetByVariant(int variantId, CancellationToken ct)
    {
        var item = await _stockService.GetStockByVariantAsync(variantId, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpGet("low")]
    public async Task<IActionResult> GetLowStock(CancellationToken ct)
    {
        var items = await _stockService.GetLowStockAsync(ct);
        return Ok(items);
    }

    [HttpPost("adjust")]
    public async Task<IActionResult> Adjust([FromBody] AdjustStockRequest request, CancellationToken ct)
    {
        await _stockService.AdjustStockAsync(request, ct: ct);
        return Ok();
    }

    [HttpPost("set-quantity")]
    public async Task<IActionResult> SetQuantity([FromBody] SetQuantityRequest request, CancellationToken ct)
    {
        await _stockService.SetQuantityAsync(request.ProductVariantId, request.NewQuantity, request.Notes, ct: ct);
        return Ok();
    }

    [HttpDelete("{variantId:int}")]
    public async Task<IActionResult> DeleteStock(int variantId, CancellationToken ct)
    {
        await _stockService.DeleteStockAsync(variantId, ct);
        return Ok();
    }

    [HttpPost("bulk-delete")]
    public async Task<IActionResult> BulkDelete([FromBody] List<int> variantIds, CancellationToken ct)
    {
        foreach (var id in variantIds)
        {
            await _stockService.DeleteStockAsync(id, ct);
        }
        return Ok();
    }

    [HttpPost("movements/{movementId:long}/undo")]
    public async Task<IActionResult> UndoAdjustment(long movementId, CancellationToken ct)
    {
        await _stockService.UndoAdjustmentAsync(movementId, ct: ct);
        return Ok();
    }

    [HttpGet("movements")]
    public async Task<IActionResult> GetMovements(
        [FromQuery] int? productVariantId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken ct)
    {
        var movements = await _stockService.GetMovementsAsync(productVariantId, from, to, ct);
        return Ok(movements);
    }
}
