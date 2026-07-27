using Microsoft.EntityFrameworkCore;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Infrastructure.Data.Repositories;

public class FournisseurRepository : IFournisseurRepository
{
    private readonly AppDbContext _context;

    public FournisseurRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<Fournisseur>> GetAllAsync(CancellationToken ct = default)
        => await _context.Fournisseurs.Include(f => f.Products).OrderBy(f => f.Nom).ToListAsync(ct);

    public async Task<Fournisseur?> GetByIdAsync(int id, CancellationToken ct = default)
        => await _context.Fournisseurs.Include(f => f.Products).FirstOrDefaultAsync(f => f.Id == id, ct);

    public async Task<Fournisseur> AddAsync(Fournisseur fournisseur, CancellationToken ct = default)
    {
        await _context.Fournisseurs.AddAsync(fournisseur, ct);
        return fournisseur;
    }

    public void Update(Fournisseur fournisseur) => _context.Fournisseurs.Update(fournisseur);

    public void Delete(Fournisseur fournisseur) => _context.Fournisseurs.Remove(fournisseur);
}
