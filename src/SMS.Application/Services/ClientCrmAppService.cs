using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SMS.Application.DTOs.Crm;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class ClientCrmAppService : IClientCrmService
{
    private const int ImportBatchSize = 50;
    private static readonly OrderStatus[] ExcludedOnlineStatuses = [OrderStatus.Cancelled, OrderStatus.InventoryConflict];

    private readonly IUnitOfWork _unitOfWork;
    private readonly IShopifyApiClient? _shopifyClient;
    private readonly ILogger<ClientCrmAppService> _logger;

    public ClientCrmAppService(IUnitOfWork unitOfWork, ILogger<ClientCrmAppService> logger, IShopifyApiClient? shopifyClient = null)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
        _shopifyClient = shopifyClient;
    }

    private class ClientAggregate
    {
        public decimal TotalSpent;
        public int OrderCount;
        public DateTime? LastOrderAt;
        public readonly Dictionary<string, (decimal Amount, int Units)> CategoryTotals = new();
        public readonly HashSet<int> PurchasedProductIds = [];
    }

    public async Task<CrmDashboardDto> GetDashboardAsync(CancellationToken ct = default)
    {
        var summaries = await BuildSummariesAsync(null, ct);

        return new CrmDashboardDto(
            TotalClients: summaries.Count,
            TotalRevenue: summaries.Sum(s => s.TotalSpent),
            VipCount: summaries.Count(s => s.Segment == ClientSegment.Vip),
            AtRiskCount: summaries.Count(s => s.Segment == ClientSegment.AtRisk),
            LostCount: summaries.Count(s => s.Segment == ClientSegment.Lost),
            NewCount: summaries.Count(s => s.Segment == ClientSegment.New),
            Clients: summaries.OrderByDescending(s => s.TotalSpent).ToList());
    }

    public async Task<CrmAnalyticsDto> GetCrmAnalyticsAsync(CancellationToken ct = default)
    {
        var summaries = await BuildSummariesAsync(null, ct);

        var segments = Enum.GetValues<ClientSegment>()
            .Select(seg => new CrmSegmentCountDto(
                seg,
                summaries.Count(s => s.Segment == seg),
                summaries.Where(s => s.Segment == seg).Sum(s => s.TotalSpent)))
            .ToList();

        // Full geographic scatter — normalize casing/whitespace so "Casa"/"casa " collapse into one city.
        var cities = summaries
            .Where(s => !string.IsNullOrWhiteSpace(s.City))
            .GroupBy(s => NormalizeCity(s.City!))
            .Select(g => new CrmCityStatDto(g.First().City!.Trim(), g.Count(), g.Sum(s => s.TotalSpent)))
            .OrderByDescending(c => c.ClientCount)
            .ThenByDescending(c => c.Revenue)
            .ToList();

        var (topProducts, topCategories) = await BuildTopProductsAndCategoriesAsync(ct);

        var clientsWithOrders = summaries.Count(s => s.OrderCount > 0);
        var totalRevenue = summaries.Sum(s => s.TotalSpent);
        var totalOrders = summaries.Sum(s => s.OrderCount);
        var repeatClients = summaries.Count(s => s.OrderCount >= 2);

        return new CrmAnalyticsDto(
            TotalClients: summaries.Count,
            ClientsWithOrders: clientsWithOrders,
            TotalRevenue: totalRevenue,
            AvgClientValue: clientsWithOrders > 0 ? Math.Round(totalRevenue / clientsWithOrders, 2) : 0,
            ShopifyImportedCount: summaries.Count(s => s.IsShopifyImported),
            AvgOrderValue: totalOrders > 0 ? Math.Round(totalRevenue / totalOrders, 2) : 0,
            TotalOrders: totalOrders,
            RepeatClients: repeatClients,
            RepeatRate: clientsWithOrders > 0 ? Math.Round((decimal)repeatClients / clientsWithOrders * 100, 1) : 0,
            ClientsWithCity: summaries.Count(s => !string.IsNullOrWhiteSpace(s.City)),
            DistinctCities: cities.Count,
            Segments: segments,
            Cities: cities,
            TopProducts: topProducts,
            TopCategories: topCategories,
            TopClients: summaries.OrderByDescending(s => s.TotalSpent).Take(10).ToList());
    }

    private static string NormalizeCity(string city)
        => city.Trim().ToLowerInvariant();

    private async Task<(List<CrmTopProductDto> Products, List<CrmTopCategoryDto> Categories)> BuildTopProductsAndCategoriesAsync(CancellationToken ct)
    {
        // Units + revenue per product across POS sales and (non-cancelled) online orders.
        var saleProductRows = await _unitOfWork.Set<SaleItem>()
            .GroupBy(si => si.ProductVariant.ProductId)
            .Select(g => new { ProductId = g.Key, Units = g.Sum(si => si.Quantity), Revenue = g.Sum(si => si.LineTotal) })
            .ToListAsync(ct);

        var onlineProductRows = await _unitOfWork.Set<OnlineOrderItem>()
            .Where(i => !ExcludedOnlineStatuses.Contains(i.OnlineOrder.Status))
            .GroupBy(i => i.ProductVariant.ProductId)
            .Select(g => new { ProductId = g.Key, Units = g.Sum(i => i.Quantity), Revenue = g.Sum(i => i.LineTotal) })
            .ToListAsync(ct);

        var productAgg = new Dictionary<int, (int Units, decimal Revenue)>();
        foreach (var r in saleProductRows.Concat(onlineProductRows))
        {
            var cur = productAgg.GetValueOrDefault(r.ProductId);
            productAgg[r.ProductId] = (cur.Units + r.Units, cur.Revenue + r.Revenue);
        }

        var topProductIds = productAgg.OrderByDescending(kv => kv.Value.Revenue).Take(10).Select(kv => kv.Key).ToList();
        var productMeta = await _unitOfWork.Set<Product>()
            .Where(p => topProductIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, p.ImageUrl, CategoryName = p.Category.Name })
            .ToListAsync(ct);
        var productMetaById = productMeta.ToDictionary(p => p.Id);

        var topProducts = topProductIds
            .Where(productMetaById.ContainsKey)
            .Select(id => new CrmTopProductDto(
                id, productMetaById[id].Name, productMetaById[id].ImageUrl, productMetaById[id].CategoryName,
                productAgg[id].Units, productAgg[id].Revenue))
            .ToList();

        // Units + revenue + distinct buyers per category.
        var saleCatRows = await _unitOfWork.Set<SaleItem>()
            .Where(si => si.Sale.ClientId != null)
            .Select(si => new { Category = si.ProductVariant.Product.Category.Name, si.Quantity, si.LineTotal, ClientId = si.Sale.ClientId!.Value })
            .ToListAsync(ct);

        var onlineCatRows = await _unitOfWork.Set<OnlineOrderItem>()
            .Where(i => i.OnlineOrder.ClientId != null && !ExcludedOnlineStatuses.Contains(i.OnlineOrder.Status))
            .Select(i => new { Category = i.ProductVariant.Product.Category.Name, i.Quantity, i.LineTotal, ClientId = i.OnlineOrder.ClientId!.Value })
            .ToListAsync(ct);

        var catAgg = new Dictionary<string, (int Units, decimal Revenue, HashSet<int> Buyers)>();
        foreach (var r in saleCatRows.Concat(onlineCatRows))
        {
            if (!catAgg.TryGetValue(r.Category, out var cur))
                cur = (0, 0m, []);
            cur.Buyers.Add(r.ClientId);
            catAgg[r.Category] = (cur.Units + r.Quantity, cur.Revenue + r.LineTotal, cur.Buyers);
        }

        var topCategories = catAgg
            .Select(kv => new CrmTopCategoryDto(kv.Key, kv.Value.Units, kv.Value.Revenue, kv.Value.Buyers.Count))
            .OrderByDescending(c => c.Revenue)
            .Take(10)
            .ToList();

        return (topProducts, topCategories);
    }

    public async Task<ClientAnalyticsDto?> GetClientAnalyticsAsync(int clientId, CancellationToken ct = default)
    {
        var summaries = await BuildSummariesAsync(clientId, ct);
        var summary = summaries.FirstOrDefault(s => s.Id == clientId);
        if (summary is null) return null;

        var aggregate = _lastAggregates[clientId];

        var categoryBreakdown = aggregate.CategoryTotals
            .Select(kv => new CategoryBreakdownItemDto(kv.Key, kv.Value.Amount, kv.Value.Units))
            .OrderByDescending(c => c.AmountSpent)
            .ToList();

        var purchaseHistory = await BuildPurchaseHistoryAsync(clientId, ct);
        var recommendations = await BuildRecommendationsAsync(categoryBreakdown, aggregate.PurchasedProductIds, ct);

        return new ClientAnalyticsDto(summary, purchaseHistory, categoryBreakdown, recommendations);
    }

    // Keyed cache of the last aggregate computation so GetClientAnalyticsAsync can reuse category/product
    // data without re-running the aggregate query a second time in the same call.
    private Dictionary<int, ClientAggregate> _lastAggregates = new();

    private async Task<List<ClientCrmSummaryDto>> BuildSummariesAsync(int? onlyClientId, CancellationToken ct)
    {
        var clientsQuery = _unitOfWork.Set<Client>().AsQueryable();
        if (onlyClientId.HasValue) clientsQuery = clientsQuery.Where(c => c.Id == onlyClientId.Value);

        var clients = await clientsQuery
            .Select(c => new
            {
                c.Id, c.Name, c.Phone, c.Email, c.Tags, c.ShopifyCustomerId, c.CreatedAt,
                c.City, c.AddressLine, c.ShopifyTotalSpent, c.ShopifyOrdersCount
            })
            .ToListAsync(ct);

        var aggregates = clients.ToDictionary(c => c.Id, _ => new ClientAggregate());

        var saleQuery = _unitOfWork.Set<Sale>().Where(s => s.ClientId != null);
        if (onlyClientId.HasValue) saleQuery = saleQuery.Where(s => s.ClientId == onlyClientId.Value);

        var saleAgg = await saleQuery
            .GroupBy(s => s.ClientId!.Value)
            .Select(g => new { ClientId = g.Key, Spent = g.Sum(s => s.TotalAmount), Orders = g.Count(), Last = g.Max(s => s.CreatedAt) })
            .ToListAsync(ct);

        foreach (var row in saleAgg)
        {
            if (!aggregates.TryGetValue(row.ClientId, out var agg)) continue;
            agg.TotalSpent += row.Spent;
            agg.OrderCount += row.Orders;
            if (agg.LastOrderAt is null || row.Last > agg.LastOrderAt) agg.LastOrderAt = row.Last;
        }

        var onlineQuery = _unitOfWork.Set<OnlineOrder>()
            .Where(o => o.ClientId != null && !ExcludedOnlineStatuses.Contains(o.Status));
        if (onlyClientId.HasValue) onlineQuery = onlineQuery.Where(o => o.ClientId == onlyClientId.Value);

        var onlineAgg = await onlineQuery
            .GroupBy(o => o.ClientId!.Value)
            .Select(g => new { ClientId = g.Key, Spent = g.Sum(o => o.TotalAmount), Orders = g.Count(), Last = g.Max(o => o.CreatedAt) })
            .ToListAsync(ct);

        foreach (var row in onlineAgg)
        {
            if (!aggregates.TryGetValue(row.ClientId, out var agg)) continue;
            agg.TotalSpent += row.Spent;
            agg.OrderCount += row.Orders;
            if (agg.LastOrderAt is null || row.Last > agg.LastOrderAt) agg.LastOrderAt = row.Last;
        }

        var saleCategoryQuery = _unitOfWork.Set<SaleItem>().Where(si => si.Sale.ClientId != null);
        if (onlyClientId.HasValue) saleCategoryQuery = saleCategoryQuery.Where(si => si.Sale.ClientId == onlyClientId.Value);

        var saleCategoryRows = await saleCategoryQuery
            .Select(si => new
            {
                ClientId = si.Sale.ClientId!.Value,
                CategoryName = si.ProductVariant.Product.Category.Name,
                si.ProductVariant.ProductId,
                si.LineTotal,
                si.Quantity
            })
            .ToListAsync(ct);

        foreach (var row in saleCategoryRows)
        {
            if (!aggregates.TryGetValue(row.ClientId, out var agg)) continue;
            agg.PurchasedProductIds.Add(row.ProductId);
            var current = agg.CategoryTotals.GetValueOrDefault(row.CategoryName);
            agg.CategoryTotals[row.CategoryName] = (current.Amount + row.LineTotal, current.Units + row.Quantity);
        }

        var onlineCategoryQuery = _unitOfWork.Set<OnlineOrderItem>()
            .Where(i => i.OnlineOrder.ClientId != null && !ExcludedOnlineStatuses.Contains(i.OnlineOrder.Status));
        if (onlyClientId.HasValue) onlineCategoryQuery = onlineCategoryQuery.Where(i => i.OnlineOrder.ClientId == onlyClientId.Value);

        var onlineCategoryRows = await onlineCategoryQuery
            .Select(i => new
            {
                ClientId = i.OnlineOrder.ClientId!.Value,
                CategoryName = i.ProductVariant.Product.Category.Name,
                i.ProductVariant.ProductId,
                i.LineTotal,
                i.Quantity
            })
            .ToListAsync(ct);

        foreach (var row in onlineCategoryRows)
        {
            if (!aggregates.TryGetValue(row.ClientId, out var agg)) continue;
            agg.PurchasedProductIds.Add(row.ProductId);
            var current = agg.CategoryTotals.GetValueOrDefault(row.CategoryName);
            agg.CategoryTotals[row.CategoryName] = (current.Amount + row.LineTotal, current.Units + row.Quantity);
        }

        _lastAggregates = aggregates;
        var now = DateTime.UtcNow;

        return clients.Select(c =>
        {
            var agg = aggregates[c.Id];
            var daysSinceLast = agg.LastOrderAt.HasValue ? (int)(now - agg.LastOrderAt.Value).TotalDays : (int?)null;
            var favoriteCategory = agg.CategoryTotals.Count == 0
                ? null
                : agg.CategoryTotals.OrderByDescending(kv => kv.Value.Amount).First().Key;

            // Prefer itemized order data; fall back to the client's authoritative Shopify lifetime figures
            // so a customer whose orders didn't import still segments by their real spend/order count.
            var effectiveSpent = agg.OrderCount > 0 ? agg.TotalSpent : (c.ShopifyTotalSpent ?? 0m);
            var effectiveOrders = agg.OrderCount > 0 ? agg.OrderCount : (c.ShopifyOrdersCount ?? 0);
            var segment = DetermineSegment(effectiveSpent, effectiveOrders, daysSinceLast, (now - c.CreatedAt).TotalDays);

            return new ClientCrmSummaryDto(
                c.Id, c.Name, c.Phone, c.Email, effectiveSpent, effectiveOrders,
                agg.LastOrderAt, daysSinceLast, segment, favoriteCategory, c.Tags,
                c.ShopifyCustomerId.HasValue, c.CreatedAt,
                c.City, c.AddressLine, c.ShopifyTotalSpent, c.ShopifyOrdersCount);
        }).ToList();
    }

    // Fixed-tier RFM-style segmentation, calibrated for a mid-priced footwear store (items ~450 DH,
    // long repurchase cycles): VIP = spent >= 2500 DH or 4+ orders; recency windows widened so a
    // customer isn't written off as "Lost" after a single season. Value tier (VIP) is honored before
    // recency so a high-value buyer surfaces as VIP rather than being buried in At-risk/Lost.
    private static ClientSegment DetermineSegment(decimal totalSpent, int orderCount, int? daysSinceLastOrder, double accountAgeDays)
    {
        if (orderCount == 0)
            return accountAgeDays <= 60 ? ClientSegment.New : ClientSegment.Lost;

        var isHighValue = totalSpent >= 2500 || orderCount >= 4;
        var days = daysSinceLastOrder ?? int.MaxValue;

        // Genuinely dormant across a full year — lost regardless of past value.
        if (days > 365)
            return ClientSegment.Lost;

        if (isHighValue)
            return ClientSegment.Vip;

        if (days > 180)
            return ClientSegment.AtRisk;

        if (orderCount <= 1 && accountAgeDays <= 60)
            return ClientSegment.New;

        return ClientSegment.Regular;
    }

    private async Task<List<ClientPurchaseHistoryItemDto>> BuildPurchaseHistoryAsync(int clientId, CancellationToken ct)
    {
        var salesHistory = await _unitOfWork.Set<SaleItem>()
            .Where(si => si.Sale.ClientId == clientId)
            .Select(si => new ClientPurchaseHistoryItemDto(
                si.Sale.CreatedAt, "Boutique", si.Sale.SaleNumber,
                si.ProductVariant.Product.Name, si.ProductVariant.Sku,
                si.ProductVariant.Color.Name, si.ProductVariant.Size.Value,
                si.Quantity, si.UnitPrice, si.LineTotal))
            .ToListAsync(ct);

        var onlineHistory = await _unitOfWork.Set<OnlineOrderItem>()
            .Where(i => i.OnlineOrder.ClientId == clientId && !ExcludedOnlineStatuses.Contains(i.OnlineOrder.Status))
            .Select(i => new ClientPurchaseHistoryItemDto(
                i.OnlineOrder.CreatedAt, "En ligne", i.OnlineOrder.OrderNumber,
                i.ProductVariant.Product.Name, i.ProductVariant.Sku,
                i.ProductVariant.Color.Name, i.ProductVariant.Size.Value,
                i.Quantity, i.UnitPrice, i.LineTotal))
            .ToListAsync(ct);

        return salesHistory.Concat(onlineHistory)
            .OrderByDescending(h => h.Date)
            .Take(200)
            .ToList();
    }

    private async Task<List<ProductRecommendationDto>> BuildRecommendationsAsync(
        List<CategoryBreakdownItemDto> categoryBreakdown, HashSet<int> purchasedProductIds, CancellationToken ct)
    {
        if (categoryBreakdown.Count == 0) return [];

        var topCategoryNames = categoryBreakdown.Take(2).Select(c => c.CategoryName).ToList();

        var candidateProducts = await _unitOfWork.Set<Product>()
            .Where(p => p.IsActive && topCategoryNames.Contains(p.Category.Name) && !purchasedProductIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, p.ImageUrl, p.Price, p.OnlinePrice, CategoryName = p.Category.Name })
            .ToListAsync(ct);

        if (candidateProducts.Count == 0) return [];

        var candidateIds = candidateProducts.Select(p => p.Id).ToList();

        var unitsSoldByProduct = await _unitOfWork.Set<SaleItem>()
            .Where(si => candidateIds.Contains(si.ProductVariant.ProductId))
            .GroupBy(si => si.ProductVariant.ProductId)
            .Select(g => new { ProductId = g.Key, Units = g.Sum(si => si.Quantity) })
            .ToListAsync(ct);

        var onlineUnitsSoldByProduct = await _unitOfWork.Set<OnlineOrderItem>()
            .Where(i => candidateIds.Contains(i.ProductVariant.ProductId) && !ExcludedOnlineStatuses.Contains(i.OnlineOrder.Status))
            .GroupBy(i => i.ProductVariant.ProductId)
            .Select(g => new { ProductId = g.Key, Units = g.Sum(i => i.Quantity) })
            .ToListAsync(ct);

        var popularity = new Dictionary<int, int>();
        foreach (var row in unitsSoldByProduct) popularity[row.ProductId] = popularity.GetValueOrDefault(row.ProductId) + row.Units;
        foreach (var row in onlineUnitsSoldByProduct) popularity[row.ProductId] = popularity.GetValueOrDefault(row.ProductId) + row.Units;

        return candidateProducts
            .OrderByDescending(p => popularity.GetValueOrDefault(p.Id))
            .Take(8)
            .Select(p => new ProductRecommendationDto(
                p.Id, p.Name, p.ImageUrl, p.OnlinePrice ?? p.Price, p.CategoryName,
                $"Populaire dans {p.CategoryName}"))
            .ToList();
    }

    public async Task<ShopifyClientImportResultDto> ImportClientsFromShopifyAsync(CancellationToken ct = default)
    {
        if (_shopifyClient is null)
            return new ShopifyClientImportResultDto(Configured: false);

        List<DTOs.Shopify.ShopifyCustomerItem> shopifyCustomers;
        try
        {
            shopifyCustomers = await _shopifyClient.GetAllCustomersAsync(ct);
        }
        catch (ShopifyCustomerAccessNotApprovedException ex)
        {
            _logger.LogInformation("Shopify customer import skipped: {Message}", ex.Message);
            return new ShopifyClientImportResultDto(Configured: true, Approved: false, Message: ex.Message);
        }

        var created = 0;
        var updated = 0;

        // Fetch all existing clients once (bounded local dataset) and match in memory — Shopify phone
        // numbers arrive in varied formats (spaces, +212 prefixes) that don't reliably map to a
        // server-translatable EF Core phone-equality query, so normalization has to happen in C#.
        var allExisting = await _unitOfWork.Set<Client>().ToListAsync(ct);
        var existingByShopifyId = allExisting.Where(c => c.ShopifyCustomerId.HasValue)
            .ToDictionary(c => c.ShopifyCustomerId!.Value);
        var existingByPhone = allExisting.Where(c => NormalizePhone(c.Phone) is not null)
            .GroupBy(c => NormalizePhone(c.Phone)!)
            .ToDictionary(g => g.Key, g => g.First());
        var existingByEmail = allExisting.Where(c => !string.IsNullOrWhiteSpace(c.Email))
            .GroupBy(c => c.Email!.Trim().ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.First());

        foreach (var batch in shopifyCustomers.Chunk(ImportBatchSize))
        {
            foreach (var sc in batch)
            {
                var name = $"{sc.FirstName} {sc.LastName}".Trim();
                if (string.IsNullOrWhiteSpace(name)) name = sc.Email ?? sc.Phone ?? $"Client Shopify #{sc.Id}";
                var phone = NormalizePhone(sc.Phone ?? sc.DefaultAddress?.Phone);
                var email = sc.Email?.Trim().ToLowerInvariant();
                var city = Trim(sc.DefaultAddress?.City, 120);
                var address = Trim(sc.DefaultAddress?.Address1, 400);
                var shopifySpent = ShopifySyncAppService.ParseShopifyDecimal(sc.TotalSpent);

                Client? client = existingByShopifyId.GetValueOrDefault(sc.Id);
                client ??= phone is not null ? existingByPhone.GetValueOrDefault(phone) : null;
                client ??= email is not null ? existingByEmail.GetValueOrDefault(email) : null;

                if (client is not null)
                {
                    client.ShopifyCustomerId = sc.Id;
                    client.Tags = sc.Tags;
                    if (string.IsNullOrWhiteSpace(client.Email) && email is not null) client.Email = email;
                    if (string.IsNullOrWhiteSpace(client.City) && city is not null) client.City = city;
                    if (string.IsNullOrWhiteSpace(client.AddressLine) && address is not null) client.AddressLine = address;
                    client.ShopifyTotalSpent = shopifySpent;
                    client.ShopifyOrdersCount = sc.OrdersCount;
                    updated++;
                }
                else
                {
                    client = new Client
                    {
                        Name = name,
                        Phone = phone ?? string.Empty,
                        Email = email,
                        City = city,
                        AddressLine = address,
                        QrCode = $"SMS-{Guid.NewGuid():N}"[..20].ToUpperInvariant(),
                        ShopifyCustomerId = sc.Id,
                        Tags = sc.Tags,
                        ShopifyTotalSpent = shopifySpent,
                        ShopifyOrdersCount = sc.OrdersCount,
                        TotalSpent = 0,
                        LoyaltyRate = 5,
                        CreatedAt = DateTime.UtcNow
                    };
                    await _unitOfWork.AddAsync(client, ct);
                    created++;
                }
            }

            await _unitOfWork.SaveChangesAsync(ct);
            _unitOfWork.ClearChangeTracker();
        }

        // With customers now in place (and stamped with ShopifyCustomerId), pull their full order
        // history so per-client purchase history, favorite categories and recommendations light up.
        var orderResult = await ImportOrdersFromShopifyAsync(ct);

        return new ShopifyClientImportResultDto(
            Configured: true, Approved: true, Created: created, Updated: updated, TotalFetched: shopifyCustomers.Count,
            OrdersImported: orderResult.Imported, OrdersFetched: orderResult.Fetched, OrderItemsMatched: orderResult.ItemsMatched);
    }

    private async Task<(int Fetched, int Imported, int ItemsMatched)> ImportOrdersFromShopifyAsync(CancellationToken ct)
    {
        if (_shopifyClient is null) return (0, 0, 0);

        List<DTOs.Shopify.ShopifyOrderItem> orders;
        try
        {
            orders = await _shopifyClient.GetAllOrdersAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch Shopify order history for CRM import");
            return (0, 0, 0);
        }

        // Build lookups once: Shopify customer id -> local client id, Shopify variant id -> local variant.
        var clientByShopifyId = await _unitOfWork.Set<Client>()
            .Where(c => c.ShopifyCustomerId != null)
            .Select(c => new { c.Id, c.ShopifyCustomerId })
            .ToDictionaryAsync(c => c.ShopifyCustomerId!.Value, c => c.Id, ct);

        var variantByShopifyId = await _unitOfWork.Set<ProductVariant>()
            .Where(v => v.ShopifyVariantId != null)
            .Select(v => new { v.Id, v.ShopifyVariantId, v.Sku, ProductName = v.Product.Name })
            .ToDictionaryAsync(v => v.ShopifyVariantId!.Value, v => v, ct);

        var imported = 0;
        var updatedDetails = 0;
        var itemsMatched = 0;
        // clientId -> (city, address, phone, orderDate) taken from the client's most recent order.
        var clientCityFromOrders = new Dictionary<int, (string City, string? Address, string? Phone, DateTime At)>();

        foreach (var batch in orders.Chunk(ImportBatchSize))
        {
            var batchIds = batch.Select(o => o.Id).ToList();
            // Load existing orders in this batch (tracked) so a re-run backfills detail fields
            // onto records created before those fields were captured, rather than skipping them.
            var existingInBatch = await _unitOfWork.Set<OnlineOrder>()
                .Where(o => o.ShopifyOrderId != null && batchIds.Contains(o.ShopifyOrderId.Value))
                .ToDictionaryAsync(o => o.ShopifyOrderId!.Value, ct);

            foreach (var so in batch)
            {
                var clientId = so.Customer is not null && clientByShopifyId.TryGetValue(so.Customer.Id, out var cid)
                    ? cid
                    : (int?)null;

                var cancelled = !string.IsNullOrWhiteSpace(so.CancelledAt);
                var total = ShopifySyncAppService.ParseShopifyDecimal(so.TotalPrice);
                var subtotal = so.SubtotalPrice is not null ? ShopifySyncAppService.ParseShopifyDecimal(so.SubtotalPrice) : total;
                var discount = so.TotalDiscounts is not null ? ShopifySyncAppService.ParseShopifyDecimal(so.TotalDiscounts) : 0m;
                var createdAt = DateTimeOffset.TryParse(so.CreatedAt, out var dto) ? dto.UtcDateTime : DateTime.UtcNow;

                // Prefer the shipping address (where the goods actually go), then billing, then the customer record.
                var addr = so.ShippingAddress ?? so.BillingAddress;
                var customerName = FirstNonBlank(
                    addr?.Name,
                    JoinName(addr?.FirstName, addr?.LastName),
                    JoinName(so.Customer?.FirstName, so.Customer?.LastName),
                    so.Email) ?? "Client Shopify";
                var customerPhone = FirstNonBlank(addr?.Phone, so.Customer?.Phone, so.Phone);
                var city = Trim(addr?.City, 100);
                var addressLine = Trim(JoinAddress(addr?.Address1, addr?.Address2), 500);

                if (clientId is not null && city is not null &&
                    (!clientCityFromOrders.TryGetValue(clientId.Value, out var cur) || cur.At < createdAt))
                    clientCityFromOrders[clientId.Value] = (city, addressLine, NormalizePhone(customerPhone), createdAt);

                // Already imported: backfill detail fields onto the existing record and move on.
                if (existingInBatch.TryGetValue(so.Id, out var existing))
                {
                    existing.CustomerName = Trim(customerName, 200)!;
                    existing.CustomerPhone = Trim(customerPhone, 30);
                    existing.City = city;
                    existing.AddressLine = addressLine;
                    if (existing.ClientId is null) existing.ClientId = clientId;
                    if (existing.DiscountAmount == 0) existing.DiscountAmount = discount;
                    if (existing.SubTotal == 0 || existing.SubTotal == existing.TotalAmount) existing.SubTotal = subtotal;
                    updatedDetails++;
                    continue;
                }

                var items = new List<OnlineOrderItem>();
                foreach (var li in so.LineItems)
                {
                    if (li.VariantId is null or 0 || !variantByShopifyId.TryGetValue(li.VariantId.Value, out var v)) continue;
                    var price = ShopifySyncAppService.ParseShopifyDecimal(li.Price);
                    items.Add(new OnlineOrderItem
                    {
                        ProductVariantId = v.Id,
                        ProductNameSnapshot = v.ProductName,
                        SkuSnapshot = v.Sku,
                        Quantity = li.Quantity,
                        UnitPrice = price,
                        DiscountAmount = 0,
                        LineTotal = price * li.Quantity,
                        QuantityReserved = 0,
                        QuantityFulfilled = li.Quantity
                    });
                    itemsMatched++;
                }

                var order = new OnlineOrder
                {
                    OrderNumber = Trim(so.Name, 50) ?? $"SH-{so.Id}",
                    Channel = OnlineOrderChannel.Shopify,
                    // Historical backfill: completed unless Shopify marked it cancelled. Cancelled orders are
                    // excluded from CRM spend/analytics by the same rule used elsewhere.
                    Status = cancelled ? OrderStatus.Cancelled : OrderStatus.Delivered,
                    PaymentStatus = string.Equals(so.FinancialStatus, "paid", StringComparison.OrdinalIgnoreCase)
                        ? OnlinePaymentStatus.Paid : OnlinePaymentStatus.Unpaid,
                    PaymentMethod = OnlinePaymentMethod.ShopifyCheckout,
                    ClientId = clientId,
                    CustomerName = Trim(customerName, 200)!,
                    CustomerPhone = Trim(customerPhone, 30),
                    CustomerEmail = so.Email,
                    AddressLine = addressLine,
                    City = city,
                    SubTotal = subtotal,
                    DiscountAmount = discount,
                    TotalAmount = total,
                    AmountPaid = total,
                    StockReserved = false,
                    ShopifyOrderId = so.Id,
                    CreatedAt = createdAt,
                    UpdatedAt = createdAt,
                    Items = items
                };

                await _unitOfWork.AddAsync(order, ct);
                imported++;
            }

            await _unitOfWork.SaveChangesAsync(ct);
            _unitOfWork.ClearChangeTracker();
        }

        _logger.LogInformation("Shopify order import: {Imported} new, {Updated} detail-backfilled, {Items} items matched",
            imported, updatedDetails, itemsMatched);

        // Enrich client records from their order shipping addresses — many customers have no
        // default_address on the customer object, so this is where most city/phone data comes from
        // (and it's what powers the CRM demographics).
        await EnrichClientsFromOrdersAsync(clientCityFromOrders, ct);

        return (orders.Count, imported, itemsMatched);
    }

    private async Task EnrichClientsFromOrdersAsync(
        Dictionary<int, (string City, string? Address, string? Phone, DateTime At)> updates, CancellationToken ct)
    {
        if (updates.Count == 0) return;

        foreach (var idBatch in updates.Keys.Chunk(200))
        {
            var ids = idBatch.ToList();
            var clients = await _unitOfWork.Set<Client>().Where(c => ids.Contains(c.Id)).ToListAsync(ct);
            foreach (var client in clients)
            {
                var u = updates[client.Id];
                if (string.IsNullOrWhiteSpace(client.City)) client.City = u.City;
                if (string.IsNullOrWhiteSpace(client.AddressLine) && u.Address is not null) client.AddressLine = u.Address;
                if (string.IsNullOrWhiteSpace(client.Phone) && u.Phone is not null) client.Phone = u.Phone;
            }
            await _unitOfWork.SaveChangesAsync(ct);
            _unitOfWork.ClearChangeTracker();
        }
    }

    private static string? FirstNonBlank(params string?[] values)
        => values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim();

    private static string? JoinName(string? first, string? last)
    {
        var name = $"{first} {last}".Trim();
        return string.IsNullOrWhiteSpace(name) ? null : name;
    }

    private static string? JoinAddress(string? a1, string? a2)
    {
        var addr = string.Join(", ", new[] { a1, a2 }.Where(s => !string.IsNullOrWhiteSpace(s)));
        return string.IsNullOrWhiteSpace(addr) ? null : addr;
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
}
