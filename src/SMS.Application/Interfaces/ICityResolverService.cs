namespace SMS.Application.Interfaces;

public record CityResolution(int OzonCityId, string CanonicalName, string Confidence);

public interface ICityResolverService
{
    /// <summary>
    /// Resolves free-text, customer-entered city text (any script, casing, typo) to a canonical
    /// OzonExpress city. Checks the CityAlias table first (an index lookup for anything seen
    /// before), then a curated Arabic-transliteration table for the major cities, then a tiered
    /// fuzzy match against the cached city catalog (exact, prefix, contains, reverse-contains -
    /// the raw text containing a known city name, for compound addresses like "Rabat Hay Nahda
    /// 2"). A successful non-alias match is persisted as a new CityAlias so the same spelling
    /// resolves via index lookup next time.
    /// </summary>
    Task<CityResolution?> ResolveAsync(string? rawCityText, CancellationToken ct = default);

    /// <summary>Ranked city search for the manual parcel-creation picker.</summary>
    Task<IReadOnlyList<(int Id, string Ref, string Name, decimal DeliveredPrice, decimal ReturnedPrice, decimal RefusedPrice)>> SearchAsync(string? query, CancellationToken ct = default);

    /// <summary>Invalidates the cached city catalog - call after SyncCitiesAsync.</summary>
    void InvalidateCache();

    /// <summary>
    /// One-off bootstrap over every distinct historical OnlineOrders.City spelling: resolves each
    /// (persisting a CityAlias as it goes) and backfills OzonCityId/CityCanonical onto the
    /// matching orders. Safe to re-run - already-resolved orders are skipped.
    /// </summary>
    Task<CityBootstrapResultDto> BootstrapHistoricalOrdersAsync(CancellationToken ct = default);

    /// <summary>Distinct raw city spellings that still have no resolution, for manual review.</summary>
    Task<IReadOnlyList<UnresolvedCityDto>> GetUnresolvedCitiesAsync(CancellationToken ct = default);
}

public record CityBootstrapResultDto(int DistinctSpellings, int Resolved, int OrdersUpdated, int StillUnresolved);
public record UnresolvedCityDto(string RawCity, int OrderCount);
