using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Infrastructure.Data.Repositories;

public class SizeRepository : Repository<Size>, ISizeRepository
{
    public SizeRepository(AppDbContext context) : base(context) { }
}
