using SMS.Domain.Entities;

namespace SMS.Domain.Interfaces;

public interface IClientRepository
{
    Task<Client?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<Client?> GetByQrCodeAsync(string qrCode, CancellationToken ct = default);
    Task<Client?> GetByPhoneAsync(string phone, CancellationToken ct = default);
    Task<Client?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<IReadOnlyList<Client>> GetAllAsync(CancellationToken ct = default);
    Task AddAsync(Client client, CancellationToken ct = default);
    void AddTransaction(LoyaltyTransaction transaction);
}
