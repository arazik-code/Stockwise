using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Infrastructure.Data.Repositories;

public class ColorRepository : Repository<Color>, IColorRepository
{
    public ColorRepository(AppDbContext context) : base(context) { }
}
