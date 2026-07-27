using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;
using SMS.Application.Services;
using SMS.Infrastructure.Shopify;

namespace SMS.API.Endpoints;

public static class WebhookEndpoints
{
    // Shopify webhook payloads are snake_case JSON (e.g. total_price); our DTOs use PascalCase.
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    public static void MapWebhookEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/webhooks/shopify")
            .AllowAnonymous();

        group.MapPost("/orders-create", async (
            HttpRequest request,
            IShopifySyncService syncService,
            IOptions<ShopifyOptions> options,
            ILoggerFactory loggerFactory) =>
        {
            var logger = loggerFactory.CreateLogger("WebhookEndpoints");

            if (!await ShopifyWebhookValidator.VerifyAsync(request, options.Value.WebhookSecret))
            {
                logger.LogWarning("Invalid HMAC signature on orders-create webhook");
                return Results.Unauthorized();
            }

            var payload = await request.ReadFromJsonAsync<ShopifyOrderWebhookPayload>(JsonOptions);
            if (payload is null) return Results.BadRequest("Invalid payload");

            try
            {
                var lineItems = payload.LineItems.Select(li => new ShopifyLineItemDto
                {
                    ProductId = li.ProductId,
                    VariantId = li.VariantId,
                    Title = li.Title,
                    Quantity = li.Quantity,
                    Price = ShopifySyncAppService.ParseShopifyDecimal(li.Price),
                    Sku = string.IsNullOrWhiteSpace(li.Sku) ? null : li.Sku
                }).ToList();

                // Previously this webhook passed no phone/city/address/customerId at all - unlike
                // the polling path (ShopifySyncAppService.SyncRecentOrdersAsync), which parses all
                // four. Webhook-ingested orders therefore couldn't be shipped via OzonExpress
                // (requires phone+city) and never linked to a Shopify client. Also fixed: when
                // Customer is null, `Customer?.FirstName + " " + Customer?.LastName` evaluated to
                // a single space (not null), so downstream "is the name blank" checks saw a
                // non-empty string.
                var addr = payload.ShippingAddress ?? payload.BillingAddress;
                var customerName = new[]
                {
                    addr?.Name,
                    string.Join(" ", new[] { addr?.FirstName, addr?.LastName }.Where(s => !string.IsNullOrWhiteSpace(s))),
                    string.Join(" ", new[] { payload.Customer?.FirstName, payload.Customer?.LastName }.Where(s => !string.IsNullOrWhiteSpace(s))),
                }.FirstOrDefault(s => !string.IsNullOrWhiteSpace(s));
                var customerPhone = new[] { addr?.Phone, payload.Customer?.Phone, payload.Phone }
                    .FirstOrDefault(s => !string.IsNullOrWhiteSpace(s));
                var addressLine = string.Join(", ", new[] { addr?.Address1, addr?.Address2 }.Where(s => !string.IsNullOrWhiteSpace(s)));

                await syncService.ProcessOrderCreatedAsync(
                    payload.Id, payload.OrderNumber, payload.FinancialStatus,
                    payload.FulfillmentStatus,
                    ShopifySyncAppService.ParseShopifyDecimal(payload.TotalPrice),
                    payload.Currency, payload.Email,
                    string.IsNullOrWhiteSpace(customerName) ? null : customerName.Trim(),
                    lineItems, DateTimeOffset.Parse(payload.CreatedAt).UtcDateTime,
                    customerPhone: string.IsNullOrWhiteSpace(customerPhone) ? null : customerPhone.Trim(),
                    city: string.IsNullOrWhiteSpace(addr?.City) ? null : addr!.City!.Trim(),
                    addressLine: string.IsNullOrWhiteSpace(addressLine) ? null : addressLine,
                    shopifyCustomerId: payload.Customer?.Id);

                logger.LogInformation("Processed orders-create webhook for order {OrderId}", payload.Id);
                return Results.Ok();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to process orders-create webhook for order {OrderId}", payload.Id);
                return Results.StatusCode(500);
            }
        });

