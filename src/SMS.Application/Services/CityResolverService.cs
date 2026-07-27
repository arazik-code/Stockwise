using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class CityResolverService : ICityResolverService
{
    private const string CacheKey = "ozon:cities:v1";

    // High-confidence transliterations for the major cities that actually show up in customer-
    // entered Arabic-script city text. Deliberately conservative: an Arabic city name is only
    // included here when it's unambiguous and well-known - guessing wrong would route a parcel
    // (and its price) to the wrong city, which is worse than leaving it for manual review.
    private static readonly Dictionary<string, string> ArabicCityMap = new()
    {
        ["الدارالبيضاء"] = "Casablanca",
        ["الدار البيضاء"] = "Casablanca",
        ["الداربيضاء"] = "Casablanca",
        ["كازا"] = "Casablanca",
        ["مراكش"] = "Marrakech",
        ["الرباط"] = "Rabat",
        ["فاس"] = "Fes",
        ["طنجة"] = "Tanger",
        ["تطوان"] = "Tetouan",
        ["تمارة"] = "Temara",
        ["اكادير"] = "Agadir",
        ["أكادير"] = "Agadir",
        ["المحمدية"] = "Mohammedia",
        ["سلا"] = "Sale",
        ["القنيطرة"] = "Kenitra",
        ["مكناس"] = "Meknes",
        ["بني ملال"] = "Beni Mellal",
        ["ناضور"] = "Nador",
        ["ناظور"] = "Nador",
        ["المضيق"] = "Mdiq",
        ["اسفي"] = "Safi",
        ["كلميم"] = "Guelmim",
        ["وجدة"] = "Oujda",
        ["خريبكة"] = "Khouribga",
        ["الجديدة"] = "El Jadida",
        ["تازة"] = "Taza",
        ["العيون"] = "Laayoune",
    };

    // Keyed by normalized text rather than the raw literal - comparing rawCityText.Trim() directly
    // against the dictionary above silently failed for some entries during live verification
    // (Casablanca/Kenitra spellings never matched despite being visually identical to the map
    // keys), almost certainly a Unicode normalization-form mismatch between what Shopify sends
    // and the literals in this source file. Routing both sides through the same Normalize() call
    // makes the comparison robust to that.
    //
    // GroupBy+First rather than a straight ToDictionary: stripping NonSpacingMark also strips
    // Arabic hamza marks (e.g. "أ" -> "ا"), so a hamza-bearing spelling and its plain-alef
    // counterpart ("أكادير"/"اكادير") can normalize to the identical key - this crashed the whole
    // service at static-init time on first live use. Both variants map to the same city anyway,
    // so keeping the first is correct, not just a crash-avoidance hack.
    private static readonly Dictionary<string, string> NormalizedArabicCityMap = ArabicCityMap
        .GroupBy(kv => Normalize(kv.Key))
        .ToDictionary(g => g.Key, g => g.First().Value);

    private readonly IUnitOfWork _unitOfWork;
    private readonly IMemoryCache _cache;

    public CityResolverService(IUnitOfWork unitOfWork, IMemoryCache cache)
    {
        _unitOfWork = unitOfWork;
        _cache = cache;
    }

    public void InvalidateCache() => _cache.Remove(CacheKey);

    private async Task<List<(int Id, string Ref, string Name, string Norm, decimal DeliveredPrice, decimal ReturnedPrice, decimal RefusedPrice)>> GetCachedCitiesAsync(CancellationToken ct)
    {
        if (_cache.TryGetValue(CacheKey, out List<(int, string, string, string, decimal, decimal, decimal)>? cached) && cached is not null)
            return cached;

        var cities = await _unitOfWork.Set<OzonCity>()
            .Select(c => new { c.Id, c.Ref, c.Name, c.DeliveredPrice, c.ReturnedPrice, c.RefusedPrice })
            .ToListAsync(ct);

        var withNorm = cities
            .Select(c => (c.Id, c.Ref, c.Name, Norm: Normalize(c.Name), c.DeliveredPrice, c.ReturnedPrice, c.RefusedPrice))
            .ToList();

        _cache.Set(CacheKey, withNorm, TimeSpan.FromHours(24));
        return withNorm;
    }

    public async Task<CityResolution?> ResolveAsync(string? rawCityText, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(rawCityText)) return null;
        var key = Normalize(rawCityText);
        if (key.Length == 0) return null;

        var existingAlias = await _unitOfWork.Set<CityAlias>().FirstOrDefaultAsync(a => a.RawKey == key, ct);
        if (existingAlias is not null)
            return new CityResolution(existingAlias.OzonCityId, existingAlias.CanonicalName, existingAlias.Confidence.ToString());

        var cities = await GetCachedCitiesAsync(ct);

        // Tier 1/2: Arabic transliteration table, then resolved against the real catalog the same
        // way a Latin spelling would be - the catalog has no plain "Casablanca" entry at all, only
        // compounds like "Casablanca - Anfa", so an exact-only check here found nothing even
        // though the equivalent Latin spelling resolved fine via the starts-with tier below.
        if (NormalizedArabicCityMap.TryGetValue(key, out var canonicalGuess))
        {
            var normGuess = Normalize(canonicalGuess);
            var arabicMatch = cities.FirstOrDefault(c => c.Norm == normGuess);
            if (arabicMatch.Id == 0)
                arabicMatch = cities.Where(c => c.Norm.StartsWith(normGuess)).OrderBy(c => c.Name.Length).FirstOrDefault();
            if (arabicMatch.Id != 0)
                return await PersistAliasAsync(key, arabicMatch.Id, arabicMatch.Name, CityAliasConfidence.High, CityAliasSource.ArabicTable, ct);
        }

        // Tier 3: exact.
        var exact = cities.FirstOrDefault(c => c.Norm == key);
        if (exact.Id != 0)
            return await PersistAliasAsync(key, exact.Id, exact.Name, CityAliasConfidence.Exact, CityAliasSource.Auto, ct);

        // Tier 4: city name starts with the input (shortest name wins - avoids matching a long
        // suburb name when the plain city exists too).
        var starts = cities.Where(c => c.Norm.StartsWith(key)).OrderBy(c => c.Name.Length).FirstOrDefault();
        if (starts.Id != 0)
            return await PersistAliasAsync(key, starts.Id, starts.Name, CityAliasConfidence.High, CityAliasSource.Auto, ct);

        // Tier 5: city name contains the input.
        var contains = cities.Where(c => c.Norm.Contains(key)).OrderBy(c => c.Name.Length).FirstOrDefault();
        if (contains.Id != 0)
            return await PersistAliasAsync(key, contains.Id, contains.Name, CityAliasConfidence.Medium, CityAliasSource.Auto, ct);

        // Tier 6: reverse - the input contains a known city name (compound addresses like
        // "Rabat Hay Nahda 2" or "Bourgogne Casablanca"). Longest city name wins to avoid a short,
        // ambiguous name matching inside an unrelated word.
        var reverseContains = cities.Where(c => c.Norm.Length >= 4 && key.Contains(c.Norm))
            .OrderByDescending(c => c.Norm.Length).FirstOrDefault();
        if (reverseContains.Id != 0)
            return await PersistAliasAsync(key, reverseContains.Id, reverseContains.Name, CityAliasConfidence.Medium, CityAliasSource.Auto, ct);

        return null;
    }

    private async Task<CityResolution> PersistAliasAsync(string rawKey, int ozonCityId, string canonicalName, CityAliasConfidence confidence, CityAliasSource source, CancellationToken ct)
    {
        await _unitOfWork.AddAsync(new CityAlias
        {
            RawKey = rawKey,
            OzonCityId = ozonCityId,
            CanonicalName = canonicalName,
            Confidence = confidence,
            Source = source
        }, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return new CityResolution(ozonCityId, canonicalName, confidence.ToString());
    }

    public async Task<IReadOnlyList<(int Id, string Ref, string Name, decimal DeliveredPrice, decimal ReturnedPrice, decimal RefusedPrice)>> SearchAsync(string? query, CancellationToken ct = default)
    {
        var cities = await GetCachedCitiesAsync(ct);

        if (string.IsNullOrWhiteSpace(query))
            return cities.OrderBy(c => c.Name).Select(c => (c.Id, c.Ref, c.Name, c.DeliveredPrice, c.ReturnedPrice, c.RefusedPrice)).ToList();

        var norm = Normalize(query);
        return cities
            .Where(c => c.Norm.Contains(norm) || Normalize(c.Ref).Contains(norm))
            .OrderBy(c => c.Norm == norm ? 0 : c.Norm.StartsWith(norm) ? 1 : 2)
            .ThenBy(c => c.Name.Length)
            .ThenBy(c => c.Name)
            .Select(c => (c.Id, c.Ref, c.Name, c.DeliveredPrice, c.ReturnedPrice, c.RefusedPrice))
            .ToList();
    }

    public async Task<CityBootstrapResultDto> BootstrapHistoricalOrdersAsync(CancellationToken ct = default)
    {
        var distinctCities = await _unitOfWork.Set<OnlineOrder>()
            .Where(o => o.City != null && o.City != "" && o.OzonCityId == null)
            .Select(o => o.City!)
            .Distinct()
            .ToListAsync(ct);

        int resolved = 0, ordersUpdated = 0, stillUnresolved = 0;

        foreach (var rawCity in distinctCities)
        {
            var resolution = await ResolveAsync(rawCity, ct);
            if (resolution is null) { stillUnresolved++; continue; }

            resolved++;
            var affected = await _unitOfWork.Set<OnlineOrder>()
                .Where(o => o.City == rawCity && o.OzonCityId == null)
                .ToListAsync(ct);

            foreach (var order in affected)
            {
                order.OzonCityId = resolution.OzonCityId;
                order.CityCanonical = resolution.CanonicalName;
            }
            ordersUpdated += affected.Count;
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return new CityBootstrapResultDto(distinctCities.Count, resolved, ordersUpdated, stillUnresolved);
    }

    public async Task<IReadOnlyList<UnresolvedCityDto>> GetUnresolvedCitiesAsync(CancellationToken ct = default)
    {
        // EF Core can't translate a record's positional constructor inside a GroupBy().Select() -
        // group with an anonymous type in SQL, then map to the DTO client-side. This table is
        // capped at a few hundred distinct spellings at most, so materializing it is fine.
        var grouped = await _unitOfWork.Set<OnlineOrder>()
            .Where(o => o.City != null && o.City != "" && o.OzonCityId == null)
            .GroupBy(o => o.City!)
            .Select(g => new { City = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return grouped
            .OrderByDescending(g => g.Count)
            .Select(g => new UnresolvedCityDto(g.City, g.Count))
            .ToList();
    }

    // Lowercases and strips diacritics (accented Latin only - Arabic script passes through
    // unchanged since it carries no Unicode NonSpacingMark diacritics of the relevant kind here).
    public static string Normalize(string text)
    {
        var trimmed = text.Trim().ToLowerInvariant();
        var decomposed = trimmed.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        foreach (var ch in decomposed)
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }
}
