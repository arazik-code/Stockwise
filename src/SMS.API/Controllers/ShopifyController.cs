using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMS.Application.Interfaces;
using SMS.Domain.Enums;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class ShopifyController : ControllerBase
{
    private readonly IShopifySyncService _syncService;
    private readonly IOnlineOrderService _onlineOrderService;

    public ShopifyController(IShopifySyncService syncService, IOnlineOrderService onlineOrderService)
    {
        _syncService = syncService;
        _onlineOrderService = onlineOrderService;
    }

    [HttpGet("orders")]
    public async Task<IActionResult> GetOrders(CancellationToken ct)
    {
        var orders = await _onlineOrderService.GetAllAsync(channel: OnlineOrderChannel.Shopify, ct: ct);
        return Ok(orders);
    }

    [HttpPost("sync/trigger")]
    public async Task<IActionResult> TriggerSync(CancellationToken ct)
    {
        await _syncService.SyncRecentOrdersAsync(ct);
        await _syncService.SyncInventoryLevelsAsync(ct);
        return Ok(new { message = "Sync triggered successfully" });
    }

    [HttpGet("sync/status")]
    public async Task<IActionResult> GetSyncStatus(CancellationToken ct)
    {
        var status = await _syncService.GetSyncStatusAsync(ct);
        return Ok(status);
    }

    [HttpGet("locations")]
    public async Task<IActionResult> GetLocations(CancellationToken ct)
    {
        var locations = await _syncService.GetLocationsAsync(ct);
        return Ok(locations);
    }
}
