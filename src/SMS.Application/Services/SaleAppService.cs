using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SMS.Application.DTOs;
using SMS.Application.DTOs.Shopify;
using SMS.Application.DTOs.Sales;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Exceptions;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class SaleAppService : ISaleService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IInventoryNotifier _notifier;
    private readonly IShopifyApiClient? _shopifyClient;
    private readonly ShopifyOptions _shopifyOptions;
    private readonly ILogger<SaleAppService> _logger;
    private readonly LoyaltySettings _loyaltySettings;
    private readonly IInventoryPushQueue _pushQueue;
    private readonly ILoyaltyRateResolver _loyaltyRateResolver;
    private readonly IClientLoyaltyCategoryService _categoryService;

    public SaleAppService(
        IUnitOfWork unitOfWork,
        IInventoryNotifier notifier,
        IOptions<ShopifyOptions> shopifyOptions,
        IOptions<LoyaltySettings> loyaltySettings,
        ILogger<SaleAppService> logger,
        IInventoryPushQueue pushQueue,
        ILoyaltyRateResolver loyaltyRateResolver,
        IClientLoyaltyCategoryService categoryService,
        IShopifyApiClient? shopifyClient = null)
    {
        _unitOfWork = unitOfWork;
        _notifier = notifier;
        _shopifyOptions = shopifyOptions.Value;
        _loyaltySettings = loyaltySettings.Value;
        _logger = logger;
        _pushQueue = pushQueue;
        _loyaltyRateResolver = loyaltyRateResolver;
        _categoryService = categoryService;
        _shopifyClient = shopifyClient;
    }

    public async Task<SaleDto> CreateSaleAsync(CreateSaleRequest request, int userId, CancellationToken ct = default)
    {
        if (request.Items.Count == 0)
            throw new ArgumentException("Sale must have at least one item");

        await _unitOfWork.BeginTransactionAsync(ct);

        try
        {
            var saleItems = new List<SaleItem>();
            var stockUpdates = new List<(int ProductVariantId, StockItem Stock, ProductVariant Variant, int PreviousQty)>();

            foreach (var itemRequest in request.Items)
            {
                var stockItem = await _unitOfWork.Stock.GetByVariantIdAsync(itemRequest.ProductVariantId, ct)
                    ?? throw new KeyNotFoundException($"Product variant {itemRequest.ProductVariantId} not found");

                if (stockItem.QuantityAvailable < itemRequest.Quantity)
                    throw new InsufficientStockException(itemRequest.ProductVariantId, itemRequest.Quantity, stockItem.QuantityAvailable);

                var previousQty = stockItem.QuantityOnHand;
                stockItem.QuantityOnHand -= itemRequest.Quantity;
                stockItem.LastUpdatedAt = DateTime.UtcNow;

                var variant = stockItem.ProductVariant;
                var effectivePrice = variant.Product!.LiquidationPrice.HasValue && variant.IsLiquidation
                    ? variant.Product.LiquidationPrice.Value
                    : variant.Product.Price;
                var lineTotal = (effectivePrice * itemRequest.Quantity) - itemRequest.DiscountAmount;

                saleItems.Add(new SaleItem
                {
                    ProductVariantId = itemRequest.ProductVariantId,
                    Quantity = itemRequest.Quantity,
                    UnitPrice = effectivePrice,
                    DiscountAmount = itemRequest.DiscountAmount,
                    LineTotal = lineTotal
                });

                stockUpdates.Add((itemRequest.ProductVariantId, stockItem, variant, previousQty));

                await _unitOfWork.Stock.AddMovementAsync(new StockMovement
                {
                    ProductVariantId = itemRequest.ProductVariantId,
                    Type = StockMovementType.Sale,
                    QuantityChange = -itemRequest.Quantity,
                    QuantityAfter = stockItem.QuantityOnHand,
                    UserId = userId
                }, ct);
            }

            var subTotal = saleItems.Sum(i => i.LineTotal);

            var loyaltyDiscount = 0m;
            var pointsRedeemed = 0;
            Client? client = null;

            if (request.ClientId.HasValue && _loyaltySettings.Enabled)
            {
                client = await _unitOfWork.Clients.GetByIdAsync(request.ClientId.Value, ct);
                if (client is not null && request.LoyaltyPointsToRedeem > 0)
                {
                    var maxRedeemable = client.TotalPoints;
                    pointsRedeemed = Math.Min(request.LoyaltyPointsToRedeem.Value, maxRedeemable);

                    var discountUnits = pointsRedeemed / _loyaltySettings.PointsForRedemption;
                    loyaltyDiscount = discountUnits * _loyaltySettings.DhPerRedemption;

                    if (loyaltyDiscount > subTotal)
                    {
                        loyaltyDiscount = subTotal;
                        pointsRedeemed = (int)(subTotal / _loyaltySettings.DhPerRedemption) * _loyaltySettings.PointsForRedemption;
                    }
                }
            }

            var discountedSubTotal = subTotal - loyaltyDiscount;
            var taxAmount = discountedSubTotal * request.TaxRate;
            var totalAmount = discountedSubTotal + taxAmount;
            var changeGiven = request.AmountPaid - totalAmount;

            var rate = client is not null ? _loyaltyRateResolver.GetRate(client, _loyaltySettings) : _loyaltySettings.NewClientRate;
            var pointsEarned = _loyaltySettings.Enabled
                ? (int)Math.Floor(discountedSubTotal * rate / 100)
                : 0;

            var saleNumber = await _unitOfWork.Sales.GenerateSaleNumberAsync(ct);

            var sale = new Sale
            {
                SaleNumber = saleNumber,
                Channel = SaleChannel.Local,
                Category = request.Category,
                PaymentMethod = request.PaymentMethod,
                SubTotal = subTotal,
                TaxAmount = taxAmount,
                DiscountAmount = saleItems.Sum(i => i.DiscountAmount),
                TotalAmount = totalAmount,
                AmountPaid = request.AmountPaid,
                ChangeGiven = changeGiven > 0 ? changeGiven : 0,
                Status = OrderStatus.Delivered,
                UserId = userId,
                ClientId = request.ClientId,
                LoyaltyPointsEarned = pointsEarned,
                LoyaltyPointsRedeemed = pointsRedeemed,
                LoyaltyDiscountAmount = loyaltyDiscount,
                Items = saleItems
            };

            await _unitOfWork.Sales.AddAsync(sale, ct);
            await _unitOfWork.SaveChangesAsync(ct);

            var receiptBarcode = _unitOfWork.Sales.GenerateReceiptBarcode(sale.Id);
            await _unitOfWork.AddAsync(receiptBarcode, ct);
            await _unitOfWork.SaveChangesAsync(ct);

            sale.ReceiptBarcodes = [receiptBarcode];

            if (client is not null)
            {
                // TotalSpent is no longer incremented here - RecategorizeAsync below recomputes it
                // authoritatively from the Sales/OnlineOrders tables (plus the Shopify lifetime total
                // when higher), which already reflects this sale since it was saved above.
                client.LastVisitAt = DateTime.UtcNow;

                if (pointsRedeemed > 0)
                {
                    client.TotalPoints -= pointsRedeemed;

                    _unitOfWork.LoyaltyTransactions.Add(new LoyaltyTransaction
                    {
                        ClientId = client.Id,
                        SaleId = sale.Id,
                        PointsChange = -pointsRedeemed,
                        Type = LoyaltyTransactionType.Redeem,
                        Description = $"Redeemed ${loyaltyDiscount:F2} discount on {saleNumber}",
                        BalanceAfter = client.TotalPoints
                    });
                }

                if (pointsEarned > 0)
                {
                    client.TotalPoints += pointsEarned;
                    client.LifetimePoints += pointsEarned;

                    _unitOfWork.LoyaltyTransactions.Add(new LoyaltyTransaction
                    {
                        ClientId = client.Id,
                        SaleId = sale.Id,
                        PointsChange = pointsEarned,
                        Type = LoyaltyTransactionType.Earn,
                        Description = $"Earned from {saleNumber}",
                        BalanceAfter = client.TotalPoints
                    });
                }

                await _categoryService.RecategorizeAsync(client, _loyaltySettings, ct);
                await _unitOfWork.SaveChangesAsync(ct);
            }

            await _unitOfWork.CommitTransactionAsync(ct);

            foreach (var (productVariantId, stock, variant, _) in stockUpdates)
            {
                await _notifier.NotifyStockChangedAsync(productVariantId, stock.QuantityOnHand, ct);

                if (stock.QuantityOnHand <= stock.ReorderLevel)
                {
                    await _notifier.NotifyLowStockAsync(productVariantId, variant.Product?.Name ?? "Unknown", stock.QuantityOnHand, ct);
                }
            }

            // Hand off to the background worker. Synchronous, cannot fail, cannot be cancelled by
            // this request finishing - unlike the previous fire-and-forget task, which captured this
            // request's DbContext/CancellationToken and therefore died silently on every sale.
            foreach (var (productVariantId, _, _, _) in stockUpdates)
            {
                _pushQueue.Enqueue(productVariantId);
            }

            return MapToDto(sale);
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(ct);
            throw;
        }
    }

    public async Task<IReadOnlyList<SaleDto>> GetAllAsync(CancellationToken ct = default)
    {
        var sales = await _unitOfWork.Sales.GetAllAsync(ct);
        return sales.Select(MapToDto).ToList();
    }

    public async Task<SaleDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var sale = await _unitOfWork.Sales.GetWithItemsAsync(id, ct);
        return sale is null ? null : MapToDto(sale);
    }

    public async Task<DailySalesReportDto> GetDailyReportAsync(DateTime? date = null, CancellationToken ct = default)
    {
        var targetDate = date ?? DateTime.UtcNow.Date;
        var from = targetDate;
        var to = targetDate.AddDays(1);

        var sales = await _unitOfWork.Sales.GetByDateRangeAsync(from, to, ct);

        return new DailySalesReportDto
        {
            Date = targetDate,
            TotalSales = sales.Count,
            TotalRevenue = sales.Sum(s => s.TotalAmount),
            TotalTax = sales.Sum(s => s.TaxAmount),
            CashSales = sales.Where(s => s.PaymentMethod == PaymentMethod.Cash).Sum(s => s.TotalAmount),
            CardSales = sales.Where(s => s.PaymentMethod == PaymentMethod.Card).Sum(s => s.TotalAmount),
            OnlineSales = sales.Where(s => s.PaymentMethod == PaymentMethod.Online).Sum(s => s.TotalAmount),
            TopProducts = sales
                .SelectMany(s => s.Items)
                .GroupBy(i => i.ProductVariantId)
                .Select(g => new TopProductDto
                {
                    ProductId = g.Key,
                    ProductName = g.First().ProductVariant?.Product?.Name ?? string.Empty,
                    QuantitySold = g.Sum(i => i.Quantity),
                    Revenue = g.Sum(i => i.LineTotal)
                })
                .OrderByDescending(p => p.QuantitySold)
                .Take(10)
                .ToList()
        };
    }

    public async Task<IReadOnlyList<SaleDto>> GetByDateRangeAsync(DateTime from, DateTime to, SaleChannel? channel = null, CancellationToken ct = default)
    {
        IReadOnlyList<Sale> sales;

        if (channel.HasValue)
        {
            var allByChannel = await _unitOfWork.Sales.GetByChannelAsync(channel.Value, ct);
            sales = allByChannel.Where(s => s.CreatedAt >= from && s.CreatedAt <= to).ToList();
        }
        else
        {
            sales = await _unitOfWork.Sales.GetByDateRangeAsync(from, to, ct);
        }

        return sales.Select(MapToDto).ToList();
    }

    public async Task<SalesReportDto> GetSalesReportAsync(DateTime from, DateTime to, int? fournisseurId = null, SaleCategory? category = null, CancellationToken ct = default)
    {
        var sales = await _unitOfWork.Sales.GetByDateRangeAsync(from, to, ct);
        var salesList = sales.ToList();

        // Filter by Fournisseur: keep only sales that have items from this Fournisseur's products
        if (fournisseurId.HasValue)
        {
            salesList = salesList
                .Where(s => s.Items.Any(i =>
                    i.ProductVariant?.Product?.FournisseurId == fournisseurId.Value))
                .ToList();
        }

        // Filter by Category
        if (category.HasValue)
        {
            salesList = salesList
                .Where(s => s.Category == category.Value)
                .ToList();
        }

        var allItems = salesList.SelectMany(s => s.Items).ToList();

        var totalRevenue = salesList.Sum(s => s.TotalAmount);
        var totalCost = allItems.Sum(i => (i.ProductVariant?.Product?.CostPrice ?? 0) * i.Quantity);
        var totalItemsSold = allItems.Sum(i => i.Quantity);

        var report = new SalesReportDto
        {
            From = from,
            To = to,
            TotalSales = salesList.Count,
            TotalItemsSold = totalItemsSold,
            TotalRevenue = totalRevenue,
            TotalCost = totalCost,
            TotalProfit = totalRevenue - totalCost,
            TotalTax = salesList.Sum(s => s.TaxAmount),
            TotalDiscount = salesList.Sum(s => s.DiscountAmount) + salesList.Sum(s => s.LoyaltyDiscountAmount),
            AverageOrderValue = salesList.Count > 0 ? totalRevenue / salesList.Count : 0,
            AverageItemsPerOrder = salesList.Count > 0 ? (decimal)totalItemsSold / salesList.Count : 0,

            PaymentBreakdown = new PaymentBreakdownDto
            {
                Cash = salesList.Where(s => s.PaymentMethod == PaymentMethod.Cash).Sum(s => s.TotalAmount),
                Card = salesList.Where(s => s.PaymentMethod == PaymentMethod.Card).Sum(s => s.TotalAmount),
                Online = salesList.Where(s => s.PaymentMethod == PaymentMethod.Online).Sum(s => s.TotalAmount),
                CashCount = salesList.Count(s => s.PaymentMethod == PaymentMethod.Cash),
                CardCount = salesList.Count(s => s.PaymentMethod == PaymentMethod.Card),
                OnlineCount = salesList.Count(s => s.PaymentMethod == PaymentMethod.Online)
            },

            ChannelBreakdown = new ChannelBreakdownDto
            {
                Local = salesList.Where(s => s.Channel == SaleChannel.Local).Sum(s => s.TotalAmount),
                Shopify = salesList.Where(s => s.Channel == SaleChannel.Shopify).Sum(s => s.TotalAmount),
                LocalCount = salesList.Count(s => s.Channel == SaleChannel.Local),
                ShopifyCount = salesList.Count(s => s.Channel == SaleChannel.Shopify)
            },

            CategoryBreakdown = salesList
                .GroupBy(s => s.Category)
                .Select(g => new CategoryBreakdownDto
                {
                    Category = g.Key,
                    Count = g.Count(),
                    Revenue = g.Sum(s => s.TotalAmount)
                })
                .OrderByDescending(c => c.Revenue)
                .ToList(),

            TopProducts = allItems
                .GroupBy(i => i.ProductVariantId)
                .Select(g =>
                {
                    var firstItem = g.First();
                    var productName = firstItem.ProductVariant?.Product?.Name ?? string.Empty;
                    var sku = firstItem.ProductVariant?.Sku ?? string.Empty;
                    var colorName = firstItem.ProductVariant?.Color?.Name ?? string.Empty;
                    var sizeValue = firstItem.ProductVariant?.Size?.Value ?? string.Empty;
                    var costPrice = firstItem.ProductVariant?.Product?.CostPrice ?? 0;
                    var qty = g.Sum(i => i.Quantity);
                    var revenue = g.Sum(i => i.LineTotal);
                    var cost = costPrice * qty;

                    return new TopProductReportDto
                    {
                        ProductVariantId = g.Key,
                        ProductName = productName,
                        Sku = sku,
                        ColorName = colorName,
                        SizeValue = sizeValue,
                        QuantitySold = qty,
                        Revenue = revenue,
                        Cost = cost,
                        Profit = revenue - cost,
                        AverageUnitPrice = qty > 0 ? revenue / qty : 0
                    };
                })
                .OrderByDescending(p => p.QuantitySold)
                .ToList(),

            DailyRevenue = salesList
                .GroupBy(s => s.CreatedAt.Date)
                .Select(g =>
                {
                    var dayItems = g.SelectMany(s => s.Items).ToList();
                    var dayRevenue = g.Sum(s => s.TotalAmount);
                    var dayCost = dayItems.Sum(i => (i.ProductVariant?.Product?.CostPrice ?? 0) * i.Quantity);
                    return new DailyRevenueDto
                    {
                        Date = g.Key,
                        SalesCount = g.Count(),
                        Revenue = dayRevenue,
                        Profit = dayRevenue - dayCost,
                        ItemsSold = dayItems.Sum(i => i.Quantity)
                    };
                })
                .OrderBy(d => d.Date)
                .ToList(),

            Sales = salesList.Select(MapToDto).ToList()
        };

        return report;
    }

    private static SaleDto MapToDto(Sale s) => new()
    {
        Id = s.Id,
        SaleNumber = s.SaleNumber,
        Channel = s.Channel,
        Category = s.Category,
        PaymentMethod = s.PaymentMethod,
        SubTotal = s.SubTotal,
        TaxAmount = s.TaxAmount,
        DiscountAmount = s.DiscountAmount,
        TotalAmount = s.TotalAmount,
        AmountPaid = s.AmountPaid,
        ChangeGiven = s.ChangeGiven,
        Status = s.Status,
        UserName = s.User?.FullName,
        ClientId = s.ClientId,
        ClientName = s.Client?.Name,
        LoyaltyPointsEarned = s.LoyaltyPointsEarned,
        LoyaltyPointsRedeemed = s.LoyaltyPointsRedeemed,
        LoyaltyDiscountAmount = s.LoyaltyDiscountAmount,
        Items = s.Items.Select(i => new SaleItemDto
        {
            Id = i.Id,
            SaleId = i.SaleId,
            ProductVariantId = i.ProductVariantId,
            ProductName = i.ProductVariant?.Product?.Name ?? string.Empty,
            VariantSku = i.ProductVariant?.Sku ?? string.Empty,
            VariantBarcode = i.ProductVariant?.Barcode,
            ColorName = i.ProductVariant?.Color?.Name ?? string.Empty,
            SizeValue = i.ProductVariant?.Size?.Value ?? string.Empty,
            Quantity = i.Quantity,
            UnitPrice = i.UnitPrice,
            CostPrice = i.ProductVariant?.Product?.CostPrice ?? 0,
            DiscountAmount = i.DiscountAmount,
            LineTotal = i.LineTotal
        }).ToList(),
        ReceiptBarcode = s.ReceiptBarcodes.FirstOrDefault()?.Barcode,
        CreatedAt = s.CreatedAt
    };

    public async Task VoidAsync(int id, CancellationToken ct = default)
    {
        var sale = await _unitOfWork.Sales.GetByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Sale {id} not found");

        sale.Status = OrderStatus.Cancelled;
        _unitOfWork.Sales.Update(sale);
        await _unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<int> VoidManyAsync(IEnumerable<int> ids, CancellationToken ct = default)
    {
        var idList = ids.ToList();
        var sales = await _unitOfWork.Sales.FindAsync(s => idList.Contains(s.Id), ct);
        foreach (var sale in sales)
        {
            sale.Status = OrderStatus.Cancelled;
            _unitOfWork.Sales.Update(sale);
        }
        await _unitOfWork.SaveChangesAsync(ct);
        return sales.Count;
    }
}
