using Microsoft.AspNetCore.Mvc;
using SMS.API.Authorization;
using SMS.Application.DTOs.Ozon;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/ozonexpress")]
[RequireSection(Sections.OzonExpress)]
public class OzonExpressController : ControllerBase
{
    private readonly IOzonExpressService _service;
    private readonly ICityResolverService _cityResolver;

    public OzonExpressController(IOzonExpressService service, ICityResolverService cityResolver)
    {
        _service = service;
        _cityResolver = cityResolver;
    }

    [HttpPost("cities/bootstrap")]
    public async Task<IActionResult> BootstrapCities(CancellationToken ct) => Ok(await _cityResolver.BootstrapHistoricalOrdersAsync(ct));

    [HttpGet("cities/unresolved")]
    public async Task<IActionResult> UnresolvedCities(CancellationToken ct) => Ok(await _cityResolver.GetUnresolvedCitiesAsync(ct));

    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken ct) => Ok(await _service.GetConfigStatusAsync(ct));

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(CancellationToken ct) => Ok(await _service.GetDashboardAsync(ct));

    [HttpPost("sync-cities")]
    public async Task<IActionResult> SyncCities(CancellationToken ct)
    {
        var count = await _service.SyncCitiesAsync(ct);
        return Ok(new { count });
    }

    [HttpGet("cities")]
    public async Task<IActionResult> Cities([FromQuery] string? search, CancellationToken ct)
        => Ok(await _service.GetCitiesAsync(search, ct));

    [HttpGet("parcels")]
    public async Task<IActionResult> Parcels([FromQuery] string? status, [FromQuery] string? search, CancellationToken ct)
        => Ok(await _service.GetParcelsAsync(status, search, ct));

    [HttpGet("parcels/{id:int}")]
    public async Task<IActionResult> Parcel(int id, CancellationToken ct)
    {
        var p = await _service.GetParcelAsync(id, ct);
        return p is null ? NotFound() : Ok(p);
    }

    [HttpGet("parcels/by-order/{onlineOrderId:int}")]
    public async Task<IActionResult> ParcelByOrder(int onlineOrderId, CancellationToken ct)
    {
        var p = await _service.GetParcelByOrderIdAsync(onlineOrderId, ct);
        return p is null ? NotFound() : Ok(p);
    }

    [HttpPost("parcels")]
    public async Task<IActionResult> CreateParcel([FromBody] CreateOzonParcelRequest request, CancellationToken ct)
    {
        var result = await _service.CreateParcelAsync(request, ct);
        return result.Ok ? Ok(result) : BadRequest(result);
    }

    [HttpGet("parcels/{id:int}/track")]
    public async Task<IActionResult> Track(int id, CancellationToken ct) => Ok(await _service.TrackParcelAsync(id, ct));

    [HttpPost("parcels/sync-tracking")]
    public async Task<IActionResult> SyncTracking(CancellationToken ct) => Ok(await _service.SyncAllTrackingAsync(ct));

    [HttpGet("delivery-notes")]
    public async Task<IActionResult> DeliveryNotes(CancellationToken ct) => Ok(await _service.GetDeliveryNotesAsync(ct));

    [HttpPost("delivery-notes")]
    public async Task<IActionResult> CreateDeliveryNote([FromBody] CreateDeliveryNoteRequest request, CancellationToken ct)
    {
        var result = await _service.CreateDeliveryNoteAsync(request, ct);
        return result.Ok ? Ok(result) : BadRequest(result);
    }
}
