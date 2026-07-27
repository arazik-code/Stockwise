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
    private readonly IShopifyApiClient? _shopifyClient;
    private readonly ShopifyOptions _shopifyOptions;
    private readonly ILogger<ShopifySyncAppService> _logger;

    public ShopifySyncAppService(
        IUnitOfWork unitOfWork,
        IInventoryNotifier notifier,
        IOnlineOrderService onlineOrderService,
        IOptions<ShopifyOptions> shopifyOptions,
        ILogger<ShopifySyncAppService> logger,
        IShopifyApiClient? shopifyClient = null)
    {
        _unitOfWork = unitOfWork;
        _notifier = notifier;
        _onlineOrderService = onlineOrderService;
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

            var orderItems = new List<OnlineOrderItem>();
            foreach (var (lineItem, variant, stock) in mapped)
            {
                var reserve = allSufficient && stock is not null;
                if (reserve)
                {
                    stock!.QuantityReserved += lineItem.Quantity;
                    stock.LastUpdatedAt = DateTime.UtcNow;
                }

                orderItems.Add(new OnlineOrderItem
                {
                    ProductVariantId = variant!.Id,
                    ProductNameSnapshot = variant.Product?.Name ?? lineItem.Title,
                    SkuSnapshot = variant.Sku,
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
                    Price = ParseShopifyDecimal(li.Price)
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

        try
        {
            var products = await _shopifyClient.GetProductsAsync(limit: 50, ct: ct);
            if (products?.Products is null) return;

            if (!long.TryParse(_shopifyOptions.LocationId, out var locationId))
            {
                _logger.LogWarning("Shopify LocationId not configured, skipping inventory push");
                return;
            }

            foreach (var shopifyProduct in products.Products)
            {
                foreach (var variant in shopifyProduct.Variants)
                {
                    var localProducts = await _unitOfWork.FindAsync<ShopifyProduct>(
                        sp => sp.ShopifyProductId == shopifyProduct.Id && sp.ShopifyVariantId == variant.Id,
                        ct);

                    var localProduct = localProducts.FirstOrDefault();
                    if (localProduct?.LocalProductId is null) continue;

                    var variants = await _unitOfWork.FindAsync<ProductVariant>(
                        v => v.ProductId == localProduct.LocalProductId.Value, ct);
                    var productVariant = variants.FirstOrDefault();
                    if (productVariant is null) continue;

                    var stockItem = await _unitOfWork.Stock.GetByVariantIdAsync(productVariant.Id, ct);
                    if (stockItem is not null && variant.InventoryItemId > 0)
                    {
                        await _shopifyClient.UpdateInventoryLevelAsync(
                            variant.InventoryItemId, locationId, stockItem.QuantityOnHand, ct);
                    }
                }
            }

            _logger.LogInformation("Inventory sync with Shopify completed");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to sync inventory levels with Shopify");
        }
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