        group.MapPost("/orders-cancelled", async (
            HttpRequest request,
            IShopifySyncService syncService,
            IOptions<ShopifyOptions> options,
            ILoggerFactory loggerFactory) =>
        {
            var logger = loggerFactory.CreateLogger("WebhookEndpoints");

            if (!await ShopifyWebhookValidator.VerifyAsync(request, options.Value.WebhookSecret))
                return Results.Unauthorized();

            var payload = await request.ReadFromJsonAsync<ShopifyOrderWebhookPayload>(JsonOptions);
            if (payload is null) return Results.BadRequest();

            try
            {
                await syncService.ProcessOrderCancelledAsync(payload.Id);
                logger.LogInformation("Processed orders-cancelled webhook for order {OrderId}", payload.Id);
                return Results.Ok();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to process orders-cancelled webhook");
                return Results.StatusCode(500);
            }
        });

        group.MapPost("/products-update", async (
            HttpRequest request,
            IOptions<ShopifyOptions> options,
            ILoggerFactory loggerFactory) =>
        {
            var logger = loggerFactory.CreateLogger("WebhookEndpoints");

            if (!await ShopifyWebhookValidator.VerifyAsync(request, options.Value.WebhookSecret))
                return Results.Unauthorized();

            var payload = await request.ReadFromJsonAsync<ShopifyProductWebhookPayload>(JsonOptions);
            if (payload is null) return Results.BadRequest();

            logger.LogInformation("Processed products-update webhook for product {ProductId}", payload.Id);
            return Results.Ok();
        });

        group.MapPost("/inventory-levels-update", async (
            HttpRequest request,
            IOptions<ShopifyOptions> options,
            ILoggerFactory loggerFactory) =>
        {
            var logger = loggerFactory.CreateLogger("WebhookEndpoints");

            if (!await ShopifyWebhookValidator.VerifyAsync(request, options.Value.WebhookSecret))
                return Results.Unauthorized();

            var payload = await request.ReadFromJsonAsync<ShopifyInventoryLevelWebhookPayload>(JsonOptions);
            if (payload is null) return Results.BadRequest();

            logger.LogInformation("Processed inventory-levels-update webhook for inventory item {InventoryItemId}",
                payload.InventoryItemId);
            return Results.Ok();
        });
    }
}

public class ShopifyOrderWebhookPayload
{
    public long Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string FinancialStatus { get; set; } = string.Empty;
    public string FulfillmentStatus { get; set; } = string.Empty;
    public string TotalPrice { get; set; } = "0";
    public string Currency { get; set; } = "USD";
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public ShopifyCustomer? Customer { get; set; }
    public ShopifyOrderAddressPayload? ShippingAddress { get; set; }
    public ShopifyOrderAddressPayload? BillingAddress { get; set; }
    public List<ShopifyLineItemPayload> LineItems { get; set; } = [];
    public string CreatedAt { get; set; } = string.Empty;
}

public class ShopifyCustomer
{
    public long Id { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
}

public class ShopifyOrderAddressPayload
{
    public string? Name { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
    public string? Address1 { get; set; }
    public string? Address2 { get; set; }
    public string? City { get; set; }
}

public class ShopifyLineItemPayload
{
    public long ProductId { get; set; }
    public long VariantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Price { get; set; } = "0";
    public string? Sku { get; set; }
}

public class ShopifyProductWebhookPayload
{
    public long Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? BodyHtml { get; set; }
    public string Vendor { get; set; } = string.Empty;
    public string ProductType { get; set; } = string.Empty;
    public List<ShopifyLineItemPayload> Variants { get; set; } = [];
}

public class ShopifyInventoryLevelWebhookPayload
{
    public long InventoryItemId { get; set; }
    public long LocationId { get; set; }
    public int Available { get; set; }
}
