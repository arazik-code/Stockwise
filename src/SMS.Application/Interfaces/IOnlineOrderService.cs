using SMS.Application.DTOs.Online;
using SMS.Domain.Entities;
using SMS.Domain.Enums;

namespace SMS.Application.Interfaces;

public interface IOnlineOrderService
{
    Task<OnlineOrderDto> CreateManualOrderAsync(CreateManualOrderRequest request, int? userId, CancellationToken ct = default);
    Task<IReadOnlyList<OnlineOrderDto>> GetAllAsync(OnlineOrderChannel? channel = null, OrderStatus? status = null, DateTime? from = null, DateTime? to = null, CancellationToken ct = default);
    Task<OnlineOrderDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<OnlineOrderDto?> UpdateStatusAsync(int id, OrderStatus status, OrderStatusChangeSource source = OrderStatusChangeSource.Manual, string? reason = null, CancellationToken ct = default);
    Task<bool> CancelAsync(int id, string? reason, CancellationToken ct = default);
    Task<OnlineOrderDto?> MarkPaidAsync(int id, decimal? amountPaid, CancellationToken ct = default);
    Task<OnlineOrderDto?> AssignShippingAsync(int id, AssignShippingRequest request, CancellationToken ct = default);
    Task<OnlineDashboardDto> GetDashboardAsync(CancellationToken ct = default);
    Task<IReadOnlyList<OnlineOrderDto>> GetConflictsAsync(CancellationToken ct = default);
    Task<OnlineReportDto> GetReportAsync(DateTime from, DateTime to, CancellationToken ct = default);
}
