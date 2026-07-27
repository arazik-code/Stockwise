using SMS.Application.DTOs.Fournisseurs;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class FournisseurAppService : IFournisseurService
{
    private static readonly OrderStatus[] SoldStatuses = [OrderStatus.Delivered, OrderStatus.Processing];

    private readonly IUnitOfWork _unitOfWork;

    public FournisseurAppService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IReadOnlyList<FournisseurDto>> GetAllAsync(CancellationToken ct = default)
    {
        var fournisseurs = await _unitOfWork.Fournisseurs.GetAllAsync(ct);
        return fournisseurs.Select(f => MapToDto(f, f.Products.Count)).ToList();
    }

    public async Task<FournisseurDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var f = await _unitOfWork.Fournisseurs.GetByIdAsync(id, ct);
        return f is null ? null : MapToDto(f, f.Products.Count);
    }

    public async Task<FournisseurDto> CreateAsync(CreateFournisseurRequest request, CancellationToken ct = default)
    {
        var f = new Fournisseur
        {
            Nom = request.Nom,
            Contact = request.Contact,
            Email = request.Email,
            Telephone = request.Telephone,
            Adresse = request.Adresse
        };
        await _unitOfWork.Fournisseurs.AddAsync(f, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        return MapToDto(f, 0);
    }

    public async Task<FournisseurDto?> UpdateAsync(int id, UpdateFournisseurRequest request, CancellationToken ct = default)
    {
        var f = await _unitOfWork.Fournisseurs.GetByIdAsync(id, ct);
        if (f is null) return null;

        if (request.Nom is not null) f.Nom = request.Nom;
        if (request.Contact is not null) f.Contact = request.Contact;
        if (request.Email is not null) f.Email = request.Email;
        if (request.Telephone is not null) f.Telephone = request.Telephone;
        if (request.Adresse is not null) f.Adresse = request.Adresse;
        f.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Fournisseurs.Update(f);
        await _unitOfWork.SaveChangesAsync(ct);
        return MapToDto(f, f.Products.Count);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        var f = await _unitOfWork.Fournisseurs.GetByIdAsync(id, ct);
        if (f is null) return false;
        if (f.Products.Count > 0) return false;

        var invoices = await _unitOfWork.FindAsync<Invoice>(i => i.FournisseurId == id, ct);
        if (invoices.Count > 0) return false;

        _unitOfWork.Fournisseurs.Delete(f);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<IReadOnlyList<FournisseurPerformanceDto>> GetPerformanceAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var prevMonthStart = monthStart.AddMonths(-1);

        var fournisseurs = await _unitOfWork.Fournisseurs.GetAllAsync(ct);
        var sales = await _unitOfWork.Sales.GetAllAsync(ct);
        var stockItems = await _unitOfWork.Stock.GetAllWithVariantAsync(ct);
        var invoices = await _unitOfWork.Invoices.GetAllAsync(ct);

        var soldItems = sales
            .Where(s => SoldStatuses.Contains(s.Status))
            .SelectMany(s => s.Items.Select(i => new
            {
                FournisseurId = i.ProductVariant?.Product?.FournisseurId,
                ProductVariantId = i.ProductVariantId,
                ProductName = i.ProductVariant?.Product?.Name ?? string.Empty,
                CostPrice = i.ProductVariant?.Product?.CostPrice,
                i.Quantity,
                i.LineTotal,
                s.CreatedAt
            }))
            .Where(i => i.FournisseurId != null)
            .ToList();

        var stockLookup = stockItems.ToDictionary(s => s.ProductVariantId, s => s.QuantityOnHand);

        var unpaidByFournisseur = invoices
            .Where(i => i.Status != InvoiceStatus.Paid.ToString() && i.Status != InvoiceStatus.Cancelled.ToString())
            .GroupBy(i => i.FournisseurId)
            .ToDictionary(g => g.Key, g => g.Sum(i => i.TotalAmount - i.PaidAmount));

        var result = new List<FournisseurPerformanceDto>();

        foreach (var f in fournisseurs)
        {
            var items = soldItems.Where(i => i.FournisseurId == f.Id).ToList();
            var revenuTotal = items.Sum(i => i.LineTotal);
            var beneficeTotal = items.Sum(i => i.LineTotal - (i.CostPrice ?? 0) * i.Quantity);
            var unitesVendues = items.Sum(i => i.Quantity);
            var margePct = revenuTotal > 0 ? Math.Round(beneficeTotal / revenuTotal * 100, 1) : 0;

            var currentStock = items.Select(i => i.ProductVariantId).Distinct()
                .Sum(vid => stockLookup.GetValueOrDefault(vid, 0));
            var tauxEcoulement = (unitesVendues + currentStock) > 0
                ? Math.Round((decimal)unitesVendues / (unitesVendues + currentStock) * 100, 1)
                : 0;
            var rotationStock = currentStock > 0 ? Math.Round((decimal)unitesVendues / currentStock, 2) : unitesVendues;

            var topProduits = items
                .GroupBy(i => new { i.ProductVariantId, i.ProductName })
                .Select(g => new TopProductFournisseurDto
                {
                    ProductId = g.Key.ProductVariantId,
                    ProductName = g.Key.ProductName,
                    QuantiteVendue = g.Sum(x => x.Quantity),
                    Revenu = g.Sum(x => x.LineTotal)
                })
                .OrderByDescending(p => p.Revenu)
                .Take(3)
                .ToList();

            var revenuCeMois = items.Where(i => i.CreatedAt >= monthStart).Sum(i => i.LineTotal);
            var revenuMoisDernier = items.Where(i => i.CreatedAt >= prevMonthStart && i.CreatedAt < monthStart).Sum(i => i.LineTotal);
            var tendance = revenuMoisDernier == 0
                ? (revenuCeMois > 0 ? "hausse" : "stable")
                : revenuCeMois > revenuMoisDernier * 1.05m ? "hausse"
                    : revenuCeMois < revenuMoisDernier * 0.95m ? "baisse"
                    : "stable";

            var actionRecommendee = tendance == "hausse" && tauxEcoulement > 60
                ? "Augmenter les commandes"
                : tendance == "baisse" && tauxEcoulement < 30
                    ? "Réduire les commandes"
                    : "Maintenir le niveau actuel";

            result.Add(new FournisseurPerformanceDto
            {
                Id = f.Id,
                Nom = f.Nom,
                RevenuTotal = revenuTotal,
                BeneficeTotal = beneficeTotal,
                UnitesVendues = unitesVendues,
                MargePct = margePct,
                TauxEcoulement = tauxEcoulement,
                RotationStock = rotationStock,
                TopProduits = topProduits,
                Tendance = tendance,
                ActionRecommendee = actionRecommendee,
                BalanceImpayee = unpaidByFournisseur.GetValueOrDefault(f.Id, 0)
            });
        }

        return result.OrderByDescending(r => r.RevenuTotal).ToList();
    }

    public async Task<IReadOnlyList<FournisseurRecommendationDto>> GetRecommendationsAsync(CancellationToken ct = default)
    {
        var performance = await GetPerformanceAsync(ct);
        var withSales = performance.Where(p => p.UnitesVendues > 0).ToList();
        if (withSales.Count == 0) return [];

        var maxRevenu = withSales.Max(p => p.RevenuTotal);
        var maxMarge = Math.Max(withSales.Max(p => p.MargePct), 0.01m);
        var maxEcoulement = Math.Max(withSales.Max(p => p.TauxEcoulement), 0.01m);
        var maxRotation = Math.Max(withSales.Max(p => p.RotationStock), 0.01m);

        var recommendations = withSales.Select(p =>
        {
            var revenuScore = maxRevenu > 0 ? p.RevenuTotal / maxRevenu * 100 : 0;
            var margeScore = p.MargePct / maxMarge * 100;
            var ecoulementScore = p.TauxEcoulement / maxEcoulement * 100;
            var rotationScore = p.RotationStock / maxRotation * 100;

            var score = Math.Round(
                revenuScore * 0.40m + margeScore * 0.25m + ecoulementScore * 0.20m + rotationScore * 0.15m, 1);

            var raisons = new List<string>();
            if (revenuScore >= 70) raisons.Add("Revenu élevé");
            if (margeScore >= 70) raisons.Add("Bonne marge");
            if (ecoulementScore >= 70) raisons.Add("Fort taux d'écoulement");
            if (rotationScore >= 70) raisons.Add("Rotation de stock rapide");
            if (p.Tendance == "hausse") raisons.Add("Tendance à la hausse");
            if (raisons.Count == 0) raisons.Add("Performance correcte");

            return new FournisseurRecommendationDto
            {
                FournisseurId = p.Id,
                Nom = p.Nom,
                Score = score,
                Raisons = raisons
            };
        })
        .OrderByDescending(r => r.Score)
        .ToList();

        return recommendations;
    }

    private static FournisseurDto MapToDto(Fournisseur f, int produitsCount)
        => new(f.Id, f.Nom, f.Contact, f.Email, f.Telephone, f.Adresse, produitsCount);

    public async Task<ReceiveDeliveryResponse> ReceiveDeliveryAsync(int fournisseurId, ReceiveDeliveryRequest request, int? userId = null, CancellationToken ct = default)
    {
        var fournisseur = await _unitOfWork.Fournisseurs.GetByIdAsync(fournisseurId, ct)
            ?? throw new KeyNotFoundException($"Fournisseur {fournisseurId} not found");

        int totalAdded = 0;

        foreach (var item in request.Items)
        {
            if (item.Quantity <= 0) continue;

            var stockItem = await _unitOfWork.Stock.GetByVariantIdAsync(item.ProductVariantId, ct);

            if (stockItem is null)
            {
                stockItem = new StockItem
                {
                    ProductVariantId = item.ProductVariantId,
                    QuantityOnHand = item.Quantity,
                    QuantityReserved = 0,
                    ReorderLevel = 5,
                    ReorderQuantity = 20,
                    LastUpdatedAt = DateTime.UtcNow
                };
                await _unitOfWork.Stock.AddItemAsync(stockItem, ct);
            }
            else
            {
                stockItem.QuantityOnHand += item.Quantity;
                stockItem.LastUpdatedAt = DateTime.UtcNow;
            }

            var movement = new StockMovement
            {
                ProductVariantId = item.ProductVariantId,
                Type = StockMovementType.Purchase,
                QuantityChange = item.Quantity,
                QuantityAfter = stockItem.QuantityOnHand,
                Reference = request.Reference,
                Notes = $"Réception fournisseur: {fournisseur.Nom}" + (request.Notes != null ? $" - {request.Notes}" : ""),
                UserId = userId
            };
            await _unitOfWork.Stock.AddMovementAsync(movement, ct);

            totalAdded += item.Quantity;
        }

        await _unitOfWork.SaveChangesAsync(ct);

        return new ReceiveDeliveryResponse(request.Items.Count(i => i.Quantity > 0), totalAdded);
    }
}
