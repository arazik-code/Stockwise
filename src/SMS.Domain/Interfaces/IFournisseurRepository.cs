using SMS.Domain.Entities;

namespace SMS.Domain.Interfaces;

public interface IFournisseurRepository
{
    Task<IReadOnlyList<Fournisseur>> GetAllAsync(CancellationToken ct = default);
    Task<Fournisseur?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<Fournisseur> AddAsync(Fournisseur fournisseur, CancellationToken ct = default);
    void Update(Fournisseur fournisseur);
    void Delete(Fournisseur fournisseur);
}
