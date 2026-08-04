using SMS.Domain.Entities;

namespace SMS.Domain.Interfaces;

public record InvoiceSummaryRow(int FournisseurId, string FournisseurNom, string Status, DateTime? DueDate, decimal Owed);

public interface IInvoiceRepository
{
    Task<Invoice?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<IReadOnlyList<Invoice>> GetAllAsync(CancellationToken ct = default);
    Task<IReadOnlyList<Invoice>> GetByFournisseurAsync(int fournisseurId, CancellationToken ct = default);
    Task<IReadOnlyList<Invoice>> GetOverdueAsync(CancellationToken ct = default);
    Task<Invoice> AddAsync(Invoice invoice, CancellationToken ct = default);
    void Update(Invoice invoice);
    void Delete(Invoice invoice);
    Task<int> GetMaxInvoiceNumberAsync(CancellationToken ct = default);

    // Scalar-only projection for GetSummaryAsync() - avoids eagerly loading every LineItem/Payment
    // for the store's entire invoice history just to add up a few numbers (see InvoiceAppService).
    Task<IReadOnlyList<InvoiceSummaryRow>> GetSummaryRowsAsync(CancellationToken ct = default);
}
