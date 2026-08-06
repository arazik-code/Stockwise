using SMS.Application.DTOs.Invoices;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class InvoiceAppService : IInvoiceService
{
    private readonly IUnitOfWork _unitOfWork;

    public InvoiceAppService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IReadOnlyList<InvoiceDto>> GetAllAsync(CancellationToken ct = default)
    {
        var invoices = await _unitOfWork.Invoices.GetAllAsync(ct);
        return invoices.OrderByDescending(i => i.CreatedAt).Select(MapToDto).ToList();
    }

    public async Task<InvoiceDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var invoice = await _unitOfWork.Invoices.GetByIdAsync(id, ct);
        return invoice is null ? null : MapToDto(invoice);
    }

    public async Task<IReadOnlyList<InvoiceDto>> GetByFournisseurAsync(int fournisseurId, CancellationToken ct = default)
    {
        var invoices = await _unitOfWork.Invoices.GetByFournisseurAsync(fournisseurId, ct);
        return invoices.OrderByDescending(i => i.CreatedAt).Select(MapToDto).ToList();
    }

    public async Task<IReadOnlyList<InvoiceDto>> SearchAsync(
        string? query, string? status, int? fournisseurId, CancellationToken ct = default)
    {
        var invoices = await _unitOfWork.Invoices.GetAllAsync(ct);

        if (!string.IsNullOrWhiteSpace(query))
        {
            var q = query.ToLowerInvariant();
            invoices = invoices.Where(i =>
                i.InvoiceNumber.Contains(q) ||
                (i.Fournisseur?.Nom ?? string.Empty).Contains(q) ||
                (i.Reference ?? string.Empty).Contains(q) ||
                (i.Notes ?? string.Empty).Contains(q))
                .ToList();
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
        {
            invoices = invoices.Where(i => i.Status == status).ToList();
        }

        if (fournisseurId.HasValue && fournisseurId > 0)
        {
            invoices = invoices.Where(i => i.FournisseurId == fournisseurId.Value).ToList();
        }

        return invoices.OrderByDescending(i => i.CreatedAt).Select(MapToDto).ToList();
    }

    public async Task<InvoiceDto> CreateAsync(CreateInvoiceRequest request, int? userId = null, CancellationToken ct = default)
    {
        if (request.Items.Count == 0)
            throw new ArgumentException("Une facture doit contenir au moins un article");

        var nextNumber = await _unitOfWork.Invoices.GetMaxInvoiceNumberAsync(ct) + 1;
        var invoiceNumber = $"INV-{nextNumber:D6}";
        var invoiceDate = request.InvoiceDate.HasValue
            ? DateTime.SpecifyKind(request.InvoiceDate.Value, DateTimeKind.Utc)
            : DateTime.UtcNow;

        DateTime? dueDate = request.DueDate.HasValue
            ? DateTime.SpecifyKind(request.DueDate.Value, DateTimeKind.Utc)
            : null;
        if (!dueDate.HasValue && request.PaymentTerms != "Comptant")
        {
            var days = request.PaymentTerms switch
            {
                "Net15" => 15,
                "Net30" => 30,
                "Net45" => 45,
                "Net60" => 60,
                "Net90" => 90,
                _ => 0
            };
            if (days > 0) dueDate = invoiceDate.AddDays(days);
        }

        var invoice = new Invoice
        {
            InvoiceNumber = invoiceNumber,
            FournisseurId = request.FournisseurId,
            Status = InvoiceStatus.Pending.ToString(),
            PaymentTerms = request.PaymentTerms,
            InvoiceDate = invoiceDate,
            DueDate = dueDate,
            DiscountAmount = request.DiscountAmount,
            TaxRate = request.TaxRate,
            Notes = request.Notes,
            Reference = request.Reference,
            CreatedByUserId = userId
        };

        decimal subTotal = 0;
        foreach (var item in request.Items)
        {
            var discountAmount = 0m;
            if (item.DiscountPercent > 0)
            {
                discountAmount = Math.Round(item.Quantity * item.UnitCost * item.DiscountPercent / 100, 2);
            }

            int? resolvedVariantId = item.ProductVariantId;
            string productName;
            string productSku;
            string colorName = "";
            string sizeValue = "";

            if (item.ProductVariantId > 0)
            {
                var variants = await _unitOfWork.FindAsync<ProductVariant>(
                    v => v.Id == item.ProductVariantId, ct);
                var variant = variants.FirstOrDefault()
                    ?? throw new KeyNotFoundException($"Variante {item.ProductVariantId} introuvable");
                productName = variant.Product?.Name ?? string.Empty;
                productSku = variant.Sku;

                if (_unitOfWork.Colors is not null)
                {
                    var color = await _unitOfWork.Colors.GetByIdAsync(item.ColorId ?? variant.ColorId, ct);
                    colorName = color?.Name ?? "";
                }
                if (_unitOfWork.Sizes is not null)
                {
                    var size = await _unitOfWork.Sizes.GetByIdAsync(item.SizeId ?? variant.SizeId, ct);
                    sizeValue = size?.Value ?? "";
                }
            }
            else if (item.ProductId.HasValue && item.ColorId.HasValue && item.SizeId.HasValue)
            {
                var product = await _unitOfWork.Products.GetByIdAsync(item.ProductId.Value, ct)
                    ?? throw new KeyNotFoundException($"Produit {item.ProductId} introuvable");
                productName = product.Name;
                productSku = "";

                if (_unitOfWork.Colors is not null)
                {
                    var color = await _unitOfWork.Colors.GetByIdAsync(item.ColorId.Value, ct);
                    colorName = color?.Name ?? "";
                }
                if (_unitOfWork.Sizes is not null)
                {
                    var size = await _unitOfWork.Sizes.GetByIdAsync(item.SizeId.Value, ct);
                    sizeValue = size?.Value ?? "";
                }

                var existingVariants = await _unitOfWork.FindAsync<ProductVariant>(
                    v => v.ProductId == item.ProductId.Value
                         && v.ColorId == item.ColorId.Value
                         && v.SizeId == item.SizeId.Value, ct);
                var existing = existingVariants.FirstOrDefault();

                if (existing is not null)
                {
                    resolvedVariantId = existing.Id;
                    productSku = existing.Sku;
                }
                else
                {
                    var sku = $"PRD-{item.ProductId.Value}-{item.ColorId.Value}-{item.SizeId.Value}";
                    var newVariant = new ProductVariant
                    {
                        ProductId = item.ProductId.Value,
                        ColorId = item.ColorId.Value,
                        SizeId = item.SizeId.Value,
                        Sku = sku,
                        Barcode = sku,
                        IsActive = true,
                        IsLiquidation = false
                    };

                    product.Variants.Add(newVariant);
                    await _unitOfWork.SaveChangesAsync(ct);

                    var stockItem = new StockItem
                    {
                        ProductVariantId = newVariant.Id,
                        QuantityOnHand = 0,
                        QuantityReserved = 0,
                        ReorderLevel = 10,
                        ReorderQuantity = 25
                    };
                    await _unitOfWork.Stock.AddItemAsync(stockItem, ct);
                    await _unitOfWork.SaveChangesAsync(ct);

                    resolvedVariantId = newVariant.Id;
                    productSku = sku;
                }
            }
            else
            {
                productName = item.Description ?? "Produit";
                productSku = "";
                resolvedVariantId = null;
            }

            var lineItem = new InvoiceLineItem
            {
                ProductVariantId = resolvedVariantId,
                ProductName = productName,
                ProductSku = productSku,
                Description = item.Description,
                ColorId = item.ColorId,
                SizeId = item.SizeId,
                ColorName = colorName,
                SizeValue = sizeValue,
                Quantity = item.Quantity,
                UnitCost = item.UnitCost,
                DiscountPercent = item.DiscountPercent,
                DiscountAmount = discountAmount
            };
            invoice.LineItems.Add(lineItem);
            subTotal += (item.Quantity * item.UnitCost) - discountAmount;
        }

        invoice.SubTotal = subTotal;
        invoice.TaxAmount = Math.Round((subTotal - request.DiscountAmount) * request.TaxRate / 100, 2);
        invoice.TotalAmount = subTotal - request.DiscountAmount + invoice.TaxAmount;

        await _unitOfWork.Invoices.AddAsync(invoice, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        var created = await _unitOfWork.Invoices.GetByIdAsync(invoice.Id, ct);
        return MapToDto(created!);
    }

    public async Task<InvoiceDto?> UpdateAsync(int id, CreateInvoiceRequest request, CancellationToken ct = default)
    {
        var invoice = await _unitOfWork.Invoices.GetByIdAsync(id, ct);
        if (invoice is null) return null;

        if (invoice.Status == InvoiceStatus.Paid.ToString() || invoice.Status == InvoiceStatus.Cancelled.ToString())
            throw new InvalidOperationException("Impossible de modifier une facture payée ou annulée");

        invoice.FournisseurId = request.FournisseurId;
        invoice.PaymentTerms = request.PaymentTerms;
        invoice.DiscountAmount = request.DiscountAmount;
        invoice.TaxRate = request.TaxRate;
        invoice.Notes = request.Notes;
        invoice.Reference = request.Reference;
        invoice.UpdatedAt = DateTime.UtcNow;

        if (request.DueDate.HasValue) invoice.DueDate = DateTime.SpecifyKind(request.DueDate.Value, DateTimeKind.Utc);
        if (request.InvoiceDate.HasValue) invoice.InvoiceDate = DateTime.SpecifyKind(request.InvoiceDate.Value, DateTimeKind.Utc);

        invoice.LineItems.Clear();
        decimal subTotal = 0;
        foreach (var item in request.Items)
        {
            var discountAmount = 0m;
            if (item.DiscountPercent > 0)
            {
                discountAmount = Math.Round(item.Quantity * item.UnitCost * item.DiscountPercent / 100, 2);
            }

            int? resolvedVariantId = item.ProductVariantId;
            string productName;
            string productSku;
            string colorName = "";
            string sizeValue = "";

            if (item.ProductVariantId > 0)
            {
                var variants = await _unitOfWork.FindAsync<ProductVariant>(
                    v => v.Id == item.ProductVariantId, ct);
                var variant = variants.FirstOrDefault()
                    ?? throw new KeyNotFoundException($"Variante {item.ProductVariantId} introuvable");
                productName = variant.Product?.Name ?? string.Empty;
                productSku = variant.Sku;

                if (_unitOfWork.Colors is not null)
                {
                    var color = await _unitOfWork.Colors.GetByIdAsync(item.ColorId ?? variant.ColorId, ct);
                    colorName = color?.Name ?? "";
                }
                if (_unitOfWork.Sizes is not null)
                {
                    var size = await _unitOfWork.Sizes.GetByIdAsync(item.SizeId ?? variant.SizeId, ct);
                    sizeValue = size?.Value ?? "";
                }
            }
            else if (item.ProductId.HasValue && item.ColorId.HasValue && item.SizeId.HasValue)
            {
                var product = await _unitOfWork.Products.GetByIdAsync(item.ProductId.Value, ct)
                    ?? throw new KeyNotFoundException($"Produit {item.ProductId} introuvable");
                productName = product.Name;
                productSku = "";

                if (_unitOfWork.Colors is not null)
                {
                    var color = await _unitOfWork.Colors.GetByIdAsync(item.ColorId.Value, ct);
                    colorName = color?.Name ?? "";
                }
                if (_unitOfWork.Sizes is not null)
                {
                    var size = await _unitOfWork.Sizes.GetByIdAsync(item.SizeId.Value, ct);
                    sizeValue = size?.Value ?? "";
                }

                var existingVariants = await _unitOfWork.FindAsync<ProductVariant>(
                    v => v.ProductId == item.ProductId.Value
                         && v.ColorId == item.ColorId.Value
                         && v.SizeId == item.SizeId.Value, ct);
                var existing = existingVariants.FirstOrDefault();

                if (existing is not null)
                {
                    resolvedVariantId = existing.Id;
                    productSku = existing.Sku;
                }
                else
                {
                    var sku = $"PRD-{item.ProductId.Value}-{item.ColorId.Value}-{item.SizeId.Value}";
                    var newVariant = new ProductVariant
                    {
                        ProductId = item.ProductId.Value,
                        ColorId = item.ColorId.Value,
                        SizeId = item.SizeId.Value,
                        Sku = sku,
                        Barcode = sku,
                        IsActive = true,
                        IsLiquidation = false
                    };

                    product.Variants.Add(newVariant);
                    await _unitOfWork.SaveChangesAsync(ct);

                    var stockItem = new StockItem
                    {
                        ProductVariantId = newVariant.Id,
                        QuantityOnHand = 0,
                        QuantityReserved = 0,
                        ReorderLevel = 10,
                        ReorderQuantity = 25
                    };
                    await _unitOfWork.Stock.AddItemAsync(stockItem, ct);
                    await _unitOfWork.SaveChangesAsync(ct);

                    resolvedVariantId = newVariant.Id;
                    productSku = sku;
                }
            }
            else
            {
                productName = item.Description ?? "Produit";
                productSku = "";
                resolvedVariantId = null;
            }

            invoice.LineItems.Add(new InvoiceLineItem
            {
                ProductVariantId = resolvedVariantId,
                ProductName = productName,
                ProductSku = productSku,
                Description = item.Description,
                ColorId = item.ColorId,
                SizeId = item.SizeId,
                ColorName = colorName,
                SizeValue = sizeValue,
                Quantity = item.Quantity,
                UnitCost = item.UnitCost,
                DiscountPercent = item.DiscountPercent,
                DiscountAmount = discountAmount
            });
            subTotal += (item.Quantity * item.UnitCost) - discountAmount;
        }

        invoice.SubTotal = subTotal;
        invoice.TaxAmount = Math.Round((subTotal - request.DiscountAmount) * request.TaxRate / 100, 2);
        invoice.TotalAmount = subTotal - request.DiscountAmount + invoice.TaxAmount;

        _unitOfWork.Invoices.Update(invoice);
        await _unitOfWork.SaveChangesAsync(ct);

        var updated = await _unitOfWork.Invoices.GetByIdAsync(invoice.Id, ct);
        return MapToDto(updated!);
    }

    public async Task<InvoiceDto?> PayAsync(int id, PayInvoiceRequest request, int? userId = null, CancellationToken ct = default)
    {
        var invoice = await _unitOfWork.Invoices.GetByIdAsync(id, ct);
        if (invoice is null) return null;

        if (invoice.Status == InvoiceStatus.Paid.ToString())
            throw new InvalidOperationException("Cette facture est déjà entièrement payée");

        if (invoice.Status == InvoiceStatus.Cancelled.ToString())
            throw new InvalidOperationException("Impossible d'enregistrer un paiement sur une facture annulée");

        invoice.Payments.Add(new InvoicePayment
        {
            InvoiceId = invoice.Id,
            Amount = request.Amount,
            PaymentMethod = request.PaymentMethod,
            PaymentDate = DateTime.UtcNow,
            Reference = request.Reference,
            Notes = request.Notes,
            RecordedByUserId = userId
        });
        invoice.PaidAmount += request.Amount;

        if (invoice.PaidAmount >= invoice.TotalAmount)
        {
            invoice.Status = InvoiceStatus.Paid.ToString();
            invoice.PaidAt = DateTime.UtcNow;
        }
        else if (invoice.PaidAmount > 0)
        {
            invoice.Status = InvoiceStatus.PartiallyPaid.ToString();
        }
        invoice.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Invoices.Update(invoice);
        await _unitOfWork.SaveChangesAsync(ct);

        return MapToDto(invoice);
    }

    public async Task<InvoiceDto?> TogglePaidAsync(int id, int? userId = null, CancellationToken ct = default)
    {
        var invoice = await _unitOfWork.Invoices.GetByIdAsync(id, ct);
        if (invoice is null) return null;

        if (invoice.Status == InvoiceStatus.Cancelled.ToString())
            throw new InvalidOperationException("Impossible de modifier le paiement d'une facture annulée");

        if (invoice.Status == InvoiceStatus.Paid.ToString())
        {
            // Reopen: clear the payment history this correction produced rather than leaving a
            // PaidAmount that no longer matches any recorded InvoicePayment - same LineItems.Clear()
            // pattern UpdateAsync already relies on for cascading the delete via the required FK.
            invoice.Payments.Clear();
            invoice.PaidAmount = 0;
            invoice.PaidAt = null;
            invoice.Status = invoice.DueDate.HasValue && invoice.DueDate < DateTime.UtcNow
                ? InvoiceStatus.Overdue.ToString()
                : InvoiceStatus.Pending.ToString();
        }
        else
        {
            var remaining = invoice.TotalAmount - invoice.PaidAmount;
            if (remaining > 0)
            {
                invoice.Payments.Add(new InvoicePayment
                {
                    InvoiceId = invoice.Id,
                    Amount = remaining,
                    PaymentMethod = "Manuel",
                    PaymentDate = DateTime.UtcNow,
                    Notes = "Marquée payée manuellement",
                    RecordedByUserId = userId
                });
                invoice.PaidAmount = invoice.TotalAmount;
            }
            invoice.Status = InvoiceStatus.Paid.ToString();
            invoice.PaidAt = DateTime.UtcNow;
        }

        invoice.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Invoices.Update(invoice);
        await _unitOfWork.SaveChangesAsync(ct);

        return MapToDto(invoice);
    }

    public async Task<InvoiceDto?> CancelAsync(int id, string? reason = null, CancellationToken ct = default)
    {
        var invoice = await _unitOfWork.Invoices.GetByIdAsync(id, ct);
        if (invoice is null) return null;

        if (invoice.Status == InvoiceStatus.Paid.ToString())
            throw new InvalidOperationException("Impossible d'annuler une facture entièrement payée");

        invoice.Status = InvoiceStatus.Cancelled.ToString();
        invoice.Notes = string.IsNullOrWhiteSpace(reason)
            ? invoice.Notes
            : $"{invoice.Notes}\n\nAnnulée: {reason}".Trim();
        invoice.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Invoices.Update(invoice);
        await _unitOfWork.SaveChangesAsync(ct);

        return MapToDto(invoice);
    }

    public async Task<InvoiceDto?> ReceiveAsync(int id, int? userId = null, CancellationToken ct = default)
    {
        var invoice = await _unitOfWork.Invoices.GetByIdAsync(id, ct);
        if (invoice is null) return null;

        if (invoice.Status == InvoiceStatus.Received.ToString())
            throw new InvalidOperationException("Cette facture a déjà été réceptionnée");

        if (invoice.Status == InvoiceStatus.Cancelled.ToString())
            throw new InvalidOperationException("Impossible de réceptionner une facture annulée");

        foreach (var item in invoice.LineItems)
        {
            if (item.ProductVariantId is null) continue;

            var stockItem = await _unitOfWork.Stock.GetByVariantIdAsync(item.ProductVariantId.Value, ct);
            if (stockItem is null)
            {
                stockItem = new StockItem
                {
                    ProductVariantId = item.ProductVariantId.Value,
                    QuantityOnHand = 0,
                    QuantityReserved = 0,
                    ReorderLevel = 10,
                    ReorderQuantity = 25
                };
                await _unitOfWork.Stock.AddItemAsync(stockItem, ct);
                await _unitOfWork.SaveChangesAsync(ct);
            }

            stockItem.QuantityOnHand += item.Quantity;
            await _unitOfWork.Stock.AddMovementAsync(new StockMovement
            {
                ProductVariantId = item.ProductVariantId.Value,
                Type = StockMovementType.Purchase,
                QuantityChange = item.Quantity,
                QuantityAfter = stockItem.QuantityOnHand,
                Reference = invoice.InvoiceNumber,
                Notes = $"Réception facture {invoice.InvoiceNumber}",
                UserId = userId
            }, ct);
        }

        invoice.Status = InvoiceStatus.Received.ToString();
        invoice.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Invoices.Update(invoice);
        await _unitOfWork.SaveChangesAsync(ct);

        return MapToDto(invoice);
    }

    public async Task<int> CancelManyAsync(IEnumerable<int> ids, CancellationToken ct = default)
    {
        var idList = ids.ToList();
        var cancelled = 0;
        foreach (var id in idList)
        {
            var invoice = await _unitOfWork.Invoices.GetByIdAsync(id, ct);
            if (invoice is not null && invoice.Status != InvoiceStatus.Paid.ToString())
            {
                invoice.Status = InvoiceStatus.Cancelled.ToString();
                invoice.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.Invoices.Update(invoice);
                cancelled++;
            }
        }
        if (cancelled > 0) await _unitOfWork.SaveChangesAsync(ct);
        return cancelled;
    }

    public async Task<IReadOnlyList<InvoiceLabelDataDto>> GetLabelDataAsync(int id, CancellationToken ct = default)
    {
        var invoice = await _unitOfWork.Invoices.GetByIdAsync(id, ct);
        if (invoice is null) return Array.Empty<InvoiceLabelDataDto>();

        var result = new List<InvoiceLabelDataDto>();
        foreach (var item in invoice.LineItems)
        {
            if (item.ProductVariantId is null) continue;

            var variants = await _unitOfWork.FindAsync<ProductVariant>(
                v => v.Id == item.ProductVariantId.Value, ct);
            var variant = variants.FirstOrDefault();

            var price = variant?.Product?.Price;
            result.Add(new InvoiceLabelDataDto(
                item.ProductName,
                variant?.Barcode ?? item.ProductSku ?? "",
                item.ColorName ?? "",
                item.SizeValue ?? "",
                price ?? item.UnitCost,
                item.Quantity
            ));
        }
        return result;
    }

    public async Task<InvoiceSummaryDto> GetSummaryAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var paidStatus = InvoiceStatus.Paid.ToString();
        var cancelledStatus = InvoiceStatus.Cancelled.ToString();

        // Summary only needs a handful of scalar fields, not the full invoice graph - the previous
        // version went through Invoices.GetAllAsync(), which eagerly loads every LineItem and Payment
        // for the store's entire invoice history just to add up a few numbers. On this box that
        // full graph gets pulled twice per page load (GetAllAsync() runs the same query again for
        // the list itself), and the cost only grows with the invoice history - a likely contributor
        // to Factures getting slow/stuck under load. Project just what's needed instead.
        var rows = await _unitOfWork.Invoices.GetSummaryRowsAsync(ct);

        var unpaid = rows.Where(i => i.Status != paidStatus && i.Status != cancelledStatus).ToList();
        var overdue = unpaid.Where(i => i.DueDate is not null && i.DueDate < now).ToList();
        var paidCount = rows.Count(i => i.Status == paidStatus);

        return new InvoiceSummaryDto
        {
            TotalOwed = unpaid.Sum(i => i.Owed),
            TotalOverdue = overdue.Sum(i => i.Owed),
            PendingCount = unpaid.Count,
            OverdueCount = overdue.Count,
            PaidCount = paidCount,
            TotalCount = rows.Count,
            FournisseurBalances = unpaid
                .GroupBy(i => new { i.FournisseurId, Nom = i.FournisseurNom })
                .Select(g => new FournisseurBalanceDto
                {
                    FournisseurId = g.Key.FournisseurId,
                    FournisseurNom = g.Key.Nom,
                    TotalOwed = g.Sum(i => i.Owed),
                    InvoiceCount = g.Count()
                })
                .OrderByDescending(b => b.TotalOwed)
                .ToList()
        };
    }

    private static InvoiceDto MapToDto(Invoice i) => new()
    {
        Id = i.Id,
        InvoiceNumber = i.InvoiceNumber,
        FournisseurId = i.FournisseurId,
        FournisseurNom = i.Fournisseur?.Nom ?? string.Empty,
        Status = Enum.Parse<InvoiceStatus>(i.Status),
        SubTotal = i.SubTotal,
        DiscountAmount = i.DiscountAmount,
        TaxRate = i.TaxRate,
        TaxAmount = i.TaxAmount,
        TotalAmount = i.TotalAmount,
        PaidAmount = i.PaidAmount,
        PaymentTerms = i.PaymentTerms,
        InvoiceDate = i.InvoiceDate,
        DueDate = i.DueDate,
        PaidAt = i.PaidAt,
        Notes = i.Notes,
        Reference = i.Reference,
        CreatedByUserName = i.CreatedByUser?.FullName,
        CreatedAt = i.CreatedAt,
        Items = i.LineItems.Select(li => new InvoiceLineItemDto
        {
            Id = li.Id,
            ProductVariantId = li.ProductVariantId,
            ProductName = li.ProductName,
            VariantSku = li.ProductSku ?? string.Empty,
            ColorId = li.ColorId,
            SizeId = li.SizeId,
            ColorName = li.ColorName ?? string.Empty,
            SizeValue = li.SizeValue ?? string.Empty,
            Description = li.Description,
            Quantity = li.Quantity,
            UnitCost = li.UnitCost,
            DiscountPercent = li.DiscountPercent,
            DiscountAmount = li.DiscountAmount,
            LineTotal = li.LineTotal
        }).ToList(),
        Payments = i.Payments.Select(p => new InvoicePaymentDto
        {
            Id = p.Id,
            Amount = p.Amount,
            PaymentMethod = p.PaymentMethod,
            PaymentDate = p.PaymentDate,
            Reference = p.Reference,
            Notes = p.Notes,
            CreatedAt = p.CreatedAt
        }).ToList()
    };
}
