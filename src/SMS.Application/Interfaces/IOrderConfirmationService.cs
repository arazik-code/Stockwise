using SMS.Application.DTOs.Online;

namespace SMS.Application.Interfaces;

public interface IOrderConfirmationService
{
    /// <summary>
    /// Orders ready to be worked, ranked: overdue callbacks first, then brand-new orders (oldest
    /// first), then everything else still in progress. Auto-promotes orders whose NextCallbackAt
    /// has passed back into the active queue.
    /// </summary>
    Task<IReadOnlyList<ConfirmationQueueItemDto>> GetQueueAsync(CancellationToken ct = default);

    Task<ConfirmationStatsDto> GetStatsAsync(CancellationToken ct = default);

    Task<IReadOnlyList<ConfirmationAttemptDto>> GetAttemptsAsync(int onlineOrderId, CancellationToken ct = default);

    /// <summary>
    /// Records one confirmation attempt and drives the order's ConfirmationStatus (and, for
    /// Confirmed/Refused outcomes, the order's actual OrderStatus) accordingly.
    /// </summary>
    Task LogAttemptAsync(int onlineOrderId, LogConfirmationAttemptRequest request, int? agentUserId, CancellationToken ct = default);
}
