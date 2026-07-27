using SMS.Domain.Entities;

namespace SMS.Application.DTOs.Finance;

public record CodLedgerEntryDto(
    long Id, int OnlineOrderId, string OrderNumber, int? OzonParcelId, string? TrackingNumber,
    CodLedgerEntryType Type, decimal Amount, int? CourierRemittanceId, string Source, string? Note, DateTime OccurredAt);

public record CodFinanceDashboardDto(
    decimal OutstandingCod,       // delivered/returned/refused, not yet remitted
    int OutstandingCount,
    decimal CollectedThisMonth,
    decimal CourierFeesThisMonth,
    decimal NetThisMonth,
    int UnreconciledParcels,
    IReadOnlyList<CodAgingBucketDto> Aging,
    IReadOnlyList<CodOutstandingOrderDto> OldestOutstanding);

public record CodAgingBucketDto(string Label, int Count, decimal Amount);

public record CodOutstandingOrderDto(
    int OnlineOrderId, string OrderNumber, string? TrackingNumber, string CustomerName,
    decimal CodAmount, DateTime? DeliveredAt, int DaysOutstanding);

public record CreateRemittanceRequest(
    string Carrier, string? Reference, DateTime PeriodStart, DateTime PeriodEnd,
    decimal DeclaredAmount, string? BankRef, List<int> OnlineOrderIds);

public record CourierRemittanceDto(
    int Id, string Carrier, string? Reference, DateTime PeriodStart, DateTime PeriodEnd,
    decimal DeclaredAmount, decimal MatchedAmount, decimal VarianceAmount,
    CourierRemittanceStatus Status, DateTime ReceivedAt, int OrderCount);
