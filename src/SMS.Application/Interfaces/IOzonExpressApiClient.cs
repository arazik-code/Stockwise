using SMS.Application.DTOs.Ozon;

namespace SMS.Application.Interfaces;

public interface IOzonExpressApiClient
{
    Task<OzonAddParcelResult> AddParcelAsync(OzonAddParcelRequest request, CancellationToken ct = default);
    Task<OzonAddParcelResult> GetParcelInfoAsync(string trackingNumber, CancellationToken ct = default);
    Task<OzonTrackingResult> TrackAsync(string trackingNumber, CancellationToken ct = default);
    Task<IReadOnlyDictionary<string, OzonTrackingResult>> TrackBulkAsync(IEnumerable<string> trackingNumbers, CancellationToken ct = default);
    Task<List<OzonCityApiDto>> GetCitiesAsync(CancellationToken ct = default);

    // 4-step delivery-note (Bon de Livraison) flow.
    Task<OzonDeliveryNoteApiResult> CreateDeliveryNoteAsync(CancellationToken ct = default);
    Task<bool> AddParcelsToDeliveryNoteAsync(string reference, IEnumerable<string> trackingNumbers, CancellationToken ct = default);
    Task<bool> SaveDeliveryNoteAsync(string reference, CancellationToken ct = default);
}
