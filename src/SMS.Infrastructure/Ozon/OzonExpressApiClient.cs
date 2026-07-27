using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SMS.Application.DTOs.Ozon;
using SMS.Application.Interfaces;

namespace SMS.Infrastructure.Ozon;

// Client for the OzonExpress courier REST API (https://api.ozonexpress.ma).
// Quirks handled here: form-data POST bodies, credentials baked into the URL path,
// UPPERCASE-hyphenated JSON keys, and a CHECK_API/… envelope on some endpoints.
public class OzonExpressApiClient : IOzonExpressApiClient
{
    private readonly HttpClient _http;
    private readonly OzonExpressOptions _options;
    private readonly ILogger<OzonExpressApiClient> _logger;

    public OzonExpressApiClient(HttpClient http, IOptions<OzonExpressOptions> options, ILogger<OzonExpressApiClient> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    private string Base => $"/customers/{_options.CustomerId}/{_options.ApiKey}";

    public async Task<OzonAddParcelResult> AddParcelAsync(OzonAddParcelRequest request, CancellationToken ct = default)
    {
        var form = new MultipartFormDataContent
        {
            { new StringContent(request.Receiver), "parcel-receiver" },
            { new StringContent(ToLocalMoroccoPhone(request.Phone)), "parcel-phone" },
            { new StringContent(request.CityId.ToString(CultureInfo.InvariantCulture)), "parcel-city" },
            { new StringContent(request.Address), "parcel-address" },
            { new StringContent(request.Price.ToString("0.##", CultureInfo.InvariantCulture)), "parcel-price" },
            { new StringContent(request.IsStock ? "1" : "0"), "parcel-stock" },
            { new StringContent(request.AllowOpen ? "1" : "2"), "parcel-open" },
            { new StringContent(request.Fragile ? "1" : "0"), "parcel-fragile" },
            { new StringContent(request.CanReplace ? "1" : "0"), "parcel-replace" },
        };
        if (!string.IsNullOrWhiteSpace(request.TrackingNumber)) form.Add(new StringContent(request.TrackingNumber), "tracking-number");
        if (!string.IsNullOrWhiteSpace(request.Note)) form.Add(new StringContent(request.Note), "parcel-note");
        if (!string.IsNullOrWhiteSpace(request.Nature)) form.Add(new StringContent(request.Nature), "parcel-nature");
        if (request.Products is { Count: > 0 })
        {
            var json = JsonSerializer.Serialize(request.Products.Select(p => new { p.Ref, qnty = p.Qnty }));
            form.Add(new StringContent(json), "products");
        }

        try
        {
            using var resp = await _http.PostAsync($"{Base}/add-parcel", form, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            // Response is wrapped: { "ADD-PARCEL": { RESULT, MESSAGE, NEW-PARCEL: { TRACKING-NUMBER, ... } } }
            var envelope = root.TryGetProperty("ADD-PARCEL", out var ap) ? ap : root;

            if (string.Equals(FindString(envelope, "RESULT"), "ERROR", StringComparison.OrdinalIgnoreCase))
            {
                var msg = FindString(envelope, "MESSAGE") ?? "Échec de création du colis";
                return new OzonAddParcelResult(false, msg, null, null, null, null, null, null, null, null, null, null);
            }

            var data = envelope.TryGetProperty("NEW-PARCEL", out var np) ? np : envelope;
            var tracking = FindString(data, "TRACKING-NUMBER") ?? FindString(data, "TRACKING_NUMBER");
            if (string.IsNullOrWhiteSpace(tracking))
            {
                var msg = FindString(envelope, "MESSAGE") ?? "Réponse OzonExpress invalide";
                return new OzonAddParcelResult(false, msg, null, null, null, null, null, null, null, null, null, null);
            }

            return new OzonAddParcelResult(
                true, null, tracking,
                FindString(data, "RECEIVER"),
                FindString(data, "PHONE"),
                FindInt(data, "CITY_ID"),
                FindString(data, "CITY_NAME"),
                FindString(data, "ADDRESS"),
                FindDecimal(data, "PRICE"),
                FindDecimal(data, "DELIVERED-PRICE"),
                FindDecimal(data, "RETURNED-PRICE"),
                FindDecimal(data, "REFUSED-PRICE"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OzonExpress add-parcel failed");
            return new OzonAddParcelResult(false, ex.Message, null, null, null, null, null, null, null, null, null, null);
        }
    }

    public async Task<OzonAddParcelResult> GetParcelInfoAsync(string trackingNumber, CancellationToken ct = default)
    {
        var form = new MultipartFormDataContent { { new StringContent(trackingNumber), "tracking-number" } };
        try
        {
            using var resp = await _http.PostAsync($"{Base}/parcel-info", form, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var info = root.TryGetProperty("PARCEL-INFO", out var pi) ? pi : root;

            var result = FindString(info, "RESULT");
            if (string.Equals(result, "ERROR", StringComparison.OrdinalIgnoreCase))
                return new OzonAddParcelResult(false, FindString(info, "MESSAGE") ?? "Colis introuvable", trackingNumber, null, null, null, null, null, null, null, null, null);

            // Detail fields live under an INFOS object on success.
            var data = info.TryGetProperty("INFOS", out var infos) ? infos : info;
            return new OzonAddParcelResult(
                true, null, FindString(data, "TRACKING-NUMBER") ?? trackingNumber,
                FindString(data, "RECEIVER"), FindString(data, "PHONE"),
                FindInt(data, "CITY_ID"), FindString(data, "CITY_NAME"), FindString(data, "ADDRESS"),
                FindDecimal(data, "PRICE"), FindDecimal(data, "DELIVERED-PRICE"),
                FindDecimal(data, "RETURNED-PRICE"), FindDecimal(data, "REFUSED-PRICE"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OzonExpress parcel-info failed for {Tracking}", trackingNumber);
            return new OzonAddParcelResult(false, ex.Message, trackingNumber, null, null, null, null, null, null, null, null, null);
        }
    }

    public async Task<OzonTrackingResult> TrackAsync(string trackingNumber, CancellationToken ct = default)
    {
        var form = new MultipartFormDataContent { { new StringContent(trackingNumber), "tracking-number" } };
        try
        {
            using var resp = await _http.PostAsync($"{Base}/tracking", form, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            return ParseTracking(trackingNumber, body);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OzonExpress tracking failed for {Tracking}", trackingNumber);
            return new OzonTrackingResult(false, ex.Message, trackingNumber, null, [], null);
        }
    }

    public async Task<IReadOnlyDictionary<string, OzonTrackingResult>> TrackBulkAsync(IEnumerable<string> trackingNumbers, CancellationToken ct = default)
    {
        var list = trackingNumbers.Distinct().ToList();
        var results = new Dictionary<string, OzonTrackingResult>();
        if (list.Count == 0) return results;

        try
        {
            var payload = JsonSerializer.Serialize(new Dictionary<string, object> { ["tracking-number"] = list });
            using var content = new StringContent(payload, Encoding.UTF8, "application/json");
            using var resp = await _http.PostAsync($"{Base}/tracking", content, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            // The bulk response nests per-tracking objects; walk the tree and pick out each TRACKING-NUMBER block.
            foreach (var tn in list)
            {
                var block = FindTrackingBlock(root, tn);
                results[tn] = block is null
                    ? new OzonTrackingResult(false, "Non trouvé dans la réponse", tn, null, [], null)
                    : ParseTrackingElement(tn, block.Value, body);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OzonExpress bulk tracking failed, falling back to per-parcel calls");
            foreach (var tn in list) results[tn] = await TrackAsync(tn, ct);
        }

        return results;
    }

    public async Task<List<OzonCityApiDto>> GetCitiesAsync(CancellationToken ct = default)
    {
        var cities = new List<OzonCityApiDto>();
        try
        {
            using var resp = await _http.GetAsync("/cities", ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("CITIES", out var citiesObj)) return cities;

            foreach (var prop in citiesObj.EnumerateObject())
            {
                var c = prop.Value;
                var id = FindInt(c, "ID") ?? (int.TryParse(prop.Name, out var pid) ? pid : 0);
                if (id == 0) continue;
                cities.Add(new OzonCityApiDto(
                    id,
                    FindString(c, "REF") ?? "",
                    FindString(c, "NAME") ?? "",
                    FindDecimal(c, "DELIVERED-PRICE") ?? 0,
                    FindDecimal(c, "RETURNED-PRICE") ?? 0,
                    FindDecimal(c, "REFUSED-PRICE") ?? 0));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OzonExpress cities fetch failed");
        }
        return cities;
    }

    public async Task<OzonDeliveryNoteApiResult> CreateDeliveryNoteAsync(CancellationToken ct = default)
    {
        try
        {
            using var resp = await _http.PostAsync($"{Base}/add-delivery-note", new MultipartFormDataContent(), ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            // Response: { CHECK_API, ADD-BL: { RESULT, MESSAGE, NEW-BL: { REF, ID } } }
            var addBl = root.TryGetProperty("ADD-BL", out var ab) ? ab : root;
            if (string.Equals(FindString(addBl, "RESULT"), "ERROR", StringComparison.OrdinalIgnoreCase))
                return new OzonDeliveryNoteApiResult(false, FindString(addBl, "MESSAGE") ?? "Échec de création du BL", null);

            var newBl = addBl.TryGetProperty("NEW-BL", out var nb) ? nb : addBl;
            var reference = FindString(newBl, "REF") ?? FindString(newBl, "ref") ?? FindString(newBl, "Ref");
            return string.IsNullOrWhiteSpace(reference)
                ? new OzonDeliveryNoteApiResult(false, FindString(addBl, "MESSAGE") ?? "Réf BL absente", null)
                : new OzonDeliveryNoteApiResult(true, null, reference);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OzonExpress create delivery note failed");
            return new OzonDeliveryNoteApiResult(false, ex.Message, null);
        }
    }

    public async Task<bool> AddParcelsToDeliveryNoteAsync(string reference, IEnumerable<string> trackingNumbers, CancellationToken ct = default)
    {
        var form = new MultipartFormDataContent { { new StringContent(reference), "Ref" } };
        var i = 0;
        foreach (var tn in trackingNumbers) form.Add(new StringContent(tn), $"Codes[{i++}]");
        try
        {
            using var resp = await _http.PostAsync($"{Base}/add-parcel-to-delivery-note", form, ct);
            if (!resp.IsSuccessStatusCode) return false;
            var body = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            var block = doc.RootElement.TryGetProperty("ADD-PARCEL-BL", out var b) ? b : doc.RootElement;
            return !string.Equals(FindString(block, "RESULT"), "ERROR", StringComparison.OrdinalIgnoreCase);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OzonExpress add-parcel-to-delivery-note failed for {Ref}", reference);
            return false;
        }
    }

    public async Task<bool> SaveDeliveryNoteAsync(string reference, CancellationToken ct = default)
    {
        var form = new MultipartFormDataContent { { new StringContent(reference), "Ref" } };
        try
        {
            using var resp = await _http.PostAsync($"{Base}/save-delivery-note", form, ct);
            if (!resp.IsSuccessStatusCode) return false;
            var body = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            var block = doc.RootElement.TryGetProperty("SAVE-BL", out var b) ? b : doc.RootElement;
            return !string.Equals(FindString(block, "RESULT"), "ERROR", StringComparison.OrdinalIgnoreCase);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OzonExpress save-delivery-note failed for {Ref}", reference);
            return false;
        }
    }

    // ── JSON parsing helpers (defensive against the API's inconsistent shapes) ──

    private static OzonTrackingResult ParseTracking(string tn, string body)
    {
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        var block = root.TryGetProperty("TRACKING", out var t) ? t : root;
        return ParseTrackingElement(tn, block, body);
    }

    private static OzonTrackingResult ParseTrackingElement(string tn, JsonElement block, string raw)
    {
        var result = FindString(block, "RESULT");
        if (string.Equals(result, "ERROR", StringComparison.OrdinalIgnoreCase))
            return new OzonTrackingResult(false, FindString(block, "MESSAGE") ?? "Introuvable", tn, null, [], raw);

        var status = FindString(block, "STATUT") ?? FindString(block, "STATUS")
            ?? FindString(block, "LAST-STATUS") ?? FindString(block, "STATE");

        var events = new List<OzonTrackingEvent>();
        foreach (var key in new[] { "HISTORY", "TRACKING-HISTORY", "STEPS", "EVENTS", "TRACKING_HISTORY" })
        {
            if (!block.TryGetProperty(key, out var hist)) continue;

            // OzonExpress returns HISTORY as an object keyed "1","2",… (not an array) — support both.
            IEnumerable<JsonElement> entries = hist.ValueKind switch
            {
                JsonValueKind.Array => hist.EnumerateArray().ToList(),
                JsonValueKind.Object => hist.EnumerateObject().Select(p => p.Value).ToList(),
                _ => []
            };
            if (!entries.Any()) continue;

            foreach (var e in entries)
            {
                var st = FindString(e, "STATUT") ?? FindString(e, "STATUS") ?? FindString(e, "STATE") ?? "";
                var date = ParseEventDate(FindString(e, "TIME_STR"), FindString(e, "DATE") ?? FindString(e, "DATE-TIME"), FindString(e, "TIME"));
                var comment = FindString(e, "COMMENT") ?? FindString(e, "COMMENTAIRE") ?? FindString(e, "NOTE");
                if (!string.IsNullOrWhiteSpace(st) || date is not null)
                    events.Add(new OzonTrackingEvent(date, st, comment));
            }
            break;
        }

        // Latest event first for the timeline; its status is the parcel's current status.
        events = events.OrderByDescending(e => e.Date ?? DateTime.MinValue).ToList();
        if (string.IsNullOrWhiteSpace(status) && events.Count > 0)
            status = events[0].Status;

        return new OzonTrackingResult(true, null, tn, status, events, raw);
    }

    // Parses an OzonExpress history date from either a "yyyy-MM-dd HH:mm" string or a unix timestamp.
    private static DateTime? ParseEventDate(string? timeStr, string? dateStr, string? unix)
    {
        foreach (var s in new[] { timeStr, dateStr })
            if (!string.IsNullOrWhiteSpace(s) && DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var d))
                return d;
        if (long.TryParse(unix, out var secs) && secs > 0)
            return DateTimeOffset.FromUnixTimeSeconds(secs).UtcDateTime;
        return null;
    }

    private static JsonElement? FindTrackingBlock(JsonElement root, string tn)
    {
        // Search recursively for an object whose TRACKING-NUMBER equals tn.
        if (root.ValueKind == JsonValueKind.Object)
        {
            var thisTn = FindString(root, "TRACKING-NUMBER");
            if (string.Equals(thisTn, tn, StringComparison.OrdinalIgnoreCase)) return root;
            foreach (var prop in root.EnumerateObject())
            {
                var found = FindTrackingBlock(prop.Value, tn);
                if (found is not null) return found;
            }
        }
        else if (root.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in root.EnumerateArray())
            {
                var found = FindTrackingBlock(el, tn);
                if (found is not null) return found;
            }
        }
        return null;
    }

    // OzonExpress requires local Moroccan phone format (0XXXXXXXXX); orders often store +212… international.
    private static string ToLocalMoroccoPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.StartsWith("212")) digits = "0" + digits[3..];
        if (digits.Length == 9 && !digits.StartsWith("0")) digits = "0" + digits;
        return digits;
    }

    private static string? FindString(JsonElement el, string key)
    {
        if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty(key, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.String => v.GetString(),
            JsonValueKind.Number => v.ToString(),
            _ => null
        };
    }

    private static int? FindInt(JsonElement el, string key)
    {
        var s = FindString(el, key);
        return int.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var i) ? i : null;
    }

    private static decimal? FindDecimal(JsonElement el, string key)
    {
        var s = FindString(el, key);
        return decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : null;
    }
}
