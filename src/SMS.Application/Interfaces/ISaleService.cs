using SMS.Application.DTOs.Sales;
using SMS.Domain.Enums;

namespace SMS.Application.Interfaces;

public interface ISaleService
{
    Task<SaleDto> CreateSaleAsync(CreateSaleRequest request, int userId, CancellationToken ct = default);
    Task<IReadOnlyList<SaleDto>> GetAllAsync(CancellationToken ct = default);
    Task<SaleDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<DailySalesReportDto> GetDailyReportAsync(DateTime? date = null, CancellationToken ct = default);
    Task<IReadOnlyList<SaleDto>> GetByDateRangeAsync(DateTime from, DateTime to, SaleChannel? channel = null, CancellationToken ct = default);
    Task<SalesReportDto> GetSalesReportAsync(DateTime from, DateTime to, int? fournisseurId = null, SaleCategory? category = null, CancellationToken ct = default);
    Task VoidAsync(int id, CancellationToken ct = default);
    Task<int> VoidManyAsync(IEnumerable<int> ids, CancellationToken ct = default);
    // "Sales made while offline" (Phase 5, plan doc) - manual reconciliation tooling for sales
    // rung up on the local fallback while the VPS was unreachable. Not synced automatically
    // (decision #3) - the owner reviews and re-keys these into the VPS, then marks them handled.
    Task<IReadOnlyList<SaleDto>> GetUnreconciledOfflineSalesAsync(CancellationToken ct = default);
    Task<SaleDto?> MarkReconciledAsync(int id, CancellationToken ct = default);
}
