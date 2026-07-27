using SMS.Domain.Enums;

namespace SMS.Application.DTOs.Ozon;

public record OzonConfigStatusDto(bool Configured, string? CustomerId, int CityCount, DateTime? CitiesUpdatedAt);

public record OzonCityDto(int Id, string Ref, string Name, decimal DeliveredPrice, decimal ReturnedPrice, decimal RefusedPrice);

public record CreateOzonParcelRequest(
    int? OnlineOrderId,
    string Receiver,
    string Phone,
    int CityId,
    string Address,
    decimal Price,
    bool IsStock = false, // false = ramassage (courier picks up from shop); true requires OzonExpress stock refs
    string? Note = null,
    string? Nature = null,
    bool Fragile = false,
    bool AllowOpen = true,
    bool CanReplace = false);

public record OzonParcelDto(
    int Id,
    int? OnlineOrderId,
    string? OrderNumber,
    string TrackingNumber,
    string Receiver,
    string Phone,
    int CityId,
    string? CityName,
    string Address,
    string? Note,
    string? Nature,
    decimal Price,
    decimal? DeliveredPrice,
    decimal? ReturnedPrice,
    decimal? RefusedPrice,
    bool IsStock,
    bool Fragile,
    OzonParcelStatus Status,
    string? StatusText,
    string? DeliveryNoteRef,
    DateTime? LastSyncedAt,
    DateTime CreatedAt);

public record OzonParcelResultDto(bool Ok, string? Error, OzonParcelDto? Parcel);

public record OzonTrackingEventDto(DateTime? Date, string Status, string? Comment);
public record OzonTrackingDto(bool Ok, string? Error, string TrackingNumber, OzonParcelStatus Status, string? StatusText, List<OzonTrackingEventDto> Events);

public record OzonSyncTrackingResultDto(int Synced, int Updated);

public record OzonDeliveryNoteDto(
    int Id,
    string Ref,
    OzonDeliveryNoteStatus Status,
    int ParcelCount,
    DateTime CreatedAt,
    DateTime? SavedAt,
    string PdfUrl,
    string LabelsA4Url,
    string Labels10x10Url);

public record CreateDeliveryNoteRequest(List<string> TrackingNumbers);
public record OzonDeliveryNoteResultDto(bool Ok, string? Error, OzonDeliveryNoteDto? DeliveryNote);

public record OzonDashboardDto(
    bool Configured,
    int TotalParcels,
    int InTransit,
    int Delivered,
    int Returned,
    int Refused,
    int Pending,
    decimal CodPending,       // COD still to be collected (not yet delivered)
    decimal CodCollected,     // COD from delivered parcels
    decimal CourierFees,      // sum of delivered fees on delivered parcels
    int DeliveryNoteCount,
    List<OzonParcelDto> RecentParcels,
    List<OzonCityStatDto> TopCities);

public record OzonCityStatDto(string City, int Count, decimal Cod);
