using SMS.Application.DTOs.Colors;

namespace SMS.Application.Interfaces;

public interface IColorService
{
    Task<IReadOnlyList<ColorDto>> GetAllAsync(CancellationToken ct = default);
    Task<ColorDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<ColorDto> CreateAsync(CreateColorRequest request, CancellationToken ct = default);
    Task<ColorDto?> UpdateAsync(int id, UpdateColorRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(int id, CancellationToken ct = default);
}
