namespace SMS.Application.DTOs.Ozon;

// ── API client-level result models (what IOzonExpressApiClient returns) ──

public record OzonAddParcelRequest(
    string Receiver,
    string Phone,
    int CityId,
    string Address,
    decimal Price,
    bool IsStock,
    string? TrackingNumber = null,
    string? Note = null,
    string? Nature = null,
    bool Fragile = false,
    bool AllowOpen = true,
    bool CanReplace = false,
    IReadOnlyList<OzonProductRef>? Products = null);

public record OzonProductRef(string Ref, int Qnty);

public record OzonAddParcelResult(
    bool Ok,
    string? Error,
    string? TrackingNumber,
    string? Receiver,
    string? Phone,
    int? CityId,
    string? CityName,
    string? Address,
    decimal? Price,
    decimal? DeliveredPrice,
    decimal? ReturnedPrice,
    decimal? RefusedPrice);

public record OzonTrackingEvent(DateTime? Date, string Status, string? Comment);

public record OzonTrackingResult(
    bool Ok,
    string? Error,
    string TrackingNumber,
    string? Status,
    List<OzonTrackingEvent> Events,
    string? Raw);

public record OzonCityApiDto(int Id, string Ref, string Name, decimal DeliveredPrice, decimal ReturnedPrice, decimal RefusedPrice);

public record OzonDeliveryNoteApiResult(bool Ok, string? Error, string? Ref);
