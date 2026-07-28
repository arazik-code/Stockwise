using System.Globalization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class ShopifySyncAppService : IShopifySyncService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IInventoryNotifier _notifier;
    private readonly IOnlineOrderService _onlineOrderService;
    private readonly ICityResolverService _cityResolver;
    private readonly IShopifyApiClient? _shopifyClient;
    private readonly ShopifyOptions _shopifyOptions;
    private readonly ILogger<ShopifySyncAppService> _logger;

    public ShopifySyncAppService(
        IUnitOfWork unitOfWork,
        IInventoryNotifier notifier,
        IOnlineOrderService onlineOrderService,
        ICityResolverService cityResolver,
        IOptions<ShopifyOptions> shopifyOptions,
        ILogger<ShopifySyncAppService> logger,
        IShopifyApiClient? shopifyClient = null)
    {
        _unitOfWork = unitOfWork;
        _notifier = notifier;
        _onlineOrderService = onlineOrderService;
        _cityResolver = cityResolver;
        _shopifyOptions = shopifyOptions.Value;
        _logger = logger;
        _shopifyClient = shopifyClient;
    }

    public async Task ProcessOrderCreatedAsync(
        long shopifyOrderId, string orderNumber, string financialStatus,
        string fulfillmentStatus, decimal totalPrice, string currency,
        string? customerEmail, string? customerName,
        List<ShopifyLineItemDto> lineItems, DateTime createdAt,
        string? customerPhone = null, string? city = null, string? addressLine = null,
        long? shopifyCustomerId = null, CancellationToken ct = default)
    {
        var existing = await _unitOfWork.OnlineOrders.GetByShopifyOrderIdAsync(shopifyOrderId, ct);
        if (existing is not null)
        {
            _logger.LogInformation("Shopify order {OrderId} already processed, skipping", shopifyOrderId);
            return;
        }

        await _unitOfWork.BeginTransactionAsync(ct);

        try
        {
            var normalizedPhone = NormalizePhone(customerPhone);
            var client = await ResolveOrCreateClientAsync(shopifyCustomerId, customerName, normalizedPhone, customerEmail, city, addressLine, ct);

            var resolvedItems = new List<(ShopifyLineItemDto lineItem, ProductVariant? variant, StockItem? stock)>();
            foreach (var lineItem in lineItems)
            {
                var variant = await FindLocalVariantByShopifyId(lineItem.ProductId, lineItem.VariantId, ct);
                var stock = variant is not null ? await _unitOfWork.Stock.GetByVariantIdAsync(variant.Id, ct) : null;
                resolvedItems.Add((lineItem, variant, stock));
            }

            var unmapped = resolvedItems.Where(r => r.variant is null).ToList();
            var mapped = resolvedItems.Where(r => r.variant is not null).ToList();
            var allSufficient = unmapped.Count == 0 &&
                mapped.All(r => r.stock is not null && r.stock.QuantityAvailable >= r.lineItem.Quantity);

            // Every line is kept, mapped or not - this used to discard unmapped lines entirely
            // (their title went into a free-text Notes string and the row was never created), so
            // a conflicted order ended up with zero OnlineOrderItems and was unrecoverable from
            // the UI. Now the raw Shopify ids/sku are kept on the row so a rematch pass can
            // resolve it later without needing to re-fetch anything from Shopify.
            var orderItems = new List<OnlineOrderItem>();
            foreach (var (lineItem, variant, stock) in resolvedItems)
            {
                var reserve = allSufficient && variant is not null && stock is not null;
                if (reserve)
                {
                    stock!.QuantityReserved += lineItem.Quantity;
                    stock.LastUpdatedAt = DateTime.UtcNow;
                }

                orderItems.Add(new OnlineOrderItem
                {
                    ProductVariantId = variant?.Id,
                    ShopifyProductId = variant is null ? lineItem.ProductId : null,
                    ShopifyVariantId = variant is null ? lineItem.VariantId : null,
                    ShopifySku = variant is null ? lineItem.Sku : null,
                    ProductNameSnapshot = variant?.Product?.Name ?? lineItem.Title,
                    SkuSnapshot = variant?.Sku ?? lineItem.Sku ?? string.Empty,
                    Quantity = lineItem.Quantity,
                    UnitPrice = lineItem.Price,
                    DiscountAmount = 0,
                    LineTotal = lineItem.Price * lineItem.Quantity,
                    QuantityReserved = reserve ? lineItem.Quantity : 0,
                    QuantityFulfilled = 0
                });
            }

            var notes = unmapped.Count > 0
                ? "Produits non mappés au catalogue local: " + string.Join(", ", unmapped.Select(r => $"{r.lineItem.Title} (x{r.lineItem.Quantity})"))
                : allSufficient ? null : "Stock insuffisant pour honorer cette commande Shopify";

            var isPaid = string.Equals(financialStatus, "paid", StringComparison.OrdinalIgnoreCase);

            // Resolved at ingest time now, not just at parcel-creation time - the fuzzy matcher
            // used to only ever run when someone clicked "create parcel", so a bad match was
            // discovered late and the raw city text sat unresolved for every order in between.
            var cityResolution = await _cityResolver.ResolveAsync(city, ct);

            var order = new OnlineOrder
            {
                OrderNumber = await _unitOfWork.OnlineOrders.GenerateOrderNumberAsync(OnlineOrderChannel.Shopify, ct),
                Channel = OnlineOrderChannel.Shopify,
                Status = allSufficient ? OrderStatus.Processing : OrderStatus.InventoryConflict,
                PaymentStatus = isPaid ? OnlinePaymentStatus.Paid : OnlinePaymentStatus.Unpaid,
                PaymentMethod = OnlinePaymentMethod.ShopifyCheckout,
                ClientId = client?.Id,
                CustomerName = string.IsNullOrWhiteSpace(customerName) ? (client?.Name ?? "Client Shopify") : customerName,
                CustomerPhone = normalizedPhone,
                CustomerEmail = customerEmail,
                City = Trim(city, 100),
                OzonCityId = cityResolution?.OzonCityId,
                CityCanonical = cityResolution?.CanonicalName,
                AddressLine = Trim(addressLine, 500),
                SubTotal = totalPrice,
                TotalAmount = totalPrice,
                AmountPaid = isPaid ? totalPrice : 0,
                StockReserved = allSufficient,
                ShopifyOrderId = shopifyOrderId,
                Notes = notes,
                CreatedAt = createdAt,
                Items = orderItems
            };

            await _unitOfWork.OnlineOrders.AddAsync(order, ct);
            await _unitOfWork.SaveChangesAsync(ct);
            await _unitOfWork.CommitTransactionAsync(ct);

            await _notifier.NotifyNewOnlineOrderAsync(order.Channel.ToString(), order.OrderNumber, order.TotalAmount, ct);

            if (!allSufficient)
            {
                _logger.LogWarning("Shopify order {OrderId} has insufficient stock, flagged as conflict", shopifyOrderId);
            }
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(ct);
            throw;
        }
    }

    public async Task ProcessOrderCancelledAsync(long shopifyOrderId, CancellationToken ct = default)
    {
        var order = await _unitOfWork.OnlineOrders.GetByShopifyOrderIdAsync(shopifyOrderId, ct);
        if (order is null) return;

        await _onlineOrderService.CancelAsync(order.Id, "Annulée sur Shopify", ct);
    }

    public async Task SyncRecentOrdersAsync(CancellationToken ct = default)
    {
        if (_shopifyClient is null)
        {
            _logger.LogDebug("Shopify client not configured, skipping order sync");
            return;
        }

        _logger.LogInformation("Syncing recent Shopify orders...");

        try
        {
            var orders = await _shopifyClient.GetOrdersAsync(
                status: "any",
                limit: 50,
                createdAtMin: DateTime.UtcNow.AddDays(-7),
                ct: ct);

            if (orders?.Orders is null)
            {
                _logger.LogWarning("No orders returned from Shopify");
                return;
            }

            foreach (var order in orders.Orders)
            {
                var existing = await _unitOfWork.OnlineOrders.GetByShopifyOrderIdAsync(order.Id, ct);
                if (existing is not null) continue;

                var total = ParseShopifyDecimal(order.TotalPrice);

                var lineItems = order.LineItems.Select(li => new ShopifyLineItemDto
                {
                    ProductId = li.ProductId ?? 0,
                    VariantId = li.VariantId ?? 0,
                    Title = li.Title,
                    Quantity = li.Quantity,
                    Price = ParseShopifyDecimal(li.Price),
                    Sku = string.IsNullOrWhiteSpace(li.Sku) ? null : li.Sku
                }).ToList();

                // Prefer the shipping address (where goods go), then billing, then the customer record.
                var addr = order.ShippingAddress ?? order.BillingAddress;
                var customerName = new[]
                {
                    addr?.Name,
                    string.Join(" ", new[] { addr?.FirstName, addr?.LastName }.Where(s => !string.IsNullOrWhiteSpace(s))),
                    string.Join(" ", new[] { order.Customer?.FirstName, order.Customer?.LastName }.Where(s => !string.IsNullOrWhiteSpace(s))),
                }.FirstOrDefault(s => !string.IsNullOrWhiteSpace(s));

                var customerPhone = new[] { addr?.Phone, order.Customer?.Phone, order.Phone }
                    .FirstOrDefault(s => !string.IsNullOrWhiteSpace(s));
                var city = addr?.City;
                var addressLine = string.Join(", ", new[] { addr?.Address1, addr?.Address2 }.Where(s => !string.IsNullOrWhiteSpace(s)));

                await ProcessOrderCreatedAsync(
                    order.Id,
                    order.Name ?? order.OrderNumber.ToString(),
                    order.FinancialStatus,
                    order.FulfillmentStatus,
                    total,
                    order.Currency,
                    order.Email,
                    string.IsNullOrWhiteSpace(customerName) ? null : customerName.Trim(),
                    lineItems,
                    DateTimeOffset.TryParse(order.CreatedAt, out var createdAt) ? createdAt.UtcDateTime : DateTime.UtcNow,
                    customerPhone: string.IsNullOrWhiteSpace(customerPhone) ? null : customerPhone.Trim(),
                    city: string.IsNullOrWhiteSpace(city) ? null : city.Trim(),
                    addressLine: string.IsNullOrWhiteSpace(addressLine) ? null : addressLine,
                    shopifyCustomerId: order.Customer?.Id,
                    ct: ct);
            }

            _logger.LogInformation("Synced {Count} recent Shopify orders", orders.Orders.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to sync recent Shopify orders");
        }
    }

    public async Task SyncInventoryLevelsAsync(CancellationToken ct = default)
    {
        if (_shopifyClient is null)
        {
            _logger.LogDebug("Shopify client not configured, skipping inventory sync");
            return;
        }

        _logger.LogInformation("Syncing inventory levels with Shopify...");

        if (!long.TryParse(_shopifyOptions.LocationId, out var locationId))
        {
            _logger.LogWarning("Shopify LocationId not configured, skipping inventory push");
            return;
        }

        List<ShopifyProductItem> products;
        try
        {
            // Was limit:50 - meaning this reconciliation only ever looked at the same first 50
            // of 517 Shopify products, forever. GetAllProductsAsync pages through the full catalog.
            products = await _shopifyClient.GetAllProductsAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch Shopify catalog for inventory sync");
            return;
        }

        var pushed = 0;
        foreach (var shopifyProduct in products)
        {
            foreach (var variant in shopifyProduct.Variants)
            {
                try
                {
                    // Match directly on ProductVariant.ShopifyVariantId - going through
                    // ShopifyProduct.LocalProductId never worked, since that column is never populated
                    // (product/variant matching always goes through ShopifyVariantId instead).
                    var variants = await _unitOfWork.FindAsync<ProductVariant>(
                        v => v.ShopifyVariantId == variant.Id, ct);
                    var productVariant = variants.FirstOrDefault();
                    if (productVariant is null) continue;

                    var stockItem = await _unitOfWork.Stock.GetByVariantIdAsync(productVariant.Id, ct);
                    if (stockItem is not null && variant.InventoryItemId > 0)
                    {
                        await _shopifyClient.UpdateInventoryLevelAsync(
                            variant.InventoryItemId, locationId, stockItem.QuantityOnHand, ct);
                        pushed++;

                        // Shopify's REST admin API sustains ~2 req/sec - firing the whole catalog
                        // back to back blew through that instantly and turned into a wall of 429s
                        // (confirmed live: ~300 requests in under 3 seconds, nearly all rejected).
                        await Task.Delay(500, ct);
                    }
                }
                catch (Exception ex)
                {
                    // One variant failing (rate limit, transient error) must not abort the rest of
                    // the reconciliation pass - it used to be all-or-nothing via the outer try/catch.
                    _logger.LogError(ex, "Failed to sync inventory for Shopify variant {VariantId}", variant.Id);
                }
            }
        }

        _logger.LogInformation("Inventory sync with Shopify completed - pushed {Count} levels", pushed);
    }

    public async Task<ShopifySyncStatusDto> GetSyncStatusAsync(CancellationToken ct = default)
    {
        var conflicts = await _unitOfWork.OnlineOrders.GetConflictsAsync(ct);
        return new ShopifySyncStatusDto
        {
            LastSyncTime = DateTime.UtcNow,
            PendingOrders = conflicts.Count(o => o.Channel == OnlineOrderChannel.Shopify),
            PendingProducts = 0,
            IsSyncing = false
        };
    }

    public async Task<OrderRematchResultDto> RematchConflictedOrdersAsync(CancellationToken ct = default)
    {
        var conflicted = await _unitOfWork.OnlineOrders.GetConflictsAsync(ct);
        int ordersResolved = 0, itemsMatched = 0, itemsStillUnresolved = 0;

        foreach (var order in conflicted)
        {
            // A conflicted order with literally zero items has never had its lines rebuilt at all
            // (needs BackfillMissingLineItemsAsync first) - distinct from an order whose items are
            // already fully mapped, which must still fall through to the stock/clear check below.
            if (order.Items.Count == 0) continue;

            var unresolvedItems = order.Items.Where(i => i.ProductVariantId is null).ToList();
            foreach (var item in unresolvedItems)
            {
                var variant = await MatchUnresolvedItemAsync(item, ct);
                if (variant is not null)
                {
                    item.ProductVariantId = variant.Id;
                    item.SkuSnapshot = variant.Sku;
                    itemsMatched++;
                }
            }

            if (order.Items.Any(i => i.ProductVariantId is null))
            {
                itemsStillUnresolved += order.Items.Count(i => i.ProductVariantId is null);
                await _unitOfWork.SaveChangesAsync(ct); // keep any partial progress on this order
                continue;
            }

            // Every item on this order now has a local match - either matched just now, or already
            // resolved by an earlier backfill/rematch pass. Either way, still worth checking whether
            // it can finally clear out of InventoryConflict.

            // Every line now has a local match - check stock and reserve, same rule
            // ProcessOrderCreatedAsync uses for a fresh order.
            var stockByItem = new List<(OnlineOrderItem Item, StockItem Stock)>();
            var sufficient = true;
            foreach (var item in order.Items)
            {
                var stock = await _unitOfWork.Stock.GetByVariantIdAsync(item.ProductVariantId!.Value, ct);
                if (stock is null || stock.QuantityAvailable < item.Quantity) { sufficient = false; break; }
                stockByItem.Add((item, stock));
            }

            if (!sufficient)
            {
                order.Notes = "Catalogue rapproché, mais stock insuffisant pour honorer cette commande";
                await _unitOfWork.SaveChangesAsync(ct);
                continue;
            }

            foreach (var (item, stock) in stockByItem)
            {
                stock.QuantityReserved += item.Quantity;
                stock.LastUpdatedAt = DateTime.UtcNow;
                item.QuantityReserved = item.Quantity;
            }
            order.StockReserved = true;
            order.Notes = null;
            await _unitOfWork.SaveChangesAsync(ct);

            await _onlineOrderService.UpdateStatusAsync(
                order.Id, OrderStatus.Pending, OrderStatusChangeSource.System,
                "Rapprochement automatique du catalogue", ct);
            ordersResolved++;
        }

        return new OrderRematchResultDto(conflicted.Count, ordersResolved, itemsMatched, itemsStillUnresolved);
    }

    public async Task<OrderBackfillResultDto> BackfillMissingLineItemsAsync(CancellationToken ct = default)
    {
        if (_shopifyClient is null) return new OrderBackfillResultDto(0, 0, 0);

        var brokenOrders = (await _unitOfWork.OnlineOrders.GetConflictsAsync(ct))
            .Where(o => o.Items.Count == 0 && o.ShopifyOrderId.HasValue)
            .ToList();
        if (brokenOrders.Count == 0) return new OrderBackfillResultDto(0, 0, 0);

        _logger.LogInformation("Backfilling line items for {Count} conflicted orders with zero items", brokenOrders.Count);

        var wantedIds = brokenOrders.Select(o => o.ShopifyOrderId!.Value).ToHashSet();
        var allShopifyOrders = await _shopifyClient.GetAllOrdersAsync(ct);
        var byId = allShopifyOrders.Where(o => wantedIds.Contains(o.Id)).ToDictionary(o => o.Id);

        int rebuilt = 0, notFound = 0;
        foreach (var order in brokenOrders)
        {
            if (!byId.TryGetValue(order.ShopifyOrderId!.Value, out var shopifyOrder))
            {
                notFound++;
                continue;
            }

            foreach (var li in shopifyOrder.LineItems)
            {
                var variant = await FindLocalVariantByShopifyId(li.ProductId ?? 0, li.VariantId ?? 0, ct);
                var price = ParseShopifyDecimal(li.Price);

                order.Items.Add(new OnlineOrderItem
                {
                    ProductVariantId = variant?.Id,
                    ShopifyProductId = variant is null ? li.ProductId : null,
                    ShopifyVariantId = variant is null ? li.VariantId : null,
                    ShopifySku = variant is null ? li.Sku : null,
                    ProductNameSnapshot = variant?.Product?.Name ?? li.Title,
                    SkuSnapshot = variant?.Sku ?? li.Sku ?? string.Empty,
                    Quantity = li.Quantity,
                    UnitPrice = price,
                    DiscountAmount = 0,
                    LineTotal = price * li.Quantity,
                    QuantityReserved = 0,
                    QuantityFulfilled = 0
                });
            }
            rebuilt++;
        }

        await _unitOfWork.SaveChangesAsync(ct);
        _logger.LogInformation("Backfill complete: {Rebuilt} rebuilt, {NotFound} no longer found on Shopify", rebuilt, notFound);

        return new OrderBackfillResultDto(brokenOrders.Count, rebuilt, notFound);
    }

    // Tier 1: exact ShopifyVariantId match (highest confidence - the full-catalog import stamps
    // this onto the exact local variant). Tier 2: exact SKU match. Anything weaker (fuzzy title)
    // is deliberately not attempted here - a wrong auto-match on a COD order is worse than leaving
    // it for manual review.
    private async Task<ProductVariant?> MatchUnresolvedItemAsync(OnlineOrderItem item, CancellationToken ct)
    {
        if (item.ShopifyVariantId is long svid)
        {
            var byVariantId = (await _unitOfWork.FindAsync<ProductVariant>(v => v.ShopifyVariantId == svid, ct)).FirstOrDefault();
            if (byVariantId is not null) return byVariantId;
        }

        if (!string.IsNullOrWhiteSpace(item.ShopifySku))
        {
            var bySku = (await _unitOfWork.FindAsync<ProductVariant>(v => v.Sku == item.ShopifySku, ct)).FirstOrDefault();
            if (bySku is not null) return bySku;
        }

        return null;
    }

    public async Task<IReadOnlyList<ShopifyLocationDto>> GetLocationsAsync(CancellationToken ct = default)
    {
        if (_shopifyClient is null) return [];

        var response = await _shopifyClient.GetLocationsAsync(ct);
        if (response?.Locations is null) return [];

        return response.Locations.Select(l => new ShopifyLocationDto
        {
            Id = l.Id,
            Name = l.Name,
            City = l.City,
            Active = l.Active
        }).ToList();
    }

    // Shopify's REST API returns price strings formatted with a "." decimal separator regardless of shop locale;
    // decimal.TryParse without an explicit culture uses the server's culture (e.g. fr-MA uses ",") and silently fails.
    public static decimal ParseShopifyDecimal(string? value)
        => decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var result) ? result : 0m;

    // Links the order to an existing client (by Shopify customer id → phone → email) or creates a new one,
    // enriching the client's contact/address details when they were previously missing.
    private async Task<Client?> ResolveOrCreateClientAsync(
        long? shopifyCustomerId, string? name, string? normalizedPhone, string? email,
        string? city, string? addressLine, CancellationToken ct)
    {
        var normEmail = email?.Trim().ToLowerInvariant();

        Client? client = null;
        if (shopifyCustomerId is long scid)
            client = (await _unitOfWork.FindAsync<Client>(c => c.ShopifyCustomerId == scid, ct)).FirstOrDefault();
        if (client is null && normalizedPhone is not null)
            client = await _unitOfWork.Clients.GetByPhoneAsync(normalizedPhone, ct);
        if (client is null && normEmail is not null)
            client = await _unitOfWork.Clients.GetByEmailAsync(normEmail, ct);

        if (client is null)
        {
            // Only create a client when we have something to identify them by.
            if (normalizedPhone is null && normEmail is null && shopifyCustomerId is null) return null;

            client = new Client
            {
                Name = string.IsNullOrWhiteSpace(name) ? (normEmail ?? normalizedPhone ?? "Client Shopify") : name.Trim(),
                Phone = normalizedPhone ?? string.Empty,
                Email = normEmail,
                City = Trim(city, 120),
                AddressLine = Trim(addressLine, 400),
                QrCode = $"SMS-{Guid.NewGuid():N}"[..20].ToUpperInvariant(),
                ShopifyCustomerId = shopifyCustomerId,
                LoyaltyRate = 5,
                CreatedAt = DateTime.UtcNow
            };
            await _unitOfWork.Clients.AddAsync(client, ct);
            await _unitOfWork.SaveChangesAsync(ct); // within the current transaction, to populate client.Id
            return client;
        }

        // Enrich an existing client with any details we now have but they were missing.
        var changed = false;
        if (client.ShopifyCustomerId is null && shopifyCustomerId is not null) { client.ShopifyCustomerId = shopifyCustomerId; changed = true; }
        if (string.IsNullOrWhiteSpace(client.Phone) && normalizedPhone is not null) { client.Phone = normalizedPhone; changed = true; }
        if (string.IsNullOrWhiteSpace(client.Email) && normEmail is not null) { client.Email = normEmail; changed = true; }
        if (string.IsNullOrWhiteSpace(client.City) && !string.IsNullOrWhiteSpace(city)) { client.City = Trim(city, 120); changed = true; }
        if (string.IsNullOrWhiteSpace(client.AddressLine) && !string.IsNullOrWhiteSpace(addressLine)) { client.AddressLine = Trim(addressLine, 400); changed = true; }
        if (changed) await _unitOfWork.SaveChangesAsync(ct);

        return client;
    }

    private static string? NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        return digits.Length == 0 ? null : digits;
    }

    private static string? Trim(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var v = value.Trim();
        return v.Length <= max ? v : v[..max];
    }

    private async Task<ProductVariant?> FindLocalVariantByShopifyId(long shopifyProductId, long variantId, CancellationToken ct)
    {
        // Prefer a direct match: the full-catalog import stamps ShopifyVariantId onto the exact local variant.
        var directMatch = (await _unitOfWork.FindAsync<ProductVariant>(v => v.ShopifyVariantId == variantId, ct))
            .FirstOrDefault();
        if (directMatch is not null) return directMatch;

        // Fall back to the lightweight mapping table (product-level only — grabs the first variant of the product).
        var shopifyProduct = (await _unitOfWork.FindAsync<ShopifyProduct>(
            sp => sp.ShopifyProductId == shopifyProductId && sp.ShopifyVariantId == variantId, ct))
            .FirstOrDefault();

        if (shopifyProduct?.LocalProductId is not null)
        {
            var variants = await _unitOfWork.FindAsync<ProductVariant>(
                v => v.ProductId == shopifyProduct.LocalProductId.Value, ct);
            return variants.FirstOrDefault();
        }

        return null;
    }
}
