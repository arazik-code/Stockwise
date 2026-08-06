using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SMS.API.Authorization;
using SMS.Application.DTOs.Sales;
using SMS.Application.Services;
using SMS.Domain.Constants;
using SMS.Domain.Enums;
using SMS.Infrastructure.Data;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireSection(Sections.Reports)]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ReportPdfService _pdf;
    private readonly ReportCsvService _csv;

    public ReportsController(AppDbContext db, ReportPdfService pdf, ReportCsvService csv)
    {
        _db = db;
        _pdf = pdf;
        _csv = csv;
    }

    // ─── DASHBOARD ──────────────────────────────────────

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard(CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);
        var weekAgo = today.AddDays(-6);
        var monthAgo = today.AddDays(-30);

        var todaySales = await _db.Sales
            .Where(s => s.CreatedAt >= today && s.CreatedAt < tomorrow)
            .ToListAsync(ct);

        var weekSales = await _db.Sales
            .Where(s => s.CreatedAt >= weekAgo && s.CreatedAt < tomorrow)
            .ToListAsync(ct);

        var monthSales = await _db.Sales
            .Where(s => s.CreatedAt >= monthAgo && s.CreatedAt < tomorrow)
            .ToListAsync(ct);

        var lowStockCount = await _db.StockItems
            .CountAsync(s => s.QuantityOnHand <= s.ReorderLevel, ct);

        var totalProducts = await _db.Products.CountAsync(ct);
        var totalVariants = await _db.ProductVariants.CountAsync(ct);
        var totalStockValue = await _db.StockItems.SumAsync(s => s.QuantityOnHand, ct);

        var salesTrend = await _db.Sales
            .Where(s => s.CreatedAt >= weekAgo && s.CreatedAt < tomorrow)
            .GroupBy(s => s.CreatedAt.Date)
            .Select(g => new { Date = g.Key, Count = g.Count(), Revenue = g.Sum(s => s.TotalAmount) })
            .OrderBy(x => x.Date)
            .ToListAsync(ct);

        var paymentBreakdown = await _db.Sales
            .Where(s => s.CreatedAt >= monthAgo && s.CreatedAt < tomorrow)
            .GroupBy(s => s.PaymentMethod)
            .Select(g => new { Method = g.Key.ToString(), Count = g.Count(), Revenue = g.Sum(s => s.TotalAmount) })
            .ToListAsync(ct);

        var categoryBreakdown = await _db.Sales
            .Where(s => s.CreatedAt >= monthAgo && s.CreatedAt < tomorrow)
            .GroupBy(s => s.Category)
            .Select(g => new { Category = g.Key.ToString(), Count = g.Count(), Revenue = g.Sum(s => s.TotalAmount) })
            .ToListAsync(ct);

        return Ok(new
        {
            TodaySales = todaySales.Count,
            TodayRevenue = todaySales.Sum(s => s.TotalAmount),
            TodayAvgOrderValue = todaySales.Count > 0 ? todaySales.Average(s => s.TotalAmount) : 0,
            WeekSales = weekSales.Count,
            WeekRevenue = weekSales.Sum(s => s.TotalAmount),
            MonthSales = monthSales.Count,
            MonthRevenue = monthSales.Sum(s => s.TotalAmount),
            LowStockCount = lowStockCount,
            TotalProducts = totalProducts,
            TotalVariants = totalVariants,
            TotalStockUnits = totalStockValue,
            PendingConflicts = await _db.ShopifyOrders.CountAsync(o => o.LocalStatus == OrderStatus.InventoryConflict, ct),
            SalesTrend = salesTrend.Select(x => new { Date = x.Date.ToString("dd/MM"), Count = x.Count, Revenue = x.Revenue }),
            PaymentBreakdown = paymentBreakdown,
            CategoryBreakdown = categoryBreakdown,
        });
    }

    // ─── INVENTORY ──────────────────────────────────────

    [HttpGet("inventory")]
    public async Task<IActionResult> GetInventoryReport(CancellationToken ct)
    {
        var items = await _db.StockItems
            .Include(s => s.ProductVariant)
            .ThenInclude(pv => pv.Product)
            .ThenInclude(p => p.Category)
            .Include(s => s.ProductVariant)
            .ThenInclude(pv => pv.Color)
            .Include(s => s.ProductVariant)
            .ThenInclude(pv => pv.Size)
            .Select(s => new
            {
                ProductVariantId = s.ProductVariantId,
                ProductName = s.ProductVariant.Product.Name,
                Sku = s.ProductVariant.Sku,
                Category = s.ProductVariant.Product.Category.Name,
                QuantityOnHand = s.QuantityOnHand,
                QuantityReserved = s.QuantityReserved,
                ReorderLevel = s.ReorderLevel,
                IsLowStock = s.QuantityOnHand <= s.ReorderLevel
            })
            .OrderBy(s => s.ProductName)
            .ToListAsync(ct);

        return Ok(items);
    }

    // ─── SALES BY CHANNEL ───────────────────────────────

    [HttpGet("sales-by-channel")]
    public async Task<IActionResult> GetSalesByChannel(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        var startDate = ToUtc(from) ?? DateTime.UtcNow.Date.AddDays(-30);
        var endDate = ToUtc(to)?.AddDays(1) ?? DateTime.UtcNow.Date.AddDays(1);

        var sales = await _db.Sales
            .Where(s => s.CreatedAt >= startDate && s.CreatedAt < endDate)
            .GroupBy(s => s.Channel)
            .Select(g => new
            {
                Channel = g.Key.ToString(),
                TotalSales = g.Count(),
                TotalRevenue = g.Sum(s => s.TotalAmount)
            })
            .ToListAsync(ct);

        return Ok(sales);
    }

    // ─── TOP PRODUCTS ───────────────────────────────────

    [HttpGet("top-products")]
    public async Task<IActionResult> GetTopProducts(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int count = 10, CancellationToken ct = default)
    {
        var startDate = ToUtc(from) ?? DateTime.UtcNow.Date.AddDays(-30);
        var endDate = ToUtc(to)?.AddDays(1) ?? DateTime.UtcNow.Date.AddDays(1);

        var topProducts = await _db.SaleItems
            .Include(si => si.ProductVariant)
            .ThenInclude(pv => pv.Product)
            .Include(si => si.ProductVariant)
            .ThenInclude(pv => pv.Color)
            .Include(si => si.ProductVariant)
            .ThenInclude(pv => pv.Size)
            .Where(si => si.Sale.CreatedAt >= startDate && si.Sale.CreatedAt < endDate)
            .GroupBy(si => new { si.ProductVariantId, si.ProductVariant.Product.Name, ColorName = si.ProductVariant.Color.Name, SizeValue = si.ProductVariant.Size.Value })
            .Select(g => new TopProductDto
            {
                ProductId = g.Key.ProductVariantId,
                ProductName = g.Key.Name,
                QuantitySold = g.Sum(si => si.Quantity),
                Revenue = g.Sum(si => si.LineTotal)
            })
            .OrderByDescending(p => p.QuantitySold)
            .Take(count)
            .ToListAsync(ct);

        return Ok(topProducts);
    }

    // ═══════════════════════════════════════════════════════
    //  PDF REPORTS
    // ═══════════════════════════════════════════════════════

    [HttpGet("pdf/stock")]
    public async Task<IActionResult> GetStockPdf(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        var data = await GetStockData(ct);
        var pdf = _pdf.GenerateStockReport(data, ToUtc(from), ToUtc(to), "Rapport de Stock");
        return File(pdf, "application/pdf", $"rapport-stock-{DateTime.Now:yyyyMMdd}.pdf");
    }

    [HttpGet("pdf/sales")]
    public async Task<IActionResult> GetSalesPdf(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        var data = await GetSalesData(from, to, ct);
        var pdf = _pdf.GenerateSalesReport(data, ToUtc(from), ToUtc(to), "Rapport des Ventes");
        return File(pdf, "application/pdf", $"rapport-ventes-{DateTime.Now:yyyyMMdd}.pdf");
    }

    [HttpGet("pdf/fournisseurs")]
    public async Task<IActionResult> GetFournisseurPdf(CancellationToken ct)
    {
        var data = await GetFournisseurData(ct);
        var pdf = _pdf.GenerateFournisseurReport(data, title: "Rapport Fournisseurs");
        return File(pdf, "application/pdf", $"rapport-fournisseurs-{DateTime.Now:yyyyMMdd}.pdf");
    }

    [HttpGet("pdf/products")]
    public async Task<IActionResult> GetProductsPdf(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        var data = await GetProductsData(ct);
        var pdf = _pdf.GenerateProductsReport(data, ToUtc(from), ToUtc(to), "Catalogue Produits");
        return File(pdf, "application/pdf", $"rapport-produits-{DateTime.Now:yyyyMMdd}.pdf");
    }

    [HttpGet("pdf/dashboard")]
    public async Task<IActionResult> GetDashboardPdf(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        var data = await GetDashboardSummaryData(ct);
        var pdf = _pdf.GenerateDashboardSummary(data, ToUtc(from), ToUtc(to), "Résumé du Tableau de Bord");
        return File(pdf, "application/pdf", $"rapport-dashboard-{DateTime.Now:yyyyMMdd}.pdf");
    }

    // ═══════════════════════════════════════════════════════
    //  CSV EXPORTS
    // ═══════════════════════════════════════════════════════

    [HttpGet("csv/stock")]
    public async Task<IActionResult> GetStockCsv(CancellationToken ct)
    {
        var data = await GetStockData(ct);
        var csv = _csv.GenerateStockCsv(data);
        return File(Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", $"inventaire-{DateTime.Now:yyyyMMdd}.csv");
    }

    [HttpGet("csv/sales")]
    public async Task<IActionResult> GetSalesCsv(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        var data = await GetSalesData(from, to, ct);
        var csv = _csv.GenerateSalesCsv(data);
        return File(Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", $"ventes-{DateTime.Now:yyyyMMdd}.csv");
    }

    [HttpGet("csv/fournisseurs")]
    public async Task<IActionResult> GetFournisseurCsv(CancellationToken ct)
    {
        var data = await GetFournisseurData(ct);
        var csv = _csv.GenerateFournisseurCsv(data);
        return File(Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", $"fournisseurs-{DateTime.Now:yyyyMMdd}.csv");
    }

    [HttpGet("csv/products")]
    public async Task<IActionResult> GetProductsCsv(CancellationToken ct)
    {
        var data = await GetProductsData(ct);
        var csv = _csv.GenerateProductsCsv(data);
        return File(Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", $"produits-{DateTime.Now:yyyyMMdd}.csv");
    }

    // ═══════════════════════════════════════════════════════
    //  DATA QUERY HELPERS
    // ═══════════════════════════════════════════════════════

    private async Task<List<StockReportData>> GetStockData(CancellationToken ct)
    {
        return await _db.StockItems
            .Include(s => s.ProductVariant)
            .ThenInclude(pv => pv.Product)
            .ThenInclude(p => p.Category)
            .Include(s => s.ProductVariant)
            .ThenInclude(pv => pv.Color)
            .Include(s => s.ProductVariant)
            .ThenInclude(pv => pv.Size)
            .OrderBy(s => s.ProductVariant.Product.Name)
            .Select(s => new StockReportData
            {
                ProductName = s.ProductVariant.Product.Name,
                ColorName = s.ProductVariant.Color.Name,
                SizeValue = s.ProductVariant.Size.Value,
                Sku = s.ProductVariant.Sku,
                Category = s.ProductVariant.Product.Category.Name,
                QuantityOnHand = s.QuantityOnHand,
                ReorderLevel = s.ReorderLevel,
                IsLowStock = s.QuantityOnHand <= s.ReorderLevel
            })
            .ToListAsync(ct);
    }

    private async Task<List<SalesReportData>> GetSalesData(DateTime? from, DateTime? to, CancellationToken ct)
    {
        var startDate = ToUtc(from) ?? DateTime.UtcNow.Date.AddDays(-30);
        var endDate = ToUtc(to)?.AddDays(1) ?? DateTime.UtcNow.Date.AddDays(1);

        return await _db.Sales
            .Where(s => s.CreatedAt >= startDate && s.CreatedAt < endDate)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new SalesReportData
            {
                SaleNumber = s.SaleNumber,
                Date = s.CreatedAt,
                Channel = s.Channel.ToString(),
                PaymentMethod = s.PaymentMethod.ToString(),
                TotalAmount = s.TotalAmount,
                ItemsCount = s.Items.Count,
                Status = s.Status.ToString()
            })
            .ToListAsync(ct);
    }

    private async Task<List<FournisseurReportData>> GetFournisseurData(CancellationToken ct)
    {
        var fournisseurs = await _db.Fournisseurs
            .Include(f => f.Products)
            .OrderBy(f => f.Nom)
            .ToListAsync(ct);

        var fournisseurIds = fournisseurs.Select(f => f.Id).ToList();
        var invoices = await _db.Invoices
            .Where(i => fournisseurIds.Contains(i.FournisseurId))
            .GroupBy(i => i.FournisseurId)
            .Select(g => new { FournisseurId = g.Key, TotalPurchases = g.Sum(i => i.TotalAmount), InvoiceCount = g.Count() })
            .ToListAsync(ct);
        var invoiceLookup = invoices.ToDictionary(x => x.FournisseurId, x => x);

        return fournisseurs.Select(f =>
        {
            var inv = invoiceLookup.GetValueOrDefault(f.Id);
            return new FournisseurReportData
            {
                Name = f.Nom,
                Contact = f.Contact ?? "",
                Email = f.Email ?? "",
                Phone = f.Telephone ?? "",
                ProductCount = f.Products.Count,
                TotalPurchases = inv?.TotalPurchases ?? 0,
                TotalInvoices = inv?.InvoiceCount ?? 0
            };
        }).ToList();
    }

    private async Task<List<ProductReportData>> GetProductsData(CancellationToken ct)
    {
        return await _db.ProductVariants
            .Include(pv => pv.Product)
            .ThenInclude(p => p.Category)
            .Include(pv => pv.Color)
            .Include(pv => pv.Size)
            .Include(pv => pv.StockItem)
            .OrderBy(pv => pv.Product.Name)
            .ThenBy(pv => pv.Color.Name)
            .ThenBy(pv => pv.Size.Value)
            .Select(pv => new ProductReportData
            {
                Name = pv.Product.Name,
                Category = pv.Product.Category.Name,
                Sku = pv.Sku,
                Color = pv.Color.Name,
                Size = pv.Size.Value,
                Price = pv.Product.Price,
                CostPrice = pv.Product.CostPrice ?? 0,
                Stock = pv.StockItem != null ? pv.StockItem.QuantityOnHand : 0,
                IsLiquidation = pv.IsLiquidation
            })
            .ToListAsync(ct);
    }

    private async Task<DashboardSummaryData> GetDashboardSummaryData(CancellationToken ct)
    {
        var totalProducts = await _db.Products.CountAsync(ct);
        var totalFournisseurs = await _db.Fournisseurs.CountAsync(ct);
        var totalSales = await _db.Sales.CountAsync(ct);
        var totalRevenue = await _db.Sales.SumAsync(s => s.TotalAmount, ct);
        var totalPurchases = await _db.Invoices.SumAsync(i => i.TotalAmount, ct);
        var lowStockCount = await _db.StockItems.CountAsync(s => s.QuantityOnHand <= s.ReorderLevel, ct);
        var outOfStockCount = await _db.StockItems.CountAsync(s => s.QuantityOnHand == 0, ct);
        var avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

        var topProducts = await _db.SaleItems
            .Include(si => si.ProductVariant)
            .ThenInclude(pv => pv.Product)
            .GroupBy(si => si.ProductVariant.Product.Name)
            .Select(g => new TopProductData
            {
                Name = g.Key,
                QuantitySold = g.Sum(si => si.Quantity),
                Revenue = g.Sum(si => si.LineTotal)
            })
            .OrderByDescending(x => x.QuantitySold)
            .Take(10)
            .ToListAsync(ct);

        var productVariants = await _db.ProductVariants
            .Include(pv => pv.Product)
            .ThenInclude(p => p.Category)
            .Include(pv => pv.StockItem)
            .ToListAsync(ct);

        var categories = productVariants
            .GroupBy(pv => pv.Product.Category.Name)
            .Select(g => new CategoryData
            {
                Name = g.Key ?? "",
                ProductCount = g.Select(pv => pv.ProductId).Distinct().Count(),
                TotalValue = g.Sum(pv => (decimal)(pv.StockItem?.QuantityOnHand ?? 0) * pv.Product.Price)
            })
            .OrderByDescending(c => c.TotalValue)
            .ToList();

        var recentSales = await _db.Sales
            .OrderByDescending(s => s.CreatedAt)
            .Take(10)
            .Select(s => new RecentSaleData
            {
                SaleNumber = s.SaleNumber,
                Date = s.CreatedAt,
                Amount = s.TotalAmount,
                Status = s.Status.ToString()
            })
            .ToListAsync(ct);

        return new DashboardSummaryData
        {
            TotalProducts = totalProducts,
            TotalFournisseurs = totalFournisseurs,
            TotalSales = totalSales,
            TotalRevenue = totalRevenue,
            TotalPurchases = totalPurchases,
            LowStockCount = lowStockCount,
            OutOfStockCount = outOfStockCount,
            AverageOrderValue = avgOrderValue,
            TopProducts = topProducts,
            CategoryBreakdown = categories,
            RecentSales = recentSales
        };
    }

    private static DateTime? ToUtc(DateTime? dt)
        => dt.HasValue ? DateTime.SpecifyKind(dt.Value, DateTimeKind.Utc) : null;
}
