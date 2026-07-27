using Microsoft.EntityFrameworkCore;
using SMS.Application.DTOs.Online;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class OrderConfirmationAppService : IOrderConfirmationService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOnlineOrderService _onlineOrderService;

    public OrderConfirmationAppService(IUnitOfWork unitOfWork, IOnlineOrderService onlineOrderService)
    {
        _unitOfWork = unitOfWork;
        _onlineOrderService = onlineOrderService;
    }

    public async Task<IReadOnlyList<ConfirmationQueueItemDto>> GetQueueAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        // Auto-promote due callbacks back into the active queue.
        var due = await _unitOfWork.Set<OnlineOrder>()
            .Where(o => o.ConfirmationStatus == ConfirmationStatus.InProgress && o.NextCallbackAt != null && o.NextCallbackAt <= now)
            .ToListAsync(ct);
        if (due.Count > 0)
        {
            foreach (var o in due) o.NextCallbackAt = null;
            await _unitOfWork.SaveChangesAsync(ct);
        }

        var candidates = await _unitOfWork.Set<OnlineOrder>()
            .Where(o => (o.Status == OrderStatus.Pending || o.Status == OrderStatus.Processing) &&
                        (o.ConfirmationStatus == ConfirmationStatus.New || o.ConfirmationStatus == ConfirmationStatus.InProgress))
            .Select(o => new
            {
                o.Id,
                o.OrderNumber,
                o.CustomerName,
                o.CustomerPhone,
                o.City,
                o.TotalAmount,
                ItemCount = o.Items.Count,
                o.ConfirmationStatus,
                o.AttemptCount,
                o.LastAttemptAt,
                o.NextCallbackAt,
                o.CreatedAt
            })
            .ToListAsync(ct);

        // Prior delivered orders + duplicate-order warning, both keyed by phone (cheap client-side
        // pass - the queue is small by construction, capped by how many orders are actually New/InProgress).
        var phones = candidates.Where(c => !string.IsNullOrWhiteSpace(c.CustomerPhone)).Select(c => c.CustomerPhone!).Distinct().ToList();
        var deliveredCounts = phones.Count == 0 ? new Dictionary<string, int>() : await _unitOfWork.Set<OnlineOrder>()
            .Where(o => o.CustomerPhone != null && phones.Contains(o.CustomerPhone) && o.Status == OrderStatus.Delivered)
            .GroupBy(o => o.CustomerPhone!)
            .Select(g => new { Phone = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Phone, g => g.Count, ct);

        var recentByPhone = candidates
            .Where(c => !string.IsNullOrWhiteSpace(c.CustomerPhone))
            .GroupBy(c => c.CustomerPhone!)
            .ToDictionary(g => g.Key, g => g.Count());

        var result = candidates.Select(c => new ConfirmationQueueItemDto(
            c.Id, c.OrderNumber, c.CustomerName, c.CustomerPhone, c.City, c.TotalAmount, c.ItemCount,
            c.ConfirmationStatus, c.AttemptCount, c.LastAttemptAt, c.NextCallbackAt, c.CreatedAt,
            PriorDeliveredOrders: c.CustomerPhone is not null && deliveredCounts.TryGetValue(c.CustomerPhone, out var d) ? d : 0,
            DuplicateOrderWarning: c.CustomerPhone is not null && recentByPhone.TryGetValue(c.CustomerPhone, out var n) && n > 1
        ));

        // Rank: overdue/due callbacks first (NextCallbackAt now null after promotion, so use
        // ConfirmationStatus+AttemptCount as the tiebreak instead), then brand-new oldest-first,
        // then in-progress retries.
        return result
            .OrderBy(i => i.Status == ConfirmationStatus.InProgress && i.AttemptCount > 0 && i.NextCallbackAt is null ? 0
                        : i.Status == ConfirmationStatus.New ? 1 : 2)
            .ThenBy(i => i.CreatedAt)
            .ToList();
    }

    public async Task<ConfirmationStatsDto> GetStatsAsync(CancellationToken ct = default)
    {
        var todayStart = DateTime.UtcNow.Date;

        var queueCount = await _unitOfWork.Set<OnlineOrder>()
            .CountAsync(o => (o.Status == OrderStatus.Pending || o.Status == OrderStatus.Processing) &&
                (o.ConfirmationStatus == ConfirmationStatus.New || o.ConfirmationStatus == ConfirmationStatus.InProgress), ct);

        var dueCallbacks = await _unitOfWork.Set<OnlineOrder>()
            .CountAsync(o => o.ConfirmationStatus == ConfirmationStatus.InProgress && o.NextCallbackAt != null && o.NextCallbackAt <= DateTime.UtcNow, ct);

        var attemptsToday = await _unitOfWork.Set<OrderConfirmationAttempt>()
            .Where(a => a.CreatedAt >= todayStart)
            .Select(a => a.Outcome)
            .ToListAsync(ct);

        var confirmedToday = attemptsToday.Count(o => o == ConfirmationOutcome.Confirmed);
        var rate = attemptsToday.Count == 0 ? 0 : Math.Round(100.0 * confirmedToday / attemptsToday.Count, 1);

        return new ConfirmationStatsDto(queueCount, dueCallbacks, confirmedToday, attemptsToday.Count, rate);
    }

    public async Task<IReadOnlyList<ConfirmationAttemptDto>> GetAttemptsAsync(int onlineOrderId, CancellationToken ct = default)
    {
        return await _unitOfWork.Set<OrderConfirmationAttempt>()
            .Where(a => a.OnlineOrderId == onlineOrderId)
            .Include(a => a.OnlineOrder)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new ConfirmationAttemptDto(a.Id, a.Channel, a.Outcome, a.Note, a.CreatedAt, null))
            .ToListAsync(ct);
    }

    public async Task LogAttemptAsync(int onlineOrderId, LogConfirmationAttemptRequest request, int? agentUserId, CancellationToken ct = default)
    {
        var order = await _unitOfWork.Set<OnlineOrder>().FirstOrDefaultAsync(o => o.Id == onlineOrderId, ct);
        if (order is null) return;

        order.AttemptCount++;
        order.LastAttemptAt = DateTime.UtcNow;
        order.AssignedAgentUserId = agentUserId;

        await _unitOfWork.AddAsync(new OrderConfirmationAttempt
        {
            OnlineOrderId = onlineOrderId,
            AttemptNumber = order.AttemptCount,
            Channel = request.Channel,
            Outcome = request.Outcome,
            AgentUserId = agentUserId,
            Note = request.Note
        }, ct);

        switch (request.Outcome)
        {
            case ConfirmationOutcome.Confirmed:
                order.ConfirmationStatus = ConfirmationStatus.Confirmed;
                order.NextCallbackAt = null;
                await _unitOfWork.SaveChangesAsync(ct);
                // Route through the guarded state machine so history/notifications fire correctly.
                await _onlineOrderService.UpdateStatusAsync(onlineOrderId, OrderStatus.Confirmed, OrderStatusChangeSource.Manual, "Confirmee par centre d'appel", ct);
                return;

            case ConfirmationOutcome.Refused:
                order.ConfirmationStatus = ConfirmationStatus.Refused;
                order.NextCallbackAt = null;
                await _unitOfWork.SaveChangesAsync(ct);
                await _onlineOrderService.CancelAsync(onlineOrderId, request.Note ?? "Refusee lors de la confirmation", ct);
                return;

            case ConfirmationOutcome.Duplicate:
                order.ConfirmationStatus = ConfirmationStatus.Duplicate;
                order.NextCallbackAt = null;
                break;

            case ConfirmationOutcome.NoAnswer:
            case ConfirmationOutcome.Busy:
                // 3-attempt retry policy: +2h, +1 day, then give up and flag for manual follow-up
                // instead of endlessly re-surfacing an order nobody is answering for.
                if (order.AttemptCount >= 3)
                {
                    order.ConfirmationStatus = ConfirmationStatus.Unreachable;
                    order.NextCallbackAt = null;
                }
                else
                {
                    order.ConfirmationStatus = ConfirmationStatus.InProgress;
                    order.NextCallbackAt = order.AttemptCount == 1 ? DateTime.UtcNow.AddHours(2) : DateTime.UtcNow.AddDays(1);
                }
                break;

            case ConfirmationOutcome.WrongNumber:
            case ConfirmationOutcome.Postponed:
            case ConfirmationOutcome.AskedToChange:
            default:
                order.ConfirmationStatus = ConfirmationStatus.InProgress;
                order.NextCallbackAt = DateTime.UtcNow.AddDays(1);
                break;
        }

        await _unitOfWork.SaveChangesAsync(ct);
    }
}
