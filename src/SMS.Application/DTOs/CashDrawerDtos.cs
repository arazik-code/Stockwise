using SMS.Domain.Entities;

namespace SMS.Application.DTOs;

public record CreateCashDrawerMovementRequest(CashDrawerMovementType Type, decimal Amount, string? Reason);

public record CashDrawerMovementDto(
    int Id,
    CashDrawerMovementType Type,
    decimal Amount,
    string? Reason,
    string UserFullName,
    DateTime CreatedAt);

public record CashDrawerSummaryDto(
    decimal Balance,
    decimal CashSalesTotal,
    decimal CashRefundsTotal,
    decimal ManualNet,
    IReadOnlyList<CashDrawerMovementDto> Recent);
