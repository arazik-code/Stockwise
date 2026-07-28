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
    private readonly IShopifyInventoryPusher _inventoryPusher;
    private readonly IShopifyBulkSync? _bulkSync;

    public ShopifyController(
        IShopifySyncService syncService,
        IOnlineOrderService onlineOrderService,
        IShopifyInventoryPusher inventoryPusher,
        IShopifyBulkSync? bulkSync = null)
    {
        _syncService = syncService;
        _onlineOrderService = onlineOrderService;
        _inventoryPusher = inventoryPusher;
        _bulkSync = bulkSync;
    }

    /// <summary>Pushes local stock to Shopify for every linked variant whose quantity differs.</summary>
    [HttpPost("inventory/sync-all")]
    [Authorize(Roles = "Admin,StockManager")]
    public IActionResult SyncAll()
    {
        if (_bulkSync is null)
            return BadRequest(new { message = "Shopify n'est pas configure." });

        var started = _bulkSync.TryStart();
        return Ok(new
        {
            started,
            message = started
                ? "Synchronisation lancee."
                : "Une synchronisation est deja en cours.",
            progress = _bulkSync.GetProgress()
        });
    }

    [HttpGet("inventory/sync-status")]
    [Authorize(Roles = "Admin,StockManager")]
    public IActionResult SyncStatus()
    {
        if (_bulkSync is null)
            return Ok(new ShopifyBulkSyncProgress { Phase = "Shopify non configure" });

        return Ok(_bulkSync.GetProgress());
    }

    /// <summary>
    /// Pushes one variant's current stock to Shopify synchronously and reports exactly what
    /// happened. Exists because this path used to fail silently - now it is directly testable
    /// from the UI instead of only being observable by comparing Shopify by hand afterwards.
    /// </summary>
    [HttpPost("inventory/push/{productVariantId:int}")]
    [Authorize(Roles = "Admin,StockManager")]
    public async Task<IActionResult> PushInventory(int productVariantId, CancellationToken ct)
    {
        var result = await _inventoryPusher.PushVariantAsync(productVariantId, ct);
        return Ok(new
        {
            result.ProductVariantId,
            result.Success,
            Outcome = result.Outcome.ToString(),
            result.Message,
            result.ShopifyVariantId,
            result.InventoryItemId,
            result.QuantityPushed
        });
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

    // StockManager can also trigger this - they're the ones who actually work the conflict
    // queue day to day, unlike the rest of this controller which is Shopify-config territory.
    [HttpPost("orders/rematch")]
    [Authorize(Roles = "Admin,StockManager")]
    public async Task<IActionResult> RematchConflictedOrders(CancellationToken ct)
    {
        var result = await _syncService.RematchConflictedOrdersAsync(ct);
        return Ok(result);
    }

    // One-off recovery for orders created before line items were preserved on conflict - they
    // exist with zero OnlineOrderItems. Re-fetches from Shopify's order history and rebuilds them,
    // then runs the same rematch pass.
    [HttpPost("orders/backfill")]
    [Authorize(Roles = "Admin,StockManager")]
    public async Task<IActionResult> BackfillMissingLineItems(CancellationToken ct)
    {
        var backfill = await _syncService.BackfillMissingLineItemsAsync(ct);
        var rematch = await _syncService.RematchConflictedOrdersAsync(ct);
        return Ok(new { backfill, rematch });
    }

    [HttpGet("locations")]
    public async Task<IActionResult> GetLocations(CancellationToken ct)
    {
        var locations = await _syncService.GetLocationsAsync(ct);
        return Ok(locations);
    }
}
