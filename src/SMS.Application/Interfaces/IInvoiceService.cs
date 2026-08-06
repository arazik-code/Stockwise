using SMS.Application.DTOs.Invoices;

namespace SMS.Application.Interfaces;

public interface IInvoiceService
{
    Task<IReadOnlyList<InvoiceDto>> GetAllAsync(CancellationToken ct = default);
    Task<InvoiceDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<IReadOnlyList<InvoiceDto>> GetByFournisseurAsync(int fournisseurId, CancellationToken ct = default);
    Task<IReadOnlyList<InvoiceDto>> SearchAsync(string? query, string? status, int? fournisseurId, CancellationToken ct = default);
    Task<InvoiceDto> CreateAsync(CreateInvoiceRequest request, int? userId = null, CancellationToken ct = default);
    Task<InvoiceDto?> UpdateAsync(int id, CreateInvoiceRequest request, CancellationToken ct = default);
    Task<InvoiceDto?> PayAsync(int id, PayInvoiceRequest request, int? userId = null, CancellationToken ct = default);
    Task<InvoiceDto?> TogglePaidAsync(int id, int? userId = null, CancellationToken ct = default);
    Task<InvoiceDto?> CancelAsync(int id, string? reason = null, CancellationToken ct = default);
    Task<InvoiceDto?> ReceiveAsync(int id, int? userId = null, CancellationToken ct = default);
    Task<int> CancelManyAsync(IEnumerable<int> ids, CancellationToken ct = default);
    Task<InvoiceSummaryDto> GetSummaryAsync(CancellationToken ct = default);
    Task<IReadOnlyList<InvoiceLabelDataDto>> GetLabelDataAsync(int id, CancellationToken ct = default);
}
