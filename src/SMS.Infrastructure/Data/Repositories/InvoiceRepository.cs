using Microsoft.EntityFrameworkCore;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Infrastructure.Data.Repositories;

public class InvoiceRepository : IInvoiceRepository
{
    private readonly AppDbContext _context;

    public InvoiceRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Invoice?> GetByIdAsync(int id, CancellationToken ct = default)
        => await _context.Invoices
            .Include(i => i.Fournisseur)
            .Include(i => i.LineItems)
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.Id == id, ct);

    public async Task<IReadOnlyList<Invoice>> GetAllAsync(CancellationToken ct = default)
        => await _context.Invoices
            .Include(i => i.Fournisseur)
            .Include(i => i.LineItems)
            .Include(i => i.Payments)
            .OrderByDescending(i => i.InvoiceDate)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Invoice>> GetByFournisseurAsync(int fournisseurId, CancellationToken ct = default)
        => await _context.Invoices
            .Include(i => i.Fournisseur)
            .Include(i => i.LineItems)
            .Include(i => i.Payments)
            .Where(i => i.FournisseurId == fournisseurId)
            .OrderByDescending(i => i.InvoiceDate)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Invoice>> GetOverdueAsync(CancellationToken ct = default)
    {
        var today = DateTime.UtcNow;
        return await _context.Invoices
            .Include(i => i.Fournisseur)
            .Include(i => i.LineItems)
            .Include(i => i.Payments)
            .Where(i => i.DueDate != null && i.DueDate < today
                && i.Status != InvoiceStatus.Paid.ToString() && i.Status != InvoiceStatus.Cancelled.ToString())
            .OrderBy(i => i.DueDate)
            .ToListAsync(ct);
    }

    public async Task<Invoice> AddAsync(Invoice invoice, CancellationToken ct = default)
    {
        await _context.Invoices.AddAsync(invoice, ct);
        return invoice;
    }

    public void Update(Invoice invoice) => _context.Invoices.Update(invoice);

    public void Delete(Invoice invoice) => _context.Invoices.Remove(invoice);

    public async Task<int> GetMaxInvoiceNumberAsync(CancellationToken ct = default)
    {
        var numbers = await _context.Invoices.Select(i => i.InvoiceNumber).ToListAsync(ct);
        var max = 0;
        foreach (var number in numbers)
        {
            var suffix = number.Contains('-') ? number[(number.LastIndexOf('-') + 1)..] : number;
            if (int.TryParse(suffix, out var parsed) && parsed > max) max = parsed;
        }
        return max;
    }
}
