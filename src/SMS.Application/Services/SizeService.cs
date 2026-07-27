using SMS.Application.DTOs.Sizes;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class SizeService : ISizeService
{
    private readonly IUnitOfWork _unitOfWork;

    public SizeService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IReadOnlyList<SizeDto>> GetAllAsync(CancellationToken ct = default)
    {
        var sizes = await _unitOfWork.Sizes.GetAllAsync(ct);
        return sizes.OrderBy(s => s.SortOrder).Select(MapToDto).ToList();
    }

    public async Task<SizeDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var size = await _unitOfWork.Sizes.GetByIdAsync(id, ct);
        return size is null ? null : MapToDto(size);
    }

    public async Task<SizeDto> CreateAsync(CreateSizeRequest request, CancellationToken ct = default)
    {
        var size = new Size
        {
            Value = request.Value,
            SortOrder = request.SortOrder
        };

        await _unitOfWork.Sizes.AddAsync(size, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return MapToDto(size);
    }

    public async Task<SizeDto?> UpdateAsync(int id, UpdateSizeRequest request, CancellationToken ct = default)
    {
        var size = await _unitOfWork.Sizes.GetByIdAsync(id, ct);
        if (size is null) return null;

        if (request.Value is not null) size.Value = request.Value;
        if (request.SortOrder.HasValue) size.SortOrder = request.SortOrder.Value;

        await _unitOfWork.SaveChangesAsync(ct);

        return MapToDto(size);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        var size = await _unitOfWork.Sizes.GetByIdAsync(id, ct);
        if (size is null) return false;

        _unitOfWork.Sizes.Delete(size);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    private static SizeDto MapToDto(Size s) => new()
    {
        Id = s.Id,
        Value = s.Value,
        SortOrder = s.SortOrder
    };
}
