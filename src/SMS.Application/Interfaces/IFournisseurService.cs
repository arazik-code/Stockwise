using SMS.Application.DTOs.Fournisseurs;

namespace SMS.Application.Interfaces;

public interface IFournisseurService
{
    Task<IReadOnlyList<FournisseurDto>> GetAllAsync(CancellationToken ct = default);
    Task<FournisseurDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<FournisseurDto> CreateAsync(CreateFournisseurRequest request, CancellationToken ct = default);
    Task<FournisseurDto?> UpdateAsync(int id, UpdateFournisseurRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(int id, CancellationToken ct = default);
    Task<IReadOnlyList<FournisseurPerformanceDto>> GetPerformanceAsync(CancellationToken ct = default);
    Task<IReadOnlyList<FournisseurRecommendationDto>> GetRecommendationsAsync(CancellationToken ct = default);
    Task<ReceiveDeliveryResponse> ReceiveDeliveryAsync(int fournisseurId, ReceiveDeliveryRequest request, int? userId = null, CancellationToken ct = default);
}
