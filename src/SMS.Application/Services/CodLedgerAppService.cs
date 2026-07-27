using Microsoft.EntityFrameworkCore;
using SMS.Application.DTOs.Finance;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class CodLedgerAppService : ICodLedgerService
{
    private readonly IUnitOfWork _unitOfWork;

    public CodLedgerAppService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task PostDeliveryOutcomeAsync(int onlineOrderId, int ozonParcelId, CodLedgerEntryType outcomeFeeType, decimal codAmount, decimal? courierFee, CancellationToken ct = default)
    {
        var order = await _unitOfWork.Set<OnlineOrder>().FirstOrDefaultAsync(o => o.Id == onlineOrderId, ct);
        if (order is null) return;

        var now = DateTime.UtcNow;

        if (outcomeFeeType == CodLedgerEntryType.CourierFeeDelivered)
        {
            // Cash actually changes hands only on a real delivery - Returned/Refused never collect
            // anything from the customer, only the courier's handling fee applies.
            await _unitOfWork.AddAsync(new CodLedgerEntry
            {
                OnlineOrderId = onlineOrderId, OzonParcelId = ozonParcelId,
                Type = CodLedgerEntryType.CodExpected, Amount = codAmount, Source = "Courier", OccurredAt = now
            }, ct);
            await _unitOfWork.AddAsync(new CodLedgerEntry
            {
                OnlineOrderId = onlineOrderId, OzonParcelId = ozonParcelId,
                Type = CodLedgerEntryType.CodCollected, Amount = codAmount, Source = "Courier", OccurredAt = now
            }, ct);
        }

        if (courierFee is decimal fee && fee != 0)
        {
            await _unitOfWork.AddAsync(new CodLedgerEntry
            {
                OnlineOrderId = onlineOrderId, OzonParcelId = ozonParcelId,
                Type = outcomeFeeType, Amount = -Math.Abs(fee), Source = "Courier", OccurredAt = now
            }, ct);
        }

        order.SettlementStatus = CodSettlementStatus.Pending;
        await _unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<CodFinanceDashboardDto> GetDashboardAsync(CancellationToken ct = default)
    {
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        // Outstanding = orders whose parcel already resolved (Delivered/Returned/Refused) but
        // haven't been matched to a courier remittance yet.
        var outstandingOrders = await _unitOfWork.Set<OnlineOrder>()
            .Where(o => o.SettlementStatus == CodSettlementStatus.Pending)
            .Select(o => new { o.Id, o.OrderNumber, o.TrackingNumber, o.CustomerName, o.TotalAmount, o.DeliveredAt })
            .ToListAsync(ct);

        var monthEntries = await _unitOfWork.Set<CodLedgerEntry>()
            .Where(e => e.OccurredAt >= monthStart)
            .ToListAsync(ct);

        var collectedThisMonth = monthEntries.Where(e => e.Type == CodLedgerEntryType.CodCollected).Sum(e => e.Amount);
        var feesThisMonth = monthEntries.Where(e =>
                e.Type is CodLedgerEntryType.CourierFeeDelivered or CodLedgerEntryType.CourierFeeReturned or CodLedgerEntryType.CourierFeeRefused)
            .Sum(e => e.Amount); // already negative

        var now = DateTime.UtcNow;
        var aging = new[]
        {
            ("0-7 jours", 0, 7), ("8-14 jours", 8, 14), ("15-30 jours", 15, 30), ("30+ jours", 31, int.MaxValue)
        }.Select(b =>
        {
            var (label, min, max) = b;
            var bucket = outstandingOrders.Where(o =>
            {
                var days = (now - (o.DeliveredAt ?? now)).Days;
                return days >= min && days <= max;
            }).ToList();
            return new CodAgingBucketDto(label, bucket.Count, bucket.Sum(o => o.TotalAmount));
        }).ToList();

        var unreconciledParcels = await _unitOfWork.Set<OzonParcel>()
            .CountAsync(p => p.OnlineOrderId != null &&
                _unitOfWork.Set<OnlineOrder>().Any(o => o.Id == p.OnlineOrderId && o.SettlementStatus == CodSettlementStatus.Pending), ct);

        return new CodFinanceDashboardDto(
            OutstandingCod: outstandingOrders.Sum(o => o.TotalAmount),
            OutstandingCount: outstandingOrders.Count,
            CollectedThisMonth: collectedThisMonth,
            CourierFeesThisMonth: feesThisMonth,
            NetThisMonth: collectedThisMonth + feesThisMonth,
            UnreconciledParcels: unreconciledParcels,
            Aging: aging,
            OldestOutstanding: outstandingOrders
                .OrderBy(o => o.DeliveredAt ?? now)
                .Take(20)
                .Select(o => new CodOutstandingOrderDto(
                    o.Id, o.OrderNumber, o.TrackingNumber, o.CustomerName, o.TotalAmount,
                    o.DeliveredAt, (now - (o.DeliveredAt ?? now)).Days))
                .ToList());
    }

    public async Task<IReadOnlyList<CodLedgerEntryDto>> GetLedgerAsync(int? onlineOrderId = null, CancellationToken ct = default)
    {
        var q = _unitOfWork.Set<CodLedgerEntry>().Include(e => e.OnlineOrder).Include(e => e.OzonParcel).AsQueryable();
        if (onlineOrderId is int oid) q = q.Where(e => e.OnlineOrderId == oid);

        return await q.OrderByDescending(e => e.OccurredAt).Take(500)
            .Select(e => new CodLedgerEntryDto(
                e.Id, e.OnlineOrderId, e.OnlineOrder!.OrderNumber, e.OzonParcelId,
                e.OzonParcel != null ? e.OzonParcel.TrackingNumber : null,
                e.Type, e.Amount, e.CourierRemittanceId, e.Source, e.Note, e.OccurredAt))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<CourierRemittanceDto>> GetRemittancesAsync(CancellationToken ct = default)
    {
        var remittances = await _unitOfWork.Set<CourierRemittance>()
            .Include(r => r.LedgerEntries)
            .OrderByDescending(r => r.ReceivedAt)
            .ToListAsync(ct);

        return remittances.Select(MapRemittance).ToList();
    }

    public async Task<CourierRemittanceDto> CreateRemittanceAsync(CreateRemittanceRequest request, int? userId, CancellationToken ct = default)
    {
        var orders = await _unitOfWork.Set<OnlineOrder>()
            .Where(o => request.OnlineOrderIds.Contains(o.Id) && o.SettlementStatus == CodSettlementStatus.Pending)
            .ToListAsync(ct);

        var remittance = new CourierRemittance
        {
            Carrier = request.Carrier,
            Reference = request.Reference,
            PeriodStart = request.PeriodStart,
            PeriodEnd = request.PeriodEnd,
            DeclaredAmount = request.DeclaredAmount,
            BankRef = request.BankRef,
            CreatedByUserId = userId
        };
        await _unitOfWork.AddAsync(remittance, ct);
        await _unitOfWork.SaveChangesAsync(ct); // populate remittance.Id

        // Matched amount = net cash collected minus courier fees for each covered order, i.e. what
        // the shop should actually be owed for this batch.
        decimal matched = 0;
        foreach (var order in orders)
        {
            var net = await _unitOfWork.Set<CodLedgerEntry>()
                .Where(e => e.OnlineOrderId == order.Id)
                .SumAsync(e => e.Amount, ct);
            matched += net;

            await _unitOfWork.AddAsync(new CodLedgerEntry
            {
                OnlineOrderId = order.Id,
                Type = CodLedgerEntryType.Remittance,
                Amount = -net, // closes the outstanding balance for this order
                CourierRemittanceId = remittance.Id,
                Source = "Manual",
                Note = $"Remittance {remittance.Reference ?? remittance.Id.ToString()}",
                OccurredAt = DateTime.UtcNow
            }, ct);

            order.SettlementStatus = CodSettlementStatus.Remitted;
        }

        remittance.MatchedAmount = matched;
        remittance.Status = Math.Abs(remittance.VarianceAmount) < 0.01m
            ? CourierRemittanceStatus.Reconciled
            : CourierRemittanceStatus.Disputed;

        // Anything not covered by this batch but still Pending stays Pending - only flip to Short
        // if this remittance's declared amount undershoots what was actually matched, meaning the
        // courier likely under-paid for the orders it claims to cover.
        if (remittance.VarianceAmount < -0.01m)
        {
            foreach (var order in orders) order.SettlementStatus = CodSettlementStatus.Short;
        }

        await _unitOfWork.SaveChangesAsync(ct);

        return MapRemittance(remittance);
    }

    private static CourierRemittanceDto MapRemittance(CourierRemittance r) => new(
        r.Id, r.Carrier, r.Reference, r.PeriodStart, r.PeriodEnd,
        r.DeclaredAmount, r.MatchedAmount, r.VarianceAmount, r.Status, r.ReceivedAt,
        r.LedgerEntries.Count(e => e.Type == CodLedgerEntryType.Remittance));
}
