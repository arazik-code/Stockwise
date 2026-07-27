using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SMS.Application.DTOs.Ozon;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class OzonExpressAppService : IOzonExpressService
{
    // Non-terminal statuses still worth polling for updates.
    private static readonly OzonParcelStatus[] ActiveStatuses =
    [
        OzonParcelStatus.New, OzonParcelStatus.PickedUp, OzonParcelStatus.AtHub,
        OzonParcelStatus.InTransit, OzonParcelStatus.OutForDelivery, OzonParcelStatus.Unknown
    ];

    private readonly IUnitOfWork _unitOfWork;
    private readonly OzonExpressOptions _options;
    private readonly IOzonExpressApiClient? _client;
    private readonly ILogger<OzonExpressAppService> _logger;
    private readonly IOnlineOrderService _onlineOrderService;

    public OzonExpressAppService(
        IUnitOfWork unitOfWork,
        IOptions<OzonExpressOptions> options,
        ILogger<OzonExpressAppService> logger,
        IOnlineOrderService onlineOrderService,
        IOzonExpressApiClient? client = null)
    {
        _unitOfWork = unitOfWork;
        _options = options.Value;
        _logger = logger;
        _onlineOrderService = onlineOrderService;
        _client = client;
    }

    private bool Configured => _client is not null
        && !string.IsNullOrWhiteSpace(_options.CustomerId)
        && !string.IsNullOrWhiteSpace(_options.ApiKey);

    public async Task<OzonConfigStatusDto> GetConfigStatusAsync(CancellationToken ct = default)
    {
        var cityCount = await _unitOfWork.Set<OzonCity>().CountAsync(ct);
        DateTime? updated = cityCount > 0
            ? await _unitOfWork.Set<OzonCity>().MaxAsync(c => (DateTime?)c.UpdatedAt, ct)
            : null;
        return new OzonConfigStatusDto(Configured, Configured ? _options.CustomerId : null, cityCount, updated);
    }

    public async Task<int> SyncCitiesAsync(CancellationToken ct = default)
    {
        if (_client is null) return 0;
        var apiCities = await _client.GetCitiesAsync(ct);
        if (apiCities.Count == 0) return 0;

        var existing = await _unitOfWork.Set<OzonCity>().ToDictionaryAsync(c => c.Id, ct);
        foreach (var c in apiCities)
        {
            if (existing.TryGetValue(c.Id, out var city))
            {
                city.Ref = c.Ref; city.Name = c.Name;
                city.DeliveredPrice = c.DeliveredPrice; city.ReturnedPrice = c.ReturnedPrice; city.RefusedPrice = c.RefusedPrice;
                city.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                await _unitOfWork.AddAsync(new OzonCity
                {
                    Id = c.Id, Ref = c.Ref, Name = c.Name,
                    DeliveredPrice = c.DeliveredPrice, ReturnedPrice = c.ReturnedPrice, RefusedPrice = c.RefusedPrice,
                    UpdatedAt = DateTime.UtcNow
                }, ct);
            }
        }
        await _unitOfWork.SaveChangesAsync(ct);
        return apiCities.Count;
    }

    public async Task<IReadOnlyList<OzonCityDto>> GetCitiesAsync(string? search = null, CancellationToken ct = default)
    {
        var all = await _unitOfWork.Set<OzonCity>()
            .Select(c => new OzonCityDto(c.Id, c.Ref, c.Name, c.DeliveredPrice, c.ReturnedPrice, c.RefusedPrice))
            .ToListAsync(ct);

        if (string.IsNullOrWhiteSpace(search))
            return all.OrderBy(c => c.Name).ToList();

        // Accent-insensitive filter, ranked so the closest match (exact, then prefix) surfaces first —
        // otherwise the main city ("Meknes") can get buried below dozens of alphabetically-earlier
        // suburb entries ("Agouray - Meknes", "Ain Jemaa-meknes", …) and get misclicked by mistake.
        var norm = NormalizeCityText(search);
        return all
            .Select(c => (City: c, Norm: NormalizeCityText(c.Name)))
            .Where(x => x.Norm.Contains(norm) || NormalizeCityText(x.City.Ref).Contains(norm))
            .OrderBy(x => x.Norm == norm ? 0 : x.Norm.StartsWith(norm) ? 1 : 2)
            .ThenBy(x => x.City.Name.Length)
            .ThenBy(x => x.City.Name)
            .Select(x => x.City)
            .ToList();
    }

    public async Task<OzonParcelResultDto> CreateParcelAsync(CreateOzonParcelRequest request, CancellationToken ct = default)
    {
        if (_client is null) return new OzonParcelResultDto(false, "OzonExpress non configuré", null);

        if (request.OnlineOrderId is int oid)
        {
            var existing = await _unitOfWork.Set<OzonParcel>().FirstOrDefaultAsync(p => p.OnlineOrderId == oid, ct);
            if (existing is not null)
                return new OzonParcelResultDto(false, $"Un colis existe déjà pour cette commande ({existing.TrackingNumber})", null);
        }

        var apiResult = await _client.AddParcelAsync(new OzonAddParcelRequest(
            request.Receiver, request.Phone, request.CityId, request.Address, request.Price,
            request.IsStock, Note: request.Note, Nature: request.Nature,
            Fragile: request.Fragile, AllowOpen: request.AllowOpen, CanReplace: request.CanReplace), ct);

        if (!apiResult.Ok || string.IsNullOrWhiteSpace(apiResult.TrackingNumber))
            return new OzonParcelResultDto(false, apiResult.Error ?? "Échec de création du colis", null);

        var cityName = apiResult.CityName
            ?? (await _unitOfWork.Set<OzonCity>().Where(c => c.Id == request.CityId).Select(c => c.Name).FirstOrDefaultAsync(ct));

        var parcel = new OzonParcel
        {
            OnlineOrderId = request.OnlineOrderId,
            TrackingNumber = apiResult.TrackingNumber,
            Receiver = request.Receiver,
            Phone = request.Phone,
            CityId = request.CityId,
            CityName = cityName,
            Address = request.Address,
            Note = request.Note,
            Nature = request.Nature,
            Price = request.Price,
            DeliveredPrice = apiResult.DeliveredPrice,
            ReturnedPrice = apiResult.ReturnedPrice,
            RefusedPrice = apiResult.RefusedPrice,
            IsStock = request.IsStock,
            Fragile = request.Fragile,
            AllowOpen = request.AllowOpen,
            CanReplace = request.CanReplace,
            Status = OzonParcelStatus.New,
            StatusText = "Nouveau colis",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await _unitOfWork.AddAsync(parcel, ct);

        // Reflect the shipment onto the source order (carrier + tracking + delivery fee).
        if (request.OnlineOrderId is int orderId)
        {
            var order = await _unitOfWork.Set<OnlineOrder>().FirstOrDefaultAsync(o => o.Id == orderId, ct);
            if (order is not null)
            {
                order.CarrierName = "OzonExpress";
                order.TrackingNumber = apiResult.TrackingNumber;
                if (apiResult.DeliveredPrice is decimal fee) order.DeliveryFee = fee;
                order.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _unitOfWork.SaveChangesAsync(ct);

        // Drive the order to ReadyToShip through the guarded state machine (rather than assigning
        // order.Status directly, which used to bypass reservation/loyalty logic entirely - the same
        // class of bug ConfirmedAt had here). Creating a parcel is effectively "we've confirmed this
        // order ships", so hop through Confirmed first when it hasn't been already.
        if (request.OnlineOrderId is int shipOrderId)
        {
            try
            {
                var current = await _unitOfWork.Set<OnlineOrder>().Where(o => o.Id == shipOrderId).Select(o => o.Status).FirstOrDefaultAsync(ct);
                if (current is OrderStatus.Pending or OrderStatus.Processing or OrderStatus.InventoryConflict)
                    await _onlineOrderService.UpdateStatusAsync(shipOrderId, OrderStatus.Confirmed, OrderStatusChangeSource.System, "Colis OzonExpress cree", ct);
                if (current is not OrderStatus.ReadyToShip)
                    await _onlineOrderService.UpdateStatusAsync(shipOrderId, OrderStatus.ReadyToShip, OrderStatusChangeSource.System, "Colis OzonExpress cree", ct);
            }
            catch (ArgumentException ex)
            {
                _logger.LogWarning(ex, "Could not advance order {OrderId} to ReadyToShip after parcel creation", shipOrderId);
            }
        }

        // OzonExpress auto-generates its own official BL PDF once a parcel is grouped into a saved
        // "Bon de Livraison" — create a single-parcel BL immediately so every colis has that real,
        // OzonExpress-branded PDF ready right away, instead of relying on a home-grown document.
        var (blOk, blError, _) = await CreateAndSaveDeliveryNoteAsync([apiResult.TrackingNumber], ct);
        if (!blOk)
            _logger.LogWarning("Parcel {Tracking} created but auto BL/PDF generation failed: {Error}", apiResult.TrackingNumber, blError);

        return new OzonParcelResultDto(true, null, await MapAsync(parcel.Id, ct));
    }

    public async Task<OzonParcelDto?> GetParcelByOrderIdAsync(int onlineOrderId, CancellationToken ct = default)
        => await _unitOfWork.Set<OzonParcel>().Where(p => p.OnlineOrderId == onlineOrderId).Select(ProjectDto).FirstOrDefaultAsync(ct);

    public async Task<OzonParcelResultDto> CreateParcelForOrderAsync(int onlineOrderId, CancellationToken ct = default)
    {
        if (_client is null) return new OzonParcelResultDto(false, "OzonExpress non configuré", null);

        var order = await _unitOfWork.Set<OnlineOrder>().FirstOrDefaultAsync(o => o.Id == onlineOrderId, ct);
        if (order is null) return new OzonParcelResultDto(false, "Commande introuvable", null);

        var existing = await _unitOfWork.Set<OzonParcel>().FirstOrDefaultAsync(p => p.OnlineOrderId == onlineOrderId, ct);
        if (existing is not null)
            return new OzonParcelResultDto(false, $"Un colis existe déjà pour cette commande ({existing.TrackingNumber})", await MapAsync(existing.Id, ct));

        if (string.IsNullOrWhiteSpace(order.CustomerPhone))
            return new OzonParcelResultDto(false, "Téléphone du client manquant — impossible de créer le colis automatiquement", null);
        if (string.IsNullOrWhiteSpace(order.City))
            return new OzonParcelResultDto(false, "Ville de livraison manquante — créez le colis manuellement", null);

        var cityId = await ResolveCityIdAsync(order.City, ct);
        if (cityId is null)
            return new OzonParcelResultDto(false, $"Ville « {order.City} » introuvable dans OzonExpress — créez le colis manuellement", null);

        return await CreateParcelAsync(new CreateOzonParcelRequest(
            OnlineOrderId: order.Id,
            Receiver: order.CustomerName,
            Phone: order.CustomerPhone,
            CityId: cityId.Value,
            Address: string.IsNullOrWhiteSpace(order.AddressLine) ? order.City : order.AddressLine,
            Price: order.TotalAmount,
            IsStock: false, // ramassage: the courier picks the goods up from the shop (no OzonExpress stock refs needed)
            Nature: "Chaussures"), ct);
    }

    // Best-effort match of an order's free-text city to an OzonExpress city ID. Diacritic-insensitive:
    // Shopify/customer-entered city names commonly carry accents ("Meknès", "Salé", "Fès") while
    // OzonExpress's own city catalog is plain ASCII ("Meknes", "Sale") — without normalizing both
    // sides, exact/prefix matches silently fail and fall through to a much weaker "contains" match
    // that can pick an unrelated sub-locality (wrong courier zone/fee) or fail outright.
    private async Task<int?> ResolveCityIdAsync(string cityText, CancellationToken ct)
    {
        var norm = NormalizeCityText(cityText);
        if (norm.Length == 0) return null;

        var cities = await _unitOfWork.Set<OzonCity>().Select(c => new { c.Id, c.Name }).ToListAsync(ct);
        var withNorm = cities.Select(c => (c.Id, c.Name, Norm: NormalizeCityText(c.Name))).ToList();

        // 1. exact match, 2. shortest name starting with the text, 3. shortest name containing the text.
        var exact = withNorm.FirstOrDefault(c => c.Norm == norm);
        if (exact.Name is not null) return exact.Id;

        var starts = withNorm.Where(c => c.Norm.StartsWith(norm)).OrderBy(c => c.Name.Length).FirstOrDefault();
        if (starts.Name is not null) return starts.Id;

        var contains = withNorm.Where(c => c.Norm.Contains(norm)).OrderBy(c => c.Name.Length).FirstOrDefault();
        return contains.Name is not null ? contains.Id : null;
    }

    // Lowercases and strips diacritics (é→e, è→e, ç→c, …) via Unicode normalization, so accented and
    // plain spellings of the same city compare equal.
    internal static string NormalizeCityText(string text)
    {
        var trimmed = text.Trim().ToLowerInvariant();
        var decomposed = trimmed.Normalize(System.Text.NormalizationForm.FormD);
        var sb = new System.Text.StringBuilder(decomposed.Length);
        foreach (var ch in decomposed)
            if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(ch) != System.Globalization.UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        return sb.ToString().Normalize(System.Text.NormalizationForm.FormC);
    }

    public async Task<IReadOnlyList<OzonParcelDto>> GetParcelsAsync(string? status = null, string? search = null, CancellationToken ct = default)
    {
        var q = _unitOfWork.Set<OzonParcel>().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<OzonParcelStatus>(status, true, out var st))
            q = q.Where(p => p.Status == st);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            q = q.Where(p => p.TrackingNumber.ToLower().Contains(s)
                || p.Receiver.ToLower().Contains(s)
                || p.Phone.Contains(s)
                || (p.CityName != null && p.CityName.ToLower().Contains(s)));
        }

        return await q.OrderByDescending(p => p.CreatedAt).Select(ProjectDto).ToListAsync(ct);
    }

    public async Task<OzonParcelDto?> GetParcelAsync(int id, CancellationToken ct = default) => await MapAsync(id, ct);

    public async Task<OzonTrackingDto> TrackParcelAsync(int id, CancellationToken ct = default)
    {
        var parcel = await _unitOfWork.Set<OzonParcel>().FirstOrDefaultAsync(p => p.Id == id, ct);
        if (parcel is null) return new OzonTrackingDto(false, "Colis introuvable", "", OzonParcelStatus.Unknown, null, []);
        if (_client is null) return new OzonTrackingDto(false, "OzonExpress non configuré", parcel.TrackingNumber, parcel.Status, parcel.StatusText, []);

        var result = await _client.TrackAsync(parcel.TrackingNumber, ct);
        if (result.Ok)
        {
            ApplyTracking(parcel, result);
            await _unitOfWork.SaveChangesAsync(ct);
            await ApplyOrderStatusFromParcelAsync(parcel, ct);
        }

        return new OzonTrackingDto(result.Ok, result.Error, parcel.TrackingNumber, parcel.Status, parcel.StatusText,
            result.Events.Select(e => new OzonTrackingEventDto(e.Date, e.Status, e.Comment)).ToList());
    }

    public async Task<OzonSyncTrackingResultDto> SyncAllTrackingAsync(CancellationToken ct = default)
    {
        if (_client is null) return new OzonSyncTrackingResultDto(0, 0);

        var active = await _unitOfWork.Set<OzonParcel>()
            .Where(p => ActiveStatuses.Contains(p.Status))
            .ToListAsync(ct);
        if (active.Count == 0) return new OzonSyncTrackingResultDto(0, 0);

        var updated = 0;
        // Chunk to keep each bulk request reasonable.
        foreach (var chunk in active.Chunk(50))
        {
            var map = await _client.TrackBulkAsync(chunk.Select(p => p.TrackingNumber), ct);
            var changedParcels = new List<OzonParcel>();
            foreach (var parcel in chunk)
            {
                if (!map.TryGetValue(parcel.TrackingNumber, out var res) || !res.Ok) continue;
                var before = parcel.Status;
                ApplyTracking(parcel, res);
                if (parcel.Status != before) { updated++; changedParcels.Add(parcel); }
            }
            await _unitOfWork.SaveChangesAsync(ct);

            // Write-back only for parcels whose status actually changed this round - this is the
            // step that used to be entirely missing: tracking updated the parcel but never touched
            // the order, so orders never reached Delivered and nothing downstream (loyalty, payment
            // settlement, DeliveredAt) ever fired.
            foreach (var parcel in changedParcels)
                await ApplyOrderStatusFromParcelAsync(parcel, ct);
        }

        return new OzonSyncTrackingResultDto(active.Count, updated);
    }

    public async Task<OzonDeliveryNoteResultDto> CreateDeliveryNoteAsync(CreateDeliveryNoteRequest request, CancellationToken ct = default)
    {
        var codes = request.TrackingNumbers.Where(t => !string.IsNullOrWhiteSpace(t)).Distinct().ToList();
        var (ok, error, note) = await CreateAndSaveDeliveryNoteAsync(codes, ct);
        return ok ? new OzonDeliveryNoteResultDto(true, null, MapNote(note!)) : new OzonDeliveryNoteResultDto(false, error, null);
    }

    // Core 4-step OzonExpress "Bon de Livraison" flow (create → add parcels → save → persist locally),
    // shared by the manual multi-parcel "Créer BL" action and the automatic single-parcel BL created
    // right after every colis so its official OzonExpress PDF is available immediately.
    private async Task<(bool Ok, string? Error, OzonDeliveryNote? Note)> CreateAndSaveDeliveryNoteAsync(List<string> codes, CancellationToken ct)
    {
        if (_client is null) return (false, "OzonExpress non configuré", null);
        if (codes.Count == 0) return (false, "Aucun colis sélectionné", null);

        var create = await _client.CreateDeliveryNoteAsync(ct);
        if (!create.Ok || string.IsNullOrWhiteSpace(create.Ref))
            return (false, create.Error ?? "Échec de création du BL", null);

        var added = await _client.AddParcelsToDeliveryNoteAsync(create.Ref, codes, ct);
        if (!added) return (false, "Échec d'ajout des colis au BL", null);

        // Give OzonExpress a moment to register the added parcels before saving the BL.
        await Task.Delay(1200, ct);
        var saved = await _client.SaveDeliveryNoteAsync(create.Ref, ct);

        var note = new OzonDeliveryNote
        {
            Ref = create.Ref,
            Status = saved ? OzonDeliveryNoteStatus.Saved : OzonDeliveryNoteStatus.Draft,
            ParcelCount = codes.Count,
            CreatedAt = DateTime.UtcNow,
            SavedAt = saved ? DateTime.UtcNow : null
        };
        await _unitOfWork.AddAsync(note, ct);

        // Stamp the BL reference onto the included parcels.
        var parcels = await _unitOfWork.Set<OzonParcel>().Where(p => codes.Contains(p.TrackingNumber)).ToListAsync(ct);
        foreach (var p in parcels) { p.DeliveryNoteRef = create.Ref; p.UpdatedAt = DateTime.UtcNow; }

        await _unitOfWork.SaveChangesAsync(ct);
        return (true, null, note);
    }

    public async Task<IReadOnlyList<OzonDeliveryNoteDto>> GetDeliveryNotesAsync(CancellationToken ct = default)
    {
        var notes = await _unitOfWork.Set<OzonDeliveryNote>().OrderByDescending(n => n.CreatedAt).ToListAsync(ct);
        return notes.Select(MapNote).ToList();
    }

    public async Task<OzonDashboardDto> GetDashboardAsync(CancellationToken ct = default)
    {
        var parcels = await _unitOfWork.Set<OzonParcel>().Select(ProjectDto).ToListAsync(ct);
        var noteCount = await _unitOfWork.Set<OzonDeliveryNote>().CountAsync(ct);

        var delivered = parcels.Where(p => p.Status == OzonParcelStatus.Delivered).ToList();
        var inTransit = parcels.Count(p => p.Status is OzonParcelStatus.PickedUp or OzonParcelStatus.AtHub or OzonParcelStatus.InTransit or OzonParcelStatus.OutForDelivery);
        var pending = parcels.Count(p => p.Status == OzonParcelStatus.New);

        var topCities = parcels
            .Where(p => !string.IsNullOrWhiteSpace(p.CityName))
            .GroupBy(p => p.CityName!)
            .Select(g => new OzonCityStatDto(g.Key, g.Count(), g.Sum(p => p.Price)))
            .OrderByDescending(c => c.Count)
            .Take(8)
            .ToList();

        return new OzonDashboardDto(
            Configured: Configured,
            TotalParcels: parcels.Count,
            InTransit: inTransit,
            Delivered: delivered.Count,
            Returned: parcels.Count(p => p.Status == OzonParcelStatus.Returned),
            Refused: parcels.Count(p => p.Status == OzonParcelStatus.Refused),
            Pending: pending,
            CodPending: parcels.Where(p => p.Status != OzonParcelStatus.Delivered && p.Status != OzonParcelStatus.Returned && p.Status != OzonParcelStatus.Refused && p.Status != OzonParcelStatus.Cancelled).Sum(p => p.Price),
            CodCollected: delivered.Sum(p => p.Price),
            CourierFees: delivered.Sum(p => p.DeliveredPrice ?? 0),
            DeliveryNoteCount: noteCount,
            RecentParcels: parcels.OrderByDescending(p => p.CreatedAt).Take(8).ToList(),
            TopCities: topCities);
    }

    // ── helpers ──

    private void ApplyTracking(OzonParcel parcel, OzonTrackingResult result)
    {
        parcel.StatusText = result.Status ?? parcel.StatusText;
        parcel.Status = MapStatus(result.Status) is var mapped && mapped != OzonParcelStatus.Unknown ? mapped : parcel.Status;
        parcel.LastTrackingRaw = result.Raw;
        parcel.LastSyncedAt = DateTime.UtcNow;
        parcel.UpdatedAt = DateTime.UtcNow;
    }

    // The missing link: courier tracking used to update OzonParcel.Status and stop there - the
    // OnlineOrder itself was never touched, so an order could sit at ReadyToShip forever even
    // after the courier's own system showed it delivered weeks ago. Nothing downstream (loyalty
    // award, DeliveredAt timestamp, payment settlement) ever fired as a result.
    private async Task ApplyOrderStatusFromParcelAsync(OzonParcel parcel, CancellationToken ct)
    {
        if (parcel.OnlineOrderId is not int orderId) return;

        OrderStatus? target = parcel.Status switch
        {
            OzonParcelStatus.PickedUp or OzonParcelStatus.AtHub or OzonParcelStatus.InTransit or OzonParcelStatus.OutForDelivery => OrderStatus.Shipped,
            OzonParcelStatus.Delivered => OrderStatus.Delivered,
            OzonParcelStatus.Returned => OrderStatus.Returned,
            OzonParcelStatus.Refused => OrderStatus.Refused,
            // New/Unknown: nothing to reflect yet. Cancelled: a courier-side cancellation is not
            // the same thing as the customer cancelling - flag it for manual review via the log
            // rather than silently cancelling a live order out from under the business.
            _ => null
        };
        if (target is null) return;

        try
        {
            var updatedOrder = await _onlineOrderService.UpdateStatusAsync(
                orderId, target.Value, OrderStatusChangeSource.Courier,
                $"OzonExpress: {parcel.StatusText ?? parcel.Status.ToString()}", ct);

            if (target == OrderStatus.Delivered && updatedOrder is not null)
                await _onlineOrderService.MarkPaidAsync(orderId, parcel.Price, ct);
        }
        catch (ArgumentException ex)
        {
            // Illegal transition for this order's current state (e.g. it was already manually
            // moved past this point) - log and continue rather than aborting the whole sync batch
            // over one order.
            _logger.LogWarning(ex, "Skipped courier status write-back for order {OrderId}: {Message}", orderId, ex.Message);
        }
    }

    private async Task<OzonParcelDto?> MapAsync(int id, CancellationToken ct)
        => await _unitOfWork.Set<OzonParcel>().Where(p => p.Id == id).Select(ProjectDto).FirstOrDefaultAsync(ct);

    private OzonDeliveryNoteDto MapNote(OzonDeliveryNote n) => new(
        n.Id, n.Ref, n.Status, n.ParcelCount, n.CreatedAt, n.SavedAt,
        $"https://client.ozoneexpress.ma/pdf-delivery-note?dn-ref={n.Ref}",
        $"https://client.ozoneexpress.ma/pdf-delivery-note-tickets?dn-ref={n.Ref}",
        $"https://client.ozoneexpress.ma/pdf-delivery-note-tickets-4-4?dn-ref={n.Ref}");

    // EF-translatable projection (navigation properties only).
    private static readonly System.Linq.Expressions.Expression<Func<OzonParcel, OzonParcelDto>> ProjectDto = p => new OzonParcelDto(
        p.Id, p.OnlineOrderId, p.OnlineOrder != null ? p.OnlineOrder.OrderNumber : null,
        p.TrackingNumber, p.Receiver, p.Phone, p.CityId, p.CityName, p.Address, p.Note, p.Nature,
        p.Price, p.DeliveredPrice, p.ReturnedPrice, p.RefusedPrice, p.IsStock, p.Fragile,
        p.Status, p.StatusText, p.DeliveryNoteRef, p.LastSyncedAt, p.CreatedAt);

    // Heuristic mapping of OzonExpress's free-text status (FR/EN) to our enum.
    private static OzonParcelStatus MapStatus(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return OzonParcelStatus.Unknown;
        var t = text.ToLowerInvariant();
        if (t.Contains("livr") && !t.Contains("cours") && !t.Contains("mise en") && !t.Contains("attente")) return OzonParcelStatus.Delivered;
        if (t.Contains("retour")) return OzonParcelStatus.Returned;
        if (t.Contains("refus")) return OzonParcelStatus.Refused;
        if (t.Contains("annul") || t.Contains("cancel")) return OzonParcelStatus.Cancelled;
        if (t.Contains("cours de livr") || t.Contains("en livraison") || t.Contains("out for") || t.Contains("distribution")) return OzonParcelStatus.OutForDelivery;
        if (t.Contains("hub") || t.Contains("centre") || t.Contains("reçu") || t.Contains("recu") || t.Contains("réceptionné")) return OzonParcelStatus.AtHub;
        if (t.Contains("transit") || t.Contains("expédi") || t.Contains("route")) return OzonParcelStatus.InTransit;
        // "Attente de ramassage" = awaiting pickup → still New, not yet picked up.
        if (t.Contains("attente") && t.Contains("ramass")) return OzonParcelStatus.New;
        if (t.Contains("ramass") || t.Contains("pris en charge") || t.Contains("picked") || t.Contains("collect")) return OzonParcelStatus.PickedUp;
        if (t.Contains("nouveau") || t.Contains("new") || t.Contains("créé") || t.Contains("cree")) return OzonParcelStatus.New;
        return OzonParcelStatus.Unknown;
    }
}
