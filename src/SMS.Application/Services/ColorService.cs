using SMS.Application.DTOs.Colors;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class ColorService : IColorService
{
    private readonly IUnitOfWork _unitOfWork;

    public ColorService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IReadOnlyList<ColorDto>> GetAllAsync(CancellationToken ct = default)
    {
        var colors = await _unitOfWork.Colors.GetAllAsync(ct);
        return colors.OrderBy(c => c.SortOrder).Select(MapToDto).ToList();
    }

    public async Task<ColorDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var color = await _unitOfWork.Colors.GetByIdAsync(id, ct);
        return color is null ? null : MapToDto(color);
    }

    public async Task<ColorDto> CreateAsync(CreateColorRequest request, CancellationToken ct = default)
    {
        var color = new Color
        {
            Name = request.Name,
            HexCode = request.HexCode,
            SortOrder = request.SortOrder
        };

        await _unitOfWork.Colors.AddAsync(color, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return MapToDto(color);
    }

    public async Task<ColorDto?> UpdateAsync(int id, UpdateColorRequest request, CancellationToken ct = default)
    {
        var color = await _unitOfWork.Colors.GetByIdAsync(id, ct);
        if (color is null) return null;

        if (request.Name is not null) color.Name = request.Name;
        if (request.HexCode is not null) color.HexCode = request.HexCode;
        if (request.SortOrder.HasValue) color.SortOrder = request.SortOrder.Value;

        await _unitOfWork.SaveChangesAsync(ct);

        return MapToDto(color);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        var color = await _unitOfWork.Colors.GetByIdAsync(id, ct);
        if (color is null) return false;

        _unitOfWork.Colors.Delete(color);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    private static ColorDto MapToDto(Color c) => new()
    {
        Id = c.Id,
        Name = c.Name,
        HexCode = c.HexCode,
        SortOrder = c.SortOrder
    };
}
