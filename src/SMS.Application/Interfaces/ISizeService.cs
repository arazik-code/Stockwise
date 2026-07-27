using SMS.Application.DTOs.Sizes;

namespace SMS.Application.Interfaces;

public interface ISizeService
{
    Task<IReadOnlyList<SizeDto>> GetAllAsync(CancellationToken ct = default);
    Task<SizeDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<SizeDto> CreateAsync(CreateSizeRequest request, CancellationToken ct = default);
    Task<SizeDto?> UpdateAsync(int id, UpdateSizeRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(int id, CancellationToken ct = default);
}
