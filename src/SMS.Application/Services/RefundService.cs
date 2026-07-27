using Microsoft.EntityFrameworkCore;
using SMS.Application.DTOs.Refunds;
using SMS.Application.DTOs.Stock;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class RefundService : IRefundService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockService _stockService;

    public RefundService(IUnitOfWork unitOfWork, IStockService stockService)
    {
        _unitOfWork = unitOfWork;
        _stockService = stockService;
    }

    private IQueryable<Refund> RefundQuery =>
        _unitOfWork.Set<Refund>()
            .Include(r => r.Items).ThenInclude(ri => ri.ProductVariant).ThenInclude(pv => pv!.Product)
            .Include(r => r.Items).ThenInclude(ri => ri.ProductVariant).ThenInclude(pv => pv!.Color)
            .Include(r => r.Items).ThenInclude(ri => ri.ProductVariant).ThenInclude(pv => pv!.Size)
            .Include(r => r.Items).ThenInclude(ri => ri.SaleItem)
            .Include(r => r.ExchangeItems).ThenInclude(ei => ei.ProductVariant).ThenInclude(pv => pv!.Product)
            .Include(r => r.ExchangeItems).ThenInclude(ei => ei.ProductVariant).ThenInclude(pv => pv!.Color)
            .Include(r => r.ExchangeItems).ThenInclude(ei => ei.ProductVariant).ThenInclude(pv => pv!.Size)
            .Include(r => r.Sale)
            .Include(r => r.Client);

    public async Task<SaleForRefundDto?> GetSaleForRefundAsync(int saleId, CancellationToken ct = default)
    {
        var sale = await _unitOfWork.Sales.GetWithItemsAsync(saleId, ct);
        if (sale is null) return null;

        var saleItemIds = sale.Items.Select(si => si.Id).ToList();
        var refundedQuantities = (await _unitOfWork.FindAsync<RefundItem>(
            ri => saleItemIds.Contains(ri.SaleItemId), ct))
            .GroupBy(ri => ri.SaleItemId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));

        return new SaleForRefundDto
        {
            Id = sale.Id,
            SaleNumber = sale.SaleNumber,
            ClientName = sale.Client?.Name,
            ClientId = sale.ClientId,
            TotalAmount = sale.TotalAmount,
            AmountPaid = sale.AmountPaid,
            PaymentMethod = sale.PaymentMethod.ToString(),
            Status = sale.Status.ToString(),
            CreatedAt = sale.CreatedAt,
            Items = sale.Items.Select(si => new SaleItemForRefundDto
            {
                Id = si.Id,
                ProductVariantId = si.ProductVariantId,
                ProductName = si.ProductVariant?.Product?.Name ?? "",
                ProductSku = si.ProductVariant?.Sku,
                ColorName = si.ProductVariant?.Color?.Name,
                SizeValue = si.ProductVariant?.Size?.Value,
                Quantity = si.Quantity,
                UnitPrice = si.UnitPrice,
                LineTotal = si.LineTotal,
                AlreadyRefundedQuantity = refundedQuantities.GetValueOrDefault(si.Id, 0)
            }).ToList()
        };
    }

    public async Task<IReadOnlyList<RefundDto>> GetAllAsync(CancellationToken ct = default)
    {
        var refunds = await RefundQuery.OrderByDescending(r => r.RefundDate).ToListAsync(ct);
        return refunds.Select(MapToDto).ToList();
    }

    public async Task<RefundDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var refund = await RefundQuery.FirstOrDefaultAsync(r => r.Id == id, ct);
        return refund is null ? null : MapToDto(refund);
    }

    public async Task<RefundDto> CreateAsync(CreateRefundRequest request, int? processedByUserId, CancellationToken ct = default)
    {
        var sale = await _unitOfWork.Sales.GetWithItemsAsync(request.SaleId, ct);
        if (sale is null)
            throw new InvalidOperationException("Vente introuvable");

        if (request.Items.Count == 0 && request.ExchangeItems.Count == 0)
            throw new InvalidOperationException("Aucun article sélectionné");

        if (request.Type == "Exchange" && request.ExchangeItems.Count == 0)
            throw new InvalidOperationException("Veuillez sélectionner les articles de remplacement");

        var refund = new Refund
        {
            RefundNumber = $"{(request.Type == "Exchange" ? "ECH" : "RBF")}-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}",
            SaleId = request.SaleId,
            Type = request.Type,
            Status = "Pending",
            Reason = request.Reason ?? "",
            Notes = request.Notes,
            ClientId = sale.ClientId,
            ProcessedByUserId = processedByUserId,
            RefundDate = DateTime.UtcNow
        };

        decimal totalRefund = 0;

        foreach (var item in request.Items)
        {
            var saleItem = sale.Items.FirstOrDefault(si => si.Id == item.SaleItemId);
            if (saleItem is null)
                throw new InvalidOperationException($"Article de vente {item.SaleItemId} introuvable");

            var existingRefunds = await _unitOfWork.FindAsync<RefundItem>(
                ri => ri.SaleItemId == item.SaleItemId, ct);
            var alreadyRefunded = existingRefunds.Sum(ri => ri.Quantity);

            var available = saleItem.Quantity - alreadyRefunded;
            if (item.Quantity > available)
                throw new InvalidOperationException($"Quantité disponible dépassée pour {saleItem.ProductVariant?.Product?.Name}");

            var refundItem = new RefundItem
            {
                SaleItemId = item.SaleItemId,
                ProductVariantId = saleItem.ProductVariantId,
                ProductName = saleItem.ProductVariant?.Product?.Name ?? "",
                Quantity = item.Quantity,
                UnitPrice = saleItem.UnitPrice,
                RefundAmount = item.Quantity * saleItem.UnitPrice,
                Reason = item.Reason
            };

            refund.Items.Add(refundItem);
            totalRefund += refundItem.RefundAmount;
        }

        refund.TotalRefundAmount = totalRefund;

        decimal totalExchange = 0;
        foreach (var item in request.ExchangeItems)
        {
            var variants = await _unitOfWork.Set<ProductVariant>()
                .Include(v => v.Product)
                .Include(v => v.Color)
                .Include(v => v.Size)
                .Include(v => v.StockItem)
                .Where(v => v.Id == item.ProductVariantId)
                .ToListAsync(ct);
            var variant = variants.FirstOrDefault();
            if (variant is null)
                throw new InvalidOperationException($"Variante {item.ProductVariantId} introuvable");

            var stock = variant.StockItem?.QuantityOnHand ?? 0;
            if (item.Quantity > stock)
                throw new InvalidOperationException($"Stock insuffisant pour {variant.Product?.Name} ({variant.Color?.Name} {variant.Size?.Value}): {stock} disponible(s)");

            var exchangeItem = new ExchangeItem
            {
                ProductVariantId = item.ProductVariantId,
                ProductName = $"{variant.Product?.Name ?? ""} - {variant.Color?.Name ?? ""} {variant.Size?.Value ?? ""}",
                Quantity = item.Quantity,
                UnitPrice = variant.Product?.Price ?? 0,
                TotalPrice = item.Quantity * (variant.Product?.Price ?? 0)
            };

            refund.ExchangeItems.Add(exchangeItem);
            totalExchange += exchangeItem.TotalPrice;
        }

        refund.TotalExchangeAmount = totalExchange;
        refund.PriceDifference = totalExchange - totalRefund;

        await _unitOfWork.AddAsync(refund, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return MapToDto(refund);
    }

    public async Task<RefundDto?> ProcessAsync(int id, CancellationToken ct = default)
    {
        var refund = await RefundQuery.FirstOrDefaultAsync(r => r.Id == id, ct);

        if (refund is null || refund.Status != "Pending")
            return null;

        await _unitOfWork.BeginTransactionAsync(ct);
        try
        {
            foreach (var item in refund.Items)
            {
                await _stockService.AdjustStockAsync(
                    new AdjustStockRequest
                    {
                        ProductVariantId = item.ProductVariantId,
                        AdjustmentDelta = item.Quantity,
                        Notes = $"Retour {(refund.Type == "Exchange" ? "échange" : "remboursement")} {refund.RefundNumber} - {item.ProductName}",
                        Reference = refund.RefundNumber
                    },
                    ct: ct);
            }

            if (refund.Type == "Exchange")
            {
                foreach (var item in refund.ExchangeItems)
                {
                    await _stockService.AdjustStockAsync(
                        new AdjustStockRequest
                        {
                            ProductVariantId = item.ProductVariantId,
                            AdjustmentDelta = -item.Quantity,
                            Notes = $"Échange sortant {refund.RefundNumber} - {item.ProductName}",
                            Reference = refund.RefundNumber
                        },
                        ct: ct);
                }
            }

            refund.Status = "Completed";
            refund.UpdatedAt = DateTime.UtcNow;
            await _unitOfWork.SaveChangesAsync(ct);
            await _unitOfWork.CommitTransactionAsync(ct);
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(ct);
            throw;
        }

        var receiptBarcodes = await _unitOfWork.FindAsync<ReceiptBarcode>(
            rb => rb.SaleId == refund.SaleId && !rb.IsUsed, ct);
        var receiptBarcode = receiptBarcodes.FirstOrDefault();
        if (receiptBarcode is not null)
        {
            await _unitOfWork.Sales.MarkReceiptBarcodeUsedAsync(receiptBarcode.Barcode, ct);
        }

        return MapToDto(refund);
    }

    public async Task<RefundDto?> CancelAsync(int id, CancellationToken ct = default)
    {
        var refund = await RefundQuery.FirstOrDefaultAsync(r => r.Id == id, ct);

        if (refund is null || refund.Status != "Pending")
            return null;

        refund.Status = "Cancelled";
        refund.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);

        return MapToDto(refund);
    }

    public async Task<IReadOnlyList<ProductVariantForExchangeDto>> SearchVariantsForExchangeAsync(string query, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Length < 2)
            return [];

        var q = query.ToLowerInvariant();
        var variants = await _unitOfWork.Set<ProductVariant>()
            .Include(v => v.Product)
            .Include(v => v.Color)
            .Include(v => v.Size)
            .Include(v => v.StockItem)
            .Where(v => v.IsActive)
            .ToListAsync(ct);

        var results = variants
            .Where(v =>
                (v.Product?.Name ?? "").ToLower().Contains(q) ||
                v.Sku.ToLower().Contains(q) ||
                (v.Barcode ?? "").ToLower().Contains(q) ||
                (v.Color?.Name ?? "").ToLower().Contains(q) ||
                (v.Size?.Value ?? "").ToLower().Contains(q))
            .Take(20)
            .Select(v => new ProductVariantForExchangeDto
            {
                Id = v.Id,
                ProductId = v.ProductId,
                ProductName = v.Product?.Name ?? "",
                ProductDescription = v.Product?.Description,
                Sku = v.Sku,
                Barcode = v.Barcode,
                ImageUrl = v.ImageUrl,
                ColorName = v.Color?.Name ?? "",
                ColorHexCode = v.Color?.HexCode ?? "#000000",
                SizeValue = v.Size?.Value ?? "",
                Price = v.Product?.Price ?? 0,
                StockQuantity = v.StockItem?.QuantityOnHand ?? 0
            })
            .ToList();

        return results;
    }

    public async Task<SaleForRefundDto?> ScanReceiptBarcodeAsync(string barcode, CancellationToken ct = default)
    {
        var receiptBarcode = await _unitOfWork.Sales.GetReceiptBarcodeAsync(barcode, ct);
        if (receiptBarcode is null)
            return null;

        if (receiptBarcode.ExpiresAt < DateTime.UtcNow)
            throw new InvalidOperationException("Ce bon a expire (delai de 15 jours depasse)");

        if (receiptBarcode.IsUsed)
            throw new InvalidOperationException("Ce bon a deja ete utilise pour un remboursement ou echange");

        return await GetSaleForRefundAsync(receiptBarcode.SaleId, ct);
    }

    public async Task<IReadOnlyList<SaleForRefundDto>> ScanClientQrCodeAsync(string clientQrCode, CancellationToken ct = default)
    {
        var since = DateTime.UtcNow.AddDays(-15);
        var sales = await _unitOfWork.Sales.GetSalesByClientQrCodeAsync(clientQrCode, since, ct);

        var result = new List<SaleForRefundDto>();
        foreach (var sale in sales)
        {
            var dto = await GetSaleForRefundAsync(sale.Id, ct);
            if (dto is not null)
                result.Add(dto);
        }
        return result;
    }

    private static RefundDto MapToDto(Refund r) => new()
    {
        Id = r.Id,
        RefundNumber = r.RefundNumber,
        SaleId = r.SaleId,
        SaleNumber = r.Sale?.SaleNumber ?? string.Empty,
        Type = r.Type,
        Status = r.Status,
        TotalRefundAmount = r.TotalRefundAmount,
        TotalExchangeAmount = r.TotalExchangeAmount,
        PriceDifference = r.PriceDifference,
        Reason = r.Reason,
        Notes = r.Notes,
        ClientId = r.ClientId,
        ClientName = r.Client?.Name,
        RefundDate = r.RefundDate,
        Items = r.Items.Select(ri => new RefundItemDto
        {
            Id = ri.Id,
            SaleItemId = ri.SaleItemId,
            ProductVariantId = ri.ProductVariantId,
            ProductName = ri.ProductName,
            ProductSku = ri.ProductVariant?.Sku,
            ColorName = ri.ProductVariant?.Color?.Name,
            SizeValue = ri.ProductVariant?.Size?.Value,
            Quantity = ri.Quantity,
            UnitPrice = ri.UnitPrice,
            RefundAmount = ri.RefundAmount,
            Reason = ri.Reason
        }).ToList(),
        ExchangeItems = r.ExchangeItems.Select(ei => new ExchangeItemDto
        {
            Id = ei.Id,
            ProductVariantId = ei.ProductVariantId,
            ProductName = ei.ProductName,
            ProductSku = ei.ProductVariant?.Sku,
            ColorName = ei.ProductVariant?.Color?.Name,
            SizeValue = ei.ProductVariant?.Size?.Value,
            Quantity = ei.Quantity,
            UnitPrice = ei.UnitPrice,
            TotalPrice = ei.TotalPrice
        }).ToList()
    };
}
