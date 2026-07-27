using Microsoft.EntityFrameworkCore;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Infrastructure.Data.Repositories;

public class ClientRepository : IClientRepository
{
    private readonly AppDbContext _context;

    public ClientRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Client?> GetByIdAsync(int id, CancellationToken ct = default)
        => await _context.Clients.FindAsync([id], ct);

    public async Task<Client?> GetByQrCodeAsync(string qrCode, CancellationToken ct = default)
        => await _context.Clients.Include(c => c.LoyaltyTransactions)
            .FirstOrDefaultAsync(c => c.QrCode == qrCode, ct);

    public async Task<Client?> GetByPhoneAsync(string phone, CancellationToken ct = default)
        => await _context.Clients.FirstOrDefaultAsync(c => c.Phone == phone, ct);

    public async Task<Client?> GetByEmailAsync(string email, CancellationToken ct = default)
        => await _context.Clients.FirstOrDefaultAsync(c => c.Email == email, ct);

    public async Task<IReadOnlyList<Client>> GetAllAsync(CancellationToken ct = default)
        => await _context.Clients.OrderByDescending(c => c.LastVisitAt).ToListAsync(ct);

    public async Task AddAsync(Client client, CancellationToken ct = default)
        => await _context.Clients.AddAsync(client, ct);

    public void AddTransaction(LoyaltyTransaction transaction)
        => _context.LoyaltyTransactions.Add(transaction);
}
