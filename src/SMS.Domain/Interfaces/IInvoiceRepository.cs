using SMS.Domain.Entities;

namespace SMS.Domain.Interfaces;

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
}
