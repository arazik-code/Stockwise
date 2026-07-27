using Microsoft.Extensions.Options;
using SMS.Application.DTOs;
using SMS.Application.DTOs.Online;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Exceptions;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class OnlineOrderAppService : IOnlineOrderService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IInventoryNotifier _notifier;
    private readonly LoyaltySettings _loyaltySettings;

    public OnlineOrderAppService(IUnitOfWork unitOfWork, IInventoryNotifier notifier, IOptions<LoyaltySettings> loyaltySettings)
    {
        _unitOfWork = unitOfWork;
        _notifier = notifier;
        _loyaltySettings = loyaltySettings.Value;
    }

    public async Task<OnlineOrderDto> CreateManualOrderAsync(CreateManualOrderRequest request, int? userId, CancellationToken ct = default)
    {
        if (request.Items.Count == 0)
            throw new ArgumentException("Order must have at least one item");

        await _unitOfWork.BeginTransactionAsync(ct);
        try
        {
            var client = await ResolveOrCreateClientAsync(request, ct);

            var orderItems = new List<OnlineOrderItem>();

            foreach (var itemRequest in request.Items)
            {
                var stockItem = await _unitOfWork.Stock.GetByVariantIdAsync(itemRequest.ProductVariantId, ct)
                    ?? throw new KeyNotFoundException($"Product variant {itemRequest.ProductVariantId} not found");

                if (stockItem.QuantityAvailable < itemRequest.Quantity)
                    throw new InsufficientStockException(itemRequest.ProductVariantId, itemRequest.Quantity, stockItem.QuantityAvailable);

                stockItem.QuantityReserved += itemRequest.Quantity;
                stockItem.LastUpdatedAt = DateTime.UtcNow;

                var variant = stockItem.ProductVariant;
                var product = variant.Product!;
                var effectivePrice = itemRequest.UnitPriceOverride
                    ?? (variant.IsLiquidation && product.LiquidationPrice.HasValue
                        ? product.LiquidationPrice.Value
                        : product.OnlinePrice ?? product.Price);

                var lineTotal = (effectivePrice * itemRequest.Quantity) - itemRequest.DiscountAmount;

                orderItems.Add(new OnlineOrderItem
                {
                    ProductVariantId = itemRequest.ProductVariantId,
                    ProductNameSnapshot = product.Name,
                    SkuSnapshot = variant.Sku,
                    Quantity = itemRequest.Quantity,
                    UnitPrice = effectivePrice,
                    DiscountAmount = itemRequest.DiscountAmount,
                    LineTotal = lineTotal,
                    QuantityReserved = itemRequest.Quantity,
                    QuantityFulfilled = 0
                });
            }

            var subTotal = orderItems.Sum(i => i.LineTotal);

            var (loyaltyDiscount, pointsRedeemed) = ResolveLoyaltyRedemption(client, request.LoyaltyPointsToRedeem, subTotal);

            var totalAmount = subTotal - request.DiscountAmount - loyaltyDiscount + request.DeliveryFee;
            var orderNumber = await _unitOfWork.OnlineOrders.GenerateOrderNumberAsync(request.Channel, ct);

            var order = new OnlineOrder
            {
                OrderNumber = orderNumber,
                Channel = request.Channel,
                Status = OrderStatus.Pending,
                PaymentStatus = OnlinePaymentStatus.Unpaid,
                PaymentMethod = request.PaymentMethod,
                ClientId = client?.Id,
                CustomerName = request.CustomerName,
                CustomerPhone = request.CustomerPhone,
                CustomerEmail = request.CustomerEmail,
                AddressLine = request.AddressLine,
                City = request.City,
                DeliveryFee = request.DeliveryFee,
                SubTotal = subTotal,
                DiscountAmount = request.DiscountAmount,
                ShippingFee = request.DeliveryFee,
                TotalAmount = totalAmount,
                AmountPaid = 0,
                StockReserved = true,
                Notes = request.Notes,
                CreatedByUserId = userId,
                LoyaltyPointsRedeemed = pointsRedeemed,
                LoyaltyDiscountAmount = loyaltyDiscount,
                Items = orderItems
            };

            if (client is not null && pointsRedeemed > 0)
            {
                client.TotalPoints -= pointsRedeemed;
                _unitOfWork.Clients.AddTransaction(new LoyaltyTransaction
                {
                    ClientId = client.Id,
                    PointsChange = -pointsRedeemed,
                    Type = LoyaltyTransactionType.Redeem,
                    Description = $"Redeemed ${loyaltyDiscount:F2} discount on {orderNumber}",
                    BalanceAfter = client.TotalPoints
                });
            }

            await _unitOfWork.OnlineOrders.AddAsync(order, ct);
            await _unitOfWork.SaveChangesAsync(ct);
            await _unitOfWork.CommitTransactionAsync(ct);

            await _notifier.NotifyNewOnlineOrderAsync(order.Channel.ToString(), order.OrderNumber, order.TotalAmount, ct);

            var full = await _unitOfWork.OnlineOrders.GetByIdAsync(order.Id, ct);
            return MapToDto(full!);
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(ct);
            throw;
        }
    }

    private async Task<Client?> ResolveOrCreateClientAsync(CreateManualOrderRequest request, CancellationToken ct)
    {
        if (request.ClientId.HasValue)
            return await _unitOfWork.Clients.GetByIdAsync(request.ClientId.Value, ct);

        Client? client = null;
        if (!string.IsNullOrWhiteSpace(request.CustomerPhone))
            client = await _unitOfWork.Clients.GetByPhoneAsync(request.CustomerPhone, ct);
        if (client is null && !string.IsNullOrWhiteSpace(request.CustomerEmail))
            client = await _unitOfWork.Clients.GetByEmailAsync(request.CustomerEmail, ct);

        if (client is not null) return client;
        if (string.IsNullOrWhiteSpace(request.CustomerPhone) && string.IsNullOrWhiteSpace(request.CustomerEmail))
            return null;

        client = new Client
        {
            Name = request.CustomerName,
            Phone = request.CustomerPhone ?? string.Empty,
            Email = request.CustomerEmail,
            QrCode = $"SMS-{Guid.NewGuid():N}"[..20].ToUpperInvariant(),
            LoyaltyRate = _loyaltySettings.NewClientRate,
            CreatedAt = DateTime.UtcNow
        };
        await _unitOfWork.Clients.AddAsync(client, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        var welcomePoints = _loyaltySettings.WelcomePoints;
        client.TotalPoints = welcomePoints;
        client.LifetimePoints = welcomePoints;
        _unitOfWork.Clients.AddTransaction(new LoyaltyTransaction
        {
            ClientId = client.Id,
            PointsChange = welcomePoints,
            Type = LoyaltyTransactionType.Welcome,
            Description = "Welcome bonus",
            BalanceAfter = welcomePoints
        });

        return client;
    }

    private (decimal discount, int pointsRedeemed) ResolveLoyaltyRedemption(Client? client, int? pointsToRedeem, decimal subTotal)
    {
        if (client is null || pointsToRedeem is not > 0 || !_loyaltySettings.Enabled)
            return (0, 0);

        var maxRedeemable = client.TotalPoints;
        var pointsRedeemed = Math.Min(pointsToRedeem.Value, maxRedeemable);
        var discountUnits = pointsRedeemed / _loyaltySettings.PointsForRedemption;
        var discount = discountUnits * _loyaltySettings.DhPerRedemption;

        if (discount > subTotal)
        {
            discount = subTotal;
            pointsRedeemed = (int)(subTotal / _loyaltySettings.DhPerRedemption) * _loyaltySettings.PointsForRedemption;
        }

        return (discount, pointsRedeemed);
    }

    public async Task<IReadOnlyList<OnlineOrderDto>> GetAllAsync(OnlineOrderChannel? channel = null, OrderStatus? status = null, DateTime? from = null, DateTime? to = null, CancellationToken ct = default)
    {
        var orders = await _unitOfWork.OnlineOrders.GetAllAsync(channel, status, from, to, ct);
        return orders.Select(MapToDto).ToList();
    }

    public async Task<OnlineOrderDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var order = await _unitOfWork.OnlineOrders.GetByIdAsync(id, ct);
        return order is null ? null : MapToDto(order);
    }

    // Which statuses may legally transition to which. UpdateStatusAsync previously accepted any
    // status from any other (PUT {id}/status took the raw enum with no validation), so a client
    // could set Delivered -> Pending or similar nonsense with no guard at all. Processing is kept
    // alongside Pending as an equivalent "not yet actioned" state since the legacy Shopify path
    // still sets it. Same-status re-application is always a no-op, not an error.
    private static readonly Dictionary<OrderStatus, OrderStatus[]> LegalTransitions = new()
    {
        [OrderStatus.Pending] = [OrderStatus.Processing, OrderStatus.Confirmed, OrderStatus.Cancelled, OrderStatus.InventoryConflict],
        [OrderStatus.Processing] = [OrderStatus.Pending, OrderStatus.Confirmed, OrderStatus.Cancelled, OrderStatus.InventoryConflict],
        [OrderStatus.InventoryConflict] = [OrderStatus.Pending, OrderStatus.Confirmed, OrderStatus.Cancelled],
        // Shipped is reachable directly from Confirmed/Packing too, not just via ReadyToShip -
        // orders shipped through a manual carrier (AssignShippingAsync) don't necessarily pass
        // through the OzonExpress-flow-specific ReadyToShip step.
        [OrderStatus.Confirmed] = [OrderStatus.Packing, OrderStatus.ReadyToShip, OrderStatus.Shipped, OrderStatus.Cancelled],
        [OrderStatus.Packing] = [OrderStatus.ReadyToShip, OrderStatus.Shipped, OrderStatus.Cancelled],
        [OrderStatus.ReadyToShip] = [OrderStatus.Shipped, OrderStatus.Cancelled],
        [OrderStatus.Shipped] = [OrderStatus.Delivered, OrderStatus.Returned, OrderStatus.Refused, OrderStatus.Cancelled],
        [OrderStatus.Delivered] = [OrderStatus.Refunded],
        // A returned/refused parcel can be re-attempted (back to Pending) or written off.
        [OrderStatus.Returned] = [OrderStatus.Pending, OrderStatus.Cancelled],
        [OrderStatus.Refused] = [OrderStatus.Pending, OrderStatus.Cancelled],
        [OrderStatus.Cancelled] = [],
        [OrderStatus.Refunded] = [],
    };

    public async Task<OnlineOrderDto?> UpdateStatusAsync(int id, OrderStatus status, OrderStatusChangeSource source = OrderStatusChangeSource.Manual, string? reason = null, CancellationToken ct = default)
    {
        var order = await _unitOfWork.OnlineOrders.GetByIdAsync(id, ct);
        if (order is null) return null;

        var previousStatus = order.Status;
        if (previousStatus == status) return MapToDto(order);

        if (!LegalTransitions.TryGetValue(previousStatus, out var allowed) || !allowed.Contains(status))
        {
            throw new ArgumentException(
                $"Transition illegale : {previousStatus} -> {status} (commande #{order.OrderNumber})");
        }

        order.Status = status;
        order.UpdatedAt = DateTime.UtcNow;

        switch (status)
        {
            case OrderStatus.Confirmed:
                order.ConfirmedAt ??= DateTime.UtcNow;
                break;

            case OrderStatus.Shipped:
                if (order.StockReserved)
                    await CommitReservationToDeductionAsync(order, ct);
                order.ShippedAt ??= DateTime.UtcNow;
                break;

            case OrderStatus.Delivered:
                order.DeliveredAt ??= DateTime.UtcNow;
                if (order.LoyaltyPointsEarned == 0 && order.ClientId.HasValue && _loyaltySettings.Enabled)
                    await AwardLoyaltyAsync(order, ct);
                break;

            case OrderStatus.Cancelled:
                if (order.StockReserved)
                    await ReleaseReservationAsync(order, ct);
                else if (order.Items.Any(i => i.QuantityFulfilled > 0))
                    await RestockOrderAsync(order, ct);
                break;

            case OrderStatus.Returned:
            case OrderStatus.Refused:
                // Stock was deducted at Shipped time (StockReserved is false by then); a failed
                // delivery means those units physically came back to the shop.
                if (!order.StockReserved)
                    await RestockOrderAsync(order, ct);
                break;

            case OrderStatus.Refunded:
                // Was `if (!order.StockReserved)` only - refunding an order that was never shipped
                // (StockReserved still true) fell through this switch doing nothing, so the
                // reservation was never released and that stock stayed locked forever.
                if (order.StockReserved)
                    await ReleaseReservationAsync(order, ct);
                else
                    await RestockOrderAsync(order, ct);
                break;
        }

        _unitOfWork.OnlineOrders.Update(order);
        await _unitOfWork.AddAsync(new OrderStatusHistory
        {
            OnlineOrderId = order.Id,
            FromStatus = previousStatus,
            ToStatus = status,
            Source = source,
            Reason = reason
        }, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _notifier.NotifyOrderStatusChangedAsync(order.Id, status.ToString(), ct);

        return MapToDto(order);
    }

    public async Task<bool> CancelAsync(int id, string? reason, CancellationToken ct = default)
    {
        var order = await _unitOfWork.OnlineOrders.GetByIdAsync(id, ct);
        if (order is null) return false;
        if (order.Status is OrderStatus.Cancelled or OrderStatus.Delivered or OrderStatus.Refunded) return false;

        var previousStatus = order.Status;
        if (order.StockReserved)
            await ReleaseReservationAsync(order, ct);
        else if (order.Items.Any(i => i.QuantityFulfilled > 0))
            await RestockOrderAsync(order, ct);

        order.Status = OrderStatus.Cancelled;
        order.Notes = string.IsNullOrWhiteSpace(reason) ? order.Notes : $"{order.Notes}\nAnnulée: {reason}".Trim();
        order.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.OnlineOrders.Update(order);
        await _unitOfWork.AddAsync(new OrderStatusHistory
        {
            OnlineOrderId = order.Id,
            FromStatus = previousStatus,
            ToStatus = order.Status,
            Source = OrderStatusChangeSource.Manual,
            Reason = reason
        }, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        await _notifier.NotifyOrderStatusChangedAsync(order.Id, order.Status.ToString(), ct);
        return true;
    }

    public async Task<OnlineOrderDto?> MarkPaidAsync(int id, decimal? amountPaid, CancellationToken ct = default)
    {
        var order = await _unitOfWork.OnlineOrders.GetByIdAsync(id, ct);
        if (order is null) return null;

        order.AmountPaid = amountPaid ?? order.TotalAmount;
        order.PaymentStatus = order.AmountPaid >= order.TotalAmount ? OnlinePaymentStatus.Paid : OnlinePaymentStatus.Unpaid;
        order.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.OnlineOrders.Update(order);
        await _unitOfWork.SaveChangesAsync(ct);
        return MapToDto(order);
    }

    public async Task<OnlineOrderDto?> AssignShippingAsync(int id, AssignShippingRequest request, CancellationToken ct = default)
    {
        var order = await _unitOfWork.OnlineOrders.GetByIdAsync(id, ct);
        if (order is null) return null;

        order.CarrierName = request.CarrierName;
        order.TrackingNumber = request.TrackingNumber;
        if (request.DeliveryFee.HasValue)
        {
            order.DeliveryFee = request.DeliveryFee.Value;
            order.ShippingFee = request.DeliveryFee.Value;
            order.TotalAmount = order.SubTotal - order.DiscountAmount - order.LoyaltyDiscountAmount + order.ShippingFee;
        }
        order.ExpectedDeliveryDate = request.ExpectedDeliveryDate;
        order.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.OnlineOrders.Update(order);
        await _unitOfWork.SaveChangesAsync(ct);
        return MapToDto(order);
    }

    private async Task CommitReservationToDeductionAsync(OnlineOrder order, CancellationToken ct)
    {
        foreach (var item in order.Items)
        {
            var stockItem = await _unitOfWork.Stock.GetByVariantIdAsync(item.ProductVariantId, ct);
            if (stockItem is null) continue;

            var qty = item.QuantityReserved;
            stockItem.QuantityReserved -= qty;
            stockItem.QuantityOnHand -= qty;
            stockItem.LastUpdatedAt = DateTime.UtcNow;

            item.QuantityFulfilled = qty;
            item.QuantityReserved = 0;

            await _unitOfWork.Stock.AddMovementAsync(new StockMovement
            {
                ProductVariantId = item.ProductVariantId,
                Type = StockMovementType.OnlineSale,
                QuantityChange = -qty,
                QuantityAfter = stockItem.QuantityOnHand,
                Reference = $"Online-{order.OrderNumber}",
                UserId = order.CreatedByUserId
            }, ct);

            await _notifier.NotifyStockChangedAsync(item.ProductVariantId, stockItem.QuantityOnHand, ct);
            if (stockItem.QuantityOnHand <= stockItem.ReorderLevel)
                await _notifier.NotifyLowStockAsync(item.ProductVariantId, item.ProductNameSnapshot, stockItem.QuantityOnHand, ct);
        }

        order.StockReserved = false;
    }

    private async Task ReleaseReservationAsync(OnlineOrder order, CancellationToken ct)
    {
        foreach (var item in order.Items.Where(i => i.QuantityReserved > 0))
        {
            var stockItem = await _unitOfWork.Stock.GetByVariantIdAsync(item.ProductVariantId, ct);
            if (stockItem is null) continue;

            stockItem.QuantityReserved = Math.Max(0, stockItem.QuantityReserved - item.QuantityReserved);
            stockItem.LastUpdatedAt = DateTime.UtcNow;
            item.QuantityReserved = 0;
        }

        order.StockReserved = false;
    }

    private async Task RestockOrderAsync(OnlineOrder order, CancellationToken ct)
    {
        foreach (var item in order.Items.Where(i => i.QuantityFulfilled > 0))
        {
            var stockItem = await _unitOfWork.Stock.GetByVariantIdAsync(item.ProductVariantId, ct);
            if (stockItem is null) continue;

            var qty = item.QuantityFulfilled;
            stockItem.QuantityOnHand += qty;
            stockItem.LastUpdatedAt = DateTime.UtcNow;

            await _unitOfWork.Stock.AddMovementAsync(new StockMovement
            {
                ProductVariantId = item.ProductVariantId,
                Type = StockMovementType.Return,
                QuantityChange = qty,
                QuantityAfter = stockItem.QuantityOnHand,
                Reference = $"Online-Refund-{order.OrderNumber}"
            }, ct);

            await _notifier.NotifyStockChangedAsync(item.ProductVariantId, stockItem.QuantityOnHand, ct);
            item.QuantityFulfilled = 0;
        }
    }

    private async Task AwardLoyaltyAsync(OnlineOrder order, CancellationToken ct)
    {
        var client = await _unitOfWork.Clients.GetByIdAsync(order.ClientId!.Value, ct);
        if (client is null) return;

        var netAmount = order.SubTotal - order.DiscountAmount - order.LoyaltyDiscountAmount;
        var pointsEarned = (int)Math.Floor(netAmount * client.LoyaltyRate / 100);
        if (pointsEarned <= 0) return;

        client.TotalPoints += pointsEarned;
        client.LifetimePoints += pointsEarned;
        client.TotalSpent += netAmount;
        client.LastVisitAt = DateTime.UtcNow;

        _unitOfWork.Clients.AddTransaction(new LoyaltyTransaction
        {
            ClientId = client.Id,
            PointsChange = pointsEarned,
            Type = LoyaltyTransactionType.Earn,
            Description = $"Earned from {order.OrderNumber}",
            BalanceAfter = client.TotalPoints
        });

        order.LoyaltyPointsEarned = pointsEarned;
    }

    public async Task<IReadOnlyList<OnlineOrderDto>> GetConflictsAsync(CancellationToken ct = default)
    {
        var orders = await _unitOfWork.OnlineOrders.GetConflictsAsync(ct);
        return orders.Select(MapToDto).ToList();
    }

    public async Task<OnlineDashboardDto> GetDashboardAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var todayStart = now.Date;
        var weekStart = todayStart.AddDays(-7);
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var monthOrders = await _unitOfWork.OnlineOrders.GetAllAsync(from: monthStart, to: now.AddDays(1), ct: ct);
        var conflicts = await _unitOfWork.OnlineOrders.GetConflictsAsync(ct);

        var todayList = monthOrders.Where(o => o.CreatedAt >= todayStart).ToList();
        var weekList = monthOrders.Where(o => o.CreatedAt >= weekStart).ToList();

        var trend = Enumerable.Range(0, 7)
            .Select(offset => todayStart.AddDays(-6 + offset))
            .Select(day => new OrderTrendPointDto
            {
                Date = day.ToString("dd/MM"),
                Count = monthOrders.Count(o => o.CreatedAt.Date == day),
                Revenue = monthOrders.Where(o => o.CreatedAt.Date == day).Sum(o => o.TotalAmount)
            })
            .ToList();

        var channelBreakdown = monthOrders
            .GroupBy(o => o.Channel)
            .Select(g => new ChannelBreakdownPointDto { Channel = g.Key.ToString(), Count = g.Count(), Revenue = g.Sum(o => o.TotalAmount) })
            .ToList();

        return new OnlineDashboardDto
        {
            TodayOrders = todayList.Count,
            TodayRevenue = todayList.Sum(o => o.TotalAmount),
            PendingOrders = monthOrders.Count(o => o.Status is OrderStatus.Pending or OrderStatus.Processing or OrderStatus.Confirmed or OrderStatus.Packing or OrderStatus.ReadyToShip),
            ConflictCount = conflicts.Count,
            WeekOrders = weekList.Count,
            WeekRevenue = weekList.Sum(o => o.TotalAmount),
            MonthOrders = monthOrders.Count,
            MonthRevenue = monthOrders.Sum(o => o.TotalAmount),
            OrdersTrend = trend,
            ChannelBreakdown = channelBreakdown,
            RecentOrders = monthOrders.OrderByDescending(o => o.CreatedAt).Take(8).Select(MapToDto).ToList()
        };
    }

    public async Task<OnlineReportDto> GetReportAsync(DateTime from, DateTime to, CancellationToken ct = default)
    {
        var orders = await _unitOfWork.OnlineOrders.GetAllAsync(from: from, to: to, ct: ct);
        var list = orders.ToList();

        return new OnlineReportDto
        {
            From = from,
            To = to,
            TotalOrders = list.Count,
            TotalRevenue = list.Sum(o => o.TotalAmount),
            TotalDeliveryFees = list.Sum(o => o.DeliveryFee),
            CancelledCount = list.Count(o => o.Status == OrderStatus.Cancelled),
            ConflictCount = list.Count(o => o.Status == OrderStatus.InventoryConflict),
            ChannelBreakdown = list
                .GroupBy(o => o.Channel)
                .Select(g => new ChannelBreakdownPointDto { Channel = g.Key.ToString(), Count = g.Count(), Revenue = g.Sum(o => o.TotalAmount) })
                .ToList(),
            DailyRevenue = list
                .GroupBy(o => o.CreatedAt.Date)
                .Select(g => new OrderTrendPointDto { Date = g.Key.ToString("dd/MM"), Count = g.Count(), Revenue = g.Sum(o => o.TotalAmount) })
                .OrderBy(d => d.Date)
                .ToList()
        };
    }

    private static OnlineOrderDto MapToDto(OnlineOrder o) => new()
    {
        Id = o.Id,
        OrderNumber = o.OrderNumber,
        Channel = o.Channel,
        Status = o.Status,
        PaymentStatus = o.PaymentStatus,
        PaymentMethod = o.PaymentMethod,
        ClientId = o.ClientId,
        CustomerName = o.CustomerName,
        CustomerPhone = o.CustomerPhone,
        CustomerEmail = o.CustomerEmail,
        AddressLine = o.AddressLine,
        City = o.City,
        CarrierName = o.CarrierName,
        TrackingNumber = o.TrackingNumber,
        DeliveryFee = o.DeliveryFee,
        ExpectedDeliveryDate = o.ExpectedDeliveryDate,
        SubTotal = o.SubTotal,
        DiscountAmount = o.DiscountAmount,
        ShippingFee = o.ShippingFee,
        TotalAmount = o.TotalAmount,
        AmountPaid = o.AmountPaid,
        Notes = o.Notes,
        CreatedByUserName = o.CreatedByUser?.FullName,
        LoyaltyPointsEarned = o.LoyaltyPointsEarned,
        LoyaltyPointsRedeemed = o.LoyaltyPointsRedeemed,
        LoyaltyDiscountAmount = o.LoyaltyDiscountAmount,
        Items = o.Items.Select(i => new OnlineOrderItemDto
        {
            Id = i.Id,
            ProductVariantId = i.ProductVariantId,
            ProductName = i.ProductNameSnapshot,
            Sku = i.SkuSnapshot,
            ColorName = i.ProductVariant?.Color?.Name,
            SizeValue = i.ProductVariant?.Size?.Value,
            Quantity = i.Quantity,
            UnitPrice = i.UnitPrice,
            DiscountAmount = i.DiscountAmount,
            LineTotal = i.LineTotal,
            StockAvailable = i.ProductVariant?.StockItem?.QuantityAvailable ?? 0
        }).ToList(),
        CreatedAt = o.CreatedAt,
        ConfirmedAt = o.ConfirmedAt,
        ShippedAt = o.ShippedAt,
        DeliveredAt = o.DeliveredAt
    };
}
