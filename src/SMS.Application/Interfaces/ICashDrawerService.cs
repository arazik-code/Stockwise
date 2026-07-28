using SMS.Application.DTOs;

namespace SMS.Application.Interfaces;

public interface ICashDrawerService
{
    Task<CashDrawerMovementDto> CreateAsync(int userId, CreateCashDrawerMovementRequest request, CancellationToken ct = default);
    Task<CashDrawerSummaryDto> GetSummaryAsync(int recentCount = 8, CancellationToken ct = default);
}
