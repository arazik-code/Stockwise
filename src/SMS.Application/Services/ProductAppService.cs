using Microsoft.EntityFrameworkCore;
using SMS.Application.DTOs.Products;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class ProductAppService : IProductService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IColorwayResolver _colorways;

    public ProductAppService(IUnitOfWork unitOfWork, IColorwayResolver colorways)
    {
        _unitOfWork = unitOfWork;
        _colorways = colorways;
    }

    public async Task<IReadOnlyList<ProductDto>> GetAllAsync(CancellationToken ct = default)
    {
        var products = await _unitOfWork.Products.GetAllAsync(ct);
        return products.Select(MapToDto).ToList();
    }

    public async Task<IReadOnlyList<OnlineProductStatsDto>> GetOnlineStatsAsync(CancellationToken ct = default)
    {
        var query =
            from item in _unitOfWork.Set<OnlineOrderItem>()
            join variant in _unitOfWork.Set<ProductVariant>() on item.ProductVariantId equals variant.Id
            join order in _unitOfWork.Set<OnlineOrder>() on item.OnlineOrderId equals order.Id
            where order.Status != OrderStatus.Cancelled && order.Status != OrderStatus.InventoryConflict
            group new { item, order } by variant.ProductId into g
            select new OnlineProductStatsDto
            {
                ProductId = g.Key,
                UnitsSold = g.Sum(x => x.item.Quantity),
                Revenue = g.Sum(x => x.item.LineTotal),
                OrderCount = g.Select(x => x.order.Id).Distinct().Count(),
                LastOrderAt = g.Max(x => x.order.CreatedAt)
            };

        return await query.ToListAsync(ct);
    }

    public async Task<ProductDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var product = await _unitOfWork.Products.GetWithStockAsync(id, ct);
        return product is null ? null : MapToDto(product);
    }

    public async Task<IReadOnlyList<ProductDto>> SearchAsync(ProductSearchRequest request, CancellationToken ct = default)
    {
        IReadOnlyList<Product> products;

        if (!string.IsNullOrWhiteSpace(request.Query))
        {
            products = await _unitOfWork.Products.SearchAsync(request.Query, ct);
        }
        else if (request.CategoryId.HasValue)
        {
            products = await _unitOfWork.Products.GetByCategoryAsync(request.CategoryId.Value, ct);
        }
        else
        {
            products = await _unitOfWork.Products.GetAllAsync(ct);
        }

        return products
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(MapToDto)
            .ToList();
    }

    public async Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken ct = default)
    {
        var product = new Product
        {
            Name = request.Name,
            Description = request.Description,
            Brand = request.Brand,
            ImageUrl = request.ImageUrl,
            Price = request.Price,
            CostPrice = request.CostPrice,
            LiquidationPrice = request.LiquidationPrice,
            OnlinePrice = request.OnlinePrice,
            CategoryId = request.CategoryId,
            FournisseurId = request.FournisseurId,
            IsActive = true
        };

        await _unitOfWork.Products.AddAsync(product, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        // Product-level barcode, distinct from each variant's own barcode — scanning it
        // in the POS looks up the whole product rather than a single variant.
        product.Barcode = $"PGRP-{product.Id}";
        await _unitOfWork.SaveChangesAsync(ct);

        return MapToDto(product);
    }

    public async Task<ProductDto?> UpdateAsync(int id, UpdateProductRequest request, CancellationToken ct = default)
    {
        var product = await _unitOfWork.Products.GetByIdAsync(id, ct);
        if (product is null) return null;

        if (request.Name is not null) product.Name = request.Name;
        if (request.Description is not null) product.Description = request.Description;
        if (request.Brand is not null) product.Brand = request.Brand;
        if (request.ImageUrl is not null) product.ImageUrl = request.ImageUrl;
        if (request.Price.HasValue) product.Price = request.Price.Value;
        if (request.CostPrice.HasValue) product.CostPrice = request.CostPrice;
        if (request.LiquidationPrice.HasValue) product.LiquidationPrice = request.LiquidationPrice;
        if (request.OnlinePrice.HasValue) product.OnlinePrice = request.OnlinePrice;
        if (request.CategoryId.HasValue) product.CategoryId = request.CategoryId.Value;
        if (request.FournisseurId.HasValue) product.FournisseurId = request.FournisseurId.Value;
        if (request.IsActive.HasValue) product.IsActive = request.IsActive.Value;

        product.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);

        return MapToDto(product);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        var product = await _unitOfWork.Products.GetByIdAsync(id, ct);
        if (product is null) return false;

        product.IsActive = false;
        product.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    // "Draft" = a product this store no longer sells: it came from Shopify but its live Shopify
    // status is not "active" (ShopifyProductAppService.ImportCatalogFromShopifyAsync already flips
    // IsActive to false on sync for these). Purely local products are never included here, however
    // inactive - only Shopify-synced clutter is a "draft". Shopify-sourced now means "any of its
    // colourways carries a Shopify link", since the link moved off Product onto ProductColorway.
    public async Task<IReadOnlyList<DraftProductDto>> GetDraftProductsAsync(CancellationToken ct = default)
    {
        return await _unitOfWork.Set<Product>()
            .AsNoTracking()
            .Where(p => !p.IsActive && p.Colorways.Any(c => c.ShopifyProductId != null))
            .OrderBy(p => p.Name)
            .Select(p => new DraftProductDto
            {
                Id = p.Id,
                Name = p.Name,
                ImageUrl = p.ImageUrl,
                IsShopifyLinked = true,
                ColorwayCount = p.Colorways.Count,
                VariantCount = p.Variants.Count
            })
            .ToListAsync(ct);
    }

    public async Task<DeleteDraftProductsResultDto> DeleteDraftProductsAsync(CancellationToken ct = default)
    {
        var drafts = await _unitOfWork.Set<Product>()
            .Where(p => !p.IsActive && p.Colorways.Any(c => c.ShopifyProductId != null))
            .ToListAsync(ct);

        var result = new DeleteDraftProductsResultDto { TotalDrafts = drafts.Count };

        foreach (var product in drafts)
        {
            // One transaction per product: a product with real sales/invoice/order/stock-movement
            // history hits ProductVariant's DeleteBehavior.Restrict FK and throws - that must only
            // abort this one product's delete, never the whole batch or products already committed.
            await _unitOfWork.BeginTransactionAsync(ct);
            try
            {
                _unitOfWork.Remove(product);
                await _unitOfWork.SaveChangesAsync(ct);
                await _unitOfWork.CommitTransactionAsync(ct);
                result.Deleted++;
            }
            catch (DbUpdateException)
            {
                await _unitOfWork.RollbackTransactionAsync(ct);
                result.Skipped.Add(new SkippedDraftProductDto
                {
                    Id = product.Id,
                    Name = product.Name,
                    Reason = "A un historique (ventes, factures, commandes en ligne ou mouvements de stock) - suppression bloquee pour proteger les donnees."
                });
            }
            finally
            {
                _unitOfWork.ClearChangeTracker();
            }
        }

        return result;
    }

    public async Task<ProductVariantDto> AddVariantAsync(CreateProductVariantRequest request, CancellationToken ct = default)
    {
        var product = await _unitOfWork.Products.GetByIdAsync(request.ProductId, ct)
            ?? throw new KeyNotFoundException($"Product {request.ProductId} not found");

        if (!product.IsActive)
            throw new InvalidOperationException("Cannot add variant to an inactive product");

        var sku = string.IsNullOrWhiteSpace(request.Sku)
            ? $"PRD-{request.ProductId}-{request.ColorId}-{request.SizeId}"
            : request.Sku;

        var barcode = string.IsNullOrWhiteSpace(request.Barcode)
            ? sku
            : request.Barcode;

        var colorway = await _colorways.GetOrCreateAsync(request.ProductId, request.ColorId, ct);

        var variant = new ProductVariant
        {
            ProductId = request.ProductId,
            ColorId = request.ColorId,
            ColorwayId = colorway.Id,
            SizeId = request.SizeId,
            Sku = sku,
            Barcode = barcode,
            ImageUrl = request.ImageUrl,
            IsActive = true,
            IsLiquidation = request.IsLiquidation
        };

        product.Variants.Add(variant);
        await _unitOfWork.SaveChangesAsync(ct);

        var stockItem = new StockItem
        {
            ProductVariantId = variant.Id,
            QuantityOnHand = request.InitialStock,
            ReorderLevel = request.ReorderLevel
        };

        await _unitOfWork.Stock.AddItemAsync(stockItem, ct);
        await _unitOfWork.Stock.AddMovementAsync(new StockMovement
        {
            ProductVariantId = variant.Id,
            Type = StockMovementType.Initial,
            QuantityChange = request.InitialStock,
            QuantityAfter = request.InitialStock,
            Notes = "Initial stock"
        }, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return MapVariantToDto(variant, product, request.InitialStock);
    }

    public async Task<ProductVariantDto?> UpdateVariantAsync(int variantId, UpdateProductVariantRequest request, CancellationToken ct = default)
    {
        var variants = await _unitOfWork.FindAsync<ProductVariant>(v => v.Id == variantId, ct);
        var variant = variants.FirstOrDefault();
        if (variant is null) return null;

        // Changing a variant's colour moves it to a different colourway. The composite FK means
        // ColorId and ColorwayId have to move together in the same write, and the colourway it
        // left behind may now be empty.
        var previousColorwayId = variant.ColorwayId;
        if (request.ColorId.HasValue && request.ColorId.Value != variant.ColorId)
        {
            variant.ColorId = request.ColorId.Value;
            variant.ColorwayId = (await _colorways.GetOrCreateAsync(variant.ProductId, request.ColorId.Value, ct)).Id;
        }
        if (request.SizeId.HasValue) variant.SizeId = request.SizeId.Value;
        if (request.Sku is not null) variant.Sku = request.Sku;
        if (request.Barcode is not null) variant.Barcode = request.Barcode;
        if (request.ImageUrl is not null) variant.ImageUrl = request.ImageUrl;
        if (request.IsActive.HasValue) variant.IsActive = request.IsActive.Value;
        if (request.IsLiquidation.HasValue) variant.IsLiquidation = request.IsLiquidation.Value;

        // Auto-generate barcode if variant doesn't have one
        if (string.IsNullOrWhiteSpace(variant.Barcode))
        {
            variant.Barcode = variant.Sku;
        }

        variant.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);

        if (previousColorwayId != variant.ColorwayId)
            await _colorways.RemoveIfOrphanedAsync(previousColorwayId, ct);

        var stockItems = await _unitOfWork.Stock.GetAllWithVariantAsync(ct);
        var stockItem = stockItems.FirstOrDefault(s => s.ProductVariantId == variantId);

        var product = await _unitOfWork.Products.GetByIdAsync(variant.ProductId, ct);
        return MapVariantToDto(variant, product!, stockItem?.QuantityAvailable ?? 0);
    }

    public async Task<bool> DeleteVariantAsync(int variantId, CancellationToken ct = default)
    {
        var variants = await _unitOfWork.FindAsync<ProductVariant>(v => v.Id == variantId, ct);
        var variant = variants.FirstOrDefault();
        if (variant is null) return false;

        variant.IsActive = false;
        variant.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<ProductVariantDto?> GetVariantByBarcodeAsync(string barcode, CancellationToken ct = default)
    {
        // FindAsync<T> is a plain Where() with no eager loading - Color/Size must be included
        // explicitly here, or the mapped DTO silently comes back with empty colour/size (the POS
        // barcode-scan path is exactly where this showed up: a scanned item landed in the cart with
        // no colour/size, only its SKU, because this was the one variant lookup that skipped them).
        var variant = await _unitOfWork.Set<ProductVariant>()
            .Include(v => v.Color)
            .Include(v => v.Size)
            .FirstOrDefaultAsync(v => v.Barcode == barcode && v.IsActive, ct);
        if (variant is null) return null;

        var stockItems = await _unitOfWork.Stock.GetAllWithVariantAsync(ct);
        var stockItem = stockItems.FirstOrDefault(s => s.ProductVariantId == variant.Id);

        var product = await _unitOfWork.Products.GetByIdAsync(variant.ProductId, ct);
        return MapVariantToDto(variant, product!, stockItem?.QuantityAvailable ?? 0);
    }

    public async Task<ProductDto?> GetByBarcodeAsync(string barcode, CancellationToken ct = default)
    {
        var product = await _unitOfWork.Products.GetByBarcodeAsync(barcode, ct);
        return product is null ? null : MapToDto(product);
    }

    public async Task<int> GenerateMissingBarcodesAsync(CancellationToken ct = default)
    {
        // Query the DbSets directly rather than _unitOfWork.Products.GetAllAsync(), which silently
        // filters to IsActive products only — that left every variant of a deactivated/discontinued
        // product permanently without a scannable barcode. Products and variants are fetched as two
        // flat queries (no Include) and matched in memory by ProductId.
        var allProducts = _unitOfWork.Set<Product>().ToList();
        var allVariants = _unitOfWork.Set<ProductVariant>().ToList();
        var variantsByProduct = allVariants.GroupBy(v => v.ProductId).ToDictionary(g => g.Key, g => g.ToList());

        // Seed the uniqueness set with every barcode already in use (products + variants) so newly
        // generated EAN-13 codes never collide with existing ones.
        var used = new HashSet<string>();
        foreach (var p in allProducts)
            if (!string.IsNullOrWhiteSpace(p.Barcode)) used.Add(p.Barcode);
        foreach (var v in allVariants)
            if (!string.IsNullOrWhiteSpace(v.Barcode)) used.Add(v.Barcode!);

        var count = 0;
        foreach (var product in allProducts)
        {
            if (string.IsNullOrWhiteSpace(product.Barcode))
            {
                product.Barcode = Common.BarcodeGenerator.GenerateEan13(used);
                product.UpdatedAt = DateTime.UtcNow;
                count++;
            }

            if (!variantsByProduct.TryGetValue(product.Id, out var variants)) continue;
            foreach (var variant in variants.Where(v => string.IsNullOrWhiteSpace(v.Barcode)))
            {
                variant.Barcode = Common.BarcodeGenerator.GenerateEan13(used);
                variant.UpdatedAt = DateTime.UtcNow;
                count++;
            }
        }

        if (count > 0)
            await _unitOfWork.SaveChangesAsync(ct);

        return count;
    }

    public decimal GetEffectivePrice(Product product, ProductVariant variant)
    {
        if (variant.IsLiquidation && product.LiquidationPrice.HasValue)
            return product.LiquidationPrice.Value;
        return product.Price;
    }

    private static ProductDto MapToDto(Product p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Description = p.Description,
        Brand = p.Brand,
        Barcode = p.Barcode,
        ImageUrl = p.ImageUrl,
        Price = p.Price,
        CostPrice = p.CostPrice,
        LiquidationPrice = p.LiquidationPrice,
        OnlinePrice = p.OnlinePrice,
        CategoryId = p.CategoryId,
        CategoryName = p.Category?.Name ?? string.Empty,
        FournisseurId = p.FournisseurId,
        FournisseurNom = p.Fournisseur?.Nom,
        IsActive = p.IsActive,
        IsShopifyLinked = p.Colorways.Any(c => c.ShopifyProductId != null),
        Colorways = p.Colorways
            .OrderBy(c => c.SortOrder)
            .Select(c => new ProductColorwayDto
            {
                Id = c.Id,
                ProductId = c.ProductId,
                ColorId = c.ColorId,
                ColorName = c.Color?.Name ?? string.Empty,
                ColorHexCode = c.Color?.HexCode ?? "#000000",
                ImageUrl = c.ImageUrl ?? p.ImageUrl,
                OnlinePrice = c.OnlinePrice ?? p.OnlinePrice,
                ShopifyProductId = c.ShopifyProductId,
                ShopifyTitle = c.ShopifyTitle,
                SortOrder = c.SortOrder,
                IsActive = c.IsActive,
                VariantCount = p.Variants.Count(v => v.ColorwayId == c.Id && v.IsActive),
                StockQuantity = p.Variants
                    .Where(v => v.ColorwayId == c.Id && v.IsActive)
                    .Sum(v => v.StockItem?.QuantityAvailable ?? 0)
            })
            .ToList(),
        Variants = p.Variants
            .Where(v => v.IsActive)
            .Select(v => MapVariantToDto(v, p, v.StockItem?.QuantityAvailable ?? 0))
            .ToList()
    };

    private static ProductVariantDto MapVariantToDto(ProductVariant v, Product p, int stockQuantity)
    {
        var price = p.LiquidationPrice.HasValue && v.IsLiquidation
            ? p.LiquidationPrice.Value
            : p.Price;

        return new()
        {
            Id = v.Id,
            ProductId = v.ProductId,
            ColorwayId = v.ColorwayId,
            ColorId = v.ColorId,
            ColorName = v.Color?.Name ?? string.Empty,
            ColorHexCode = v.Color?.HexCode ?? "#000000",
            SizeId = v.SizeId,
            SizeValue = v.Size?.Value ?? string.Empty,
            Sku = v.Sku,
            Barcode = v.Barcode,
            Price = price,
            CostPrice = p.CostPrice,
            ImageUrl = v.ImageUrl,
            IsActive = v.IsActive,
            IsLiquidation = v.IsLiquidation,
            StockQuantity = stockQuantity
        };
    }
}
