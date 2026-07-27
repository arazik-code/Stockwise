using SMS.Application.DTOs.Ozon;

namespace SMS.Application.Interfaces;

public interface IOzonExpressService
{
    Task<OzonConfigStatusDto> GetConfigStatusAsync(CancellationToken ct = default);
    Task<int> SyncCitiesAsync(CancellationToken ct = default);
    Task<IReadOnlyList<OzonCityDto>> GetCitiesAsync(string? search = null, CancellationToken ct = default);

    Task<OzonParcelResultDto> CreateParcelAsync(CreateOzonParcelRequest request, CancellationToken ct = default);
    // Creates a parcel from an existing online order, resolving the courier city from the order's free-text city.
    Task<OzonParcelResultDto> CreateParcelForOrderAsync(int onlineOrderId, CancellationToken ct = default);
    Task<IReadOnlyList<OzonParcelDto>> GetParcelsAsync(string? status = null, string? search = null, CancellationToken ct = default);
    Task<OzonParcelDto?> GetParcelAsync(int id, CancellationToken ct = default);
    Task<OzonParcelDto?> GetParcelByOrderIdAsync(int onlineOrderId, CancellationToken ct = default);
    Task<OzonTrackingDto> TrackParcelAsync(int id, CancellationToken ct = default);
    Task<OzonSyncTrackingResultDto> SyncAllTrackingAsync(CancellationToken ct = default);

    Task<OzonDeliveryNoteResultDto> CreateDeliveryNoteAsync(CreateDeliveryNoteRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<OzonDeliveryNoteDto>> GetDeliveryNotesAsync(CancellationToken ct = default);

    Task<OzonDashboardDto> GetDashboardAsync(CancellationToken ct = default);
}
