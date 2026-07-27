namespace SMS.Domain.Entities;

/// <summary>
/// A resolved mapping from a raw, as-typed city spelling (customer-entered, any script/casing/
/// typo) to a canonical OzonCity. Once resolved once, later orders with the exact same spelling
/// resolve via an index lookup instead of re-running the fuzzy matcher - and the mapping is
/// visible/correctable by an admin instead of being an opaque runtime heuristic.
/// </summary>
public class CityAlias
{
    public int Id { get; set; }

    // Normalized (lowercased, accent-stripped, trimmed) raw text - the actual lookup key.
    public string RawKey { get; set; } = string.Empty;

    public int OzonCityId { get; set; }
    public OzonCity? OzonCity { get; set; }
    public string CanonicalName { get; set; } = string.Empty;

    public CityAliasConfidence Confidence { get; set; }
    public CityAliasSource Source { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum CityAliasConfidence
{
    Exact = 0,
    High = 1,   // known Arabic transliteration table, or prefix match
    Medium = 2, // contains / reverse-contains match
    Manual = 3  // confirmed by a human
}

public enum CityAliasSource
{
    Auto = 0,
    Manual = 1,
    ArabicTable = 2
}
