using SMS.Application.DTOs.Finance;
using SMS.Domain.Entities;

namespace SMS.Application.Interfaces;

public interface ICodLedgerService
{
    /// <summary>
    /// Posts the ledger entries for a parcel outcome (Delivered/Returned/Refused) and sets the
    /// order's SettlementStatus to Pending. Called from the courier tracking write-back path -
    /// see OzonExpressAppService.ApplyOrderStatusFromParcelAsync.
    /// </summary>
    Task PostDeliveryOutcomeAsync(int onlineOrderId, int ozonParcelId, CodLedgerEntryType outcomeFeeType, decimal codAmount, decimal? courierFee, CancellationToken ct = default);

    Task<CodFinanceDashboardDto> GetDashboardAsync(CancellationToken ct = default);
    Task<IReadOnlyList<CodLedgerEntryDto>> GetLedgerAsync(int? onlineOrderId = null, CancellationToken ct = default);

    Task<IReadOnlyList<CourierRemittanceDto>> GetRemittancesAsync(CancellationToken ct = default);
    Task<CourierRemittanceDto> CreateRemittanceAsync(CreateRemittanceRequest request, int? userId, CancellationToken ct = default);
}
