using SMS.Domain.Entities;

namespace SMS.Application.DTOs.Online;

public record ConfirmationQueueItemDto(
    int OnlineOrderId, string OrderNumber, string CustomerName, string? CustomerPhone,
    string? City, decimal TotalAmount, int ItemCount, ConfirmationStatus Status,
    int AttemptCount, DateTime? LastAttemptAt, DateTime? NextCallbackAt, DateTime CreatedAt,
    int PriorDeliveredOrders, bool DuplicateOrderWarning);

public record LogConfirmationAttemptRequest(ConfirmationChannel Channel, ConfirmationOutcome Outcome, string? Note);

public record ConfirmationAttemptDto(long Id, ConfirmationChannel Channel, ConfirmationOutcome Outcome, string? Note, DateTime CreatedAt, string? AgentName);

public record ConfirmationStatsDto(
    int QueueCount, int DueCallbacks, int ConfirmedToday, int TotalAttemptsToday,
    double ConfirmationRatePercent);
