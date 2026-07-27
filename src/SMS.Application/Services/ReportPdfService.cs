using System;
using System.Collections.Generic;
using System.Linq;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace SMS.Application.Services;

#region Report Data Classes

public record StockReportData
{
    public string ProductName { get; init; } = string.Empty;
    public string ColorName { get; init; } = string.Empty;
    public string SizeValue { get; init; } = string.Empty;
    public string Sku { get; init; } = string.Empty;
    public string Category { get; init; } = string.Empty;
    public int QuantityOnHand { get; init; }
    public int ReorderLevel { get; init; }
    public bool IsLowStock { get; init; }
}

public record SalesReportData
{
    public string SaleNumber { get; init; } = string.Empty;
    public DateTime Date { get; init; }
    public string Channel { get; init; } = string.Empty;
    public string PaymentMethod { get; init; } = string.Empty;
    public decimal TotalAmount { get; init; }
    public int ItemsCount { get; init; }
    public string Status { get; init; } = string.Empty;
}

public record FournisseurReportData
{
    public string Name { get; init; } = string.Empty;
    public string Contact { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public int ProductCount { get; init; }
    public decimal TotalPurchases { get; init; }
    public int TotalInvoices { get; init; }
}

public record ProductReportData
{
    public string Name { get; init; } = string.Empty;
    public string Category { get; init; } = string.Empty;
    public string Sku { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public string Size { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public decimal CostPrice { get; init; }
    public int Stock { get; init; }
    public bool IsLiquidation { get; init; }
}

public record DashboardSummaryData
{
    public int TotalProducts { get; init; }
    public int TotalFournisseurs { get; init; }
    public int TotalSales { get; init; }
    public decimal TotalRevenue { get; init; }
    public decimal TotalPurchases { get; init; }
    public int LowStockCount { get; init; }
    public int OutOfStockCount { get; init; }
    public decimal AverageOrderValue { get; init; }
    public decimal ProfitMargin { get; init; }
    public List<TopProductData> TopProducts { get; init; } = new();
    public List<CategoryData> CategoryBreakdown { get; init; } = new();
    public List<RecentSaleData> RecentSales { get; init; } = new();
}

public record TopProductData
{
    public string Name { get; init; } = string.Empty;
    public int QuantitySold { get; init; }
    public decimal Revenue { get; init; }
}

public record CategoryData
{
    public string Name { get; init; } = string.Empty;
    public int ProductCount { get; init; }
    public decimal TotalValue { get; init; }
}

public record RecentSaleData
{
    public string SaleNumber { get; init; } = string.Empty;
    public DateTime Date { get; init; }
    public decimal Amount { get; init; }
    public string Status { get; init; } = string.Empty;
}

#endregion

public class ReportPdfService
{
    private const string PrimaryColor = "#1e40af";
    private const string AccentColor = "#3b82f6";
    private const string LightBg = "#eff6ff";
    private const string WhiteColor = "#ffffff";
    private const string TextDark = "#1e293b";
    private const string TextMuted = "#64748b";
    private const string BorderColor = "#cbd5e1";
    private const string SuccessColor = "#16a34a";
    private const string WarningColor = "#ea580c";
    private const string DangerColor = "#dc2626";
    private const string CompanyName = "Stock Management System";

    public byte[] GenerateStockReport(
        List<StockReportData> data,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        string title = "Stock Report")
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.MarginVertical(20);
                page.MarginHorizontal(30);

                page.Header().Element(header => ComposeHeader(header, title, fromDate, toDate));
                page.Content().Element(content => ComposeStockContent(content, data));
                page.Footer().Element(ComposeFooter);
            });
        }).GeneratePdf();
    }

    public byte[] GenerateSalesReport(
        List<SalesReportData> data,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        string title = "Sales Report")
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.MarginVertical(20);
                page.MarginHorizontal(30);

                page.Header().Element(header => ComposeHeader(header, title, fromDate, toDate));
                page.Content().Element(content => ComposeSalesContent(content, data));
                page.Footer().Element(ComposeFooter);
            });
        }).GeneratePdf();
    }

    public byte[] GenerateFournisseurReport(
        List<FournisseurReportData> data,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        string title = "Fournisseur Report")
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.MarginVertical(20);
                page.MarginHorizontal(30);

                page.Header().Element(header => ComposeHeader(header, title, fromDate, toDate));
                page.Content().Element(content => ComposeFournisseurContent(content, data));
                page.Footer().Element(ComposeFooter);
            });
        }).GeneratePdf();
    }

    public byte[] GenerateProductsReport(
        List<ProductReportData> data,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        string title = "Products Report")
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.MarginVertical(20);
                page.MarginHorizontal(30);

                page.Header().Element(header => ComposeHeader(header, title, fromDate, toDate));
                page.Content().Element(content => ComposeProductsContent(content, data));
                page.Footer().Element(ComposeFooter);
            });
        }).GeneratePdf();
    }

    public byte[] GenerateDashboardSummary(
        DashboardSummaryData data,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        string title = "Dashboard Summary")
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.MarginVertical(20);
                page.MarginHorizontal(30);

                page.Header().Element(header => ComposeHeader(header, title, fromDate, toDate));
                page.Content().Element(content => ComposeDashboardContent(content, data));
                page.Footer().Element(ComposeFooter);
            });
        }).GeneratePdf();
    }

    #region Header & Footer

    private void ComposeHeader(IContainer container, string title, DateTime? fromDate, DateTime? toDate)
    {
        container.Column(column =>
        {
            column.Item().Background(PrimaryColor).Padding(15).Row(row =>
            {
                row.RelativeItem().Column(left =>
                {
                    left.Item().Text(CompanyName)
                        .FontSize(18)
                        .FontColor(WhiteColor)
                        .Bold();
                    left.Item().PaddingTop(3).Text(title)
                        .FontSize(14)
                        .FontColor(Colors.Blue.Lighten3);
                });

                row.RelativeItem().AlignRight().AlignMiddle().Column(right =>
                {
                    var dateRange = BuildDateRange(fromDate, toDate);
                    right.Item().Text(dateRange)
                        .FontSize(9)
                        .FontColor(Colors.Blue.Lighten3)
                        .AlignRight();
                    right.Item().PaddingTop(3).Text($"Generated: {DateTime.Now:dd MMM yyyy HH:mm}")
                        .FontSize(8)
                        .FontColor(Colors.Blue.Lighten3)
                        .AlignRight();
                });
            });

            column.Item().PaddingBottom(10);
        });
    }

    private void ComposeFooter(IContainer container)
    {
        container.Column(column =>
        {
            column.Item().PaddingTop(5).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);

            column.Item().PaddingTop(5).Row(row =>
            {
                row.RelativeItem().Text($"{CompanyName} - Confidential")
                    .FontSize(8)
                    .FontColor(TextMuted);

                row.RelativeItem().AlignRight().Text(text =>
                {
                    text.CurrentPageNumber().FontSize(8).FontColor(TextMuted);
                    text.Span(" / ").FontSize(8).FontColor(TextMuted);
                    text.TotalPages().FontSize(8).FontColor(TextMuted);
                });
            });
        });
    }

    private static string BuildDateRange(DateTime? fromDate, DateTime? toDate)
    {
        if (fromDate.HasValue && toDate.HasValue)
            return $"Period: {fromDate.Value:dd MMM yyyy} - {toDate.Value:dd MMM yyyy}";
        if (fromDate.HasValue)
            return $"From: {fromDate.Value:dd MMM yyyy}";
        if (toDate.HasValue)
            return $"Until: {toDate.Value:dd MMM yyyy}";
        return "All Time";
    }

    #endregion

    #region Stock Report

    private void ComposeStockContent(IContainer container, List<StockReportData> data)
    {
        container.Column(column =>
        {
            column.Item().Element(ComposeStockSummaryStats);

            column.Item().PaddingBottom(5);

            column.Item().Element(c => ComposeStockTable(c, data));
        });
    }

    private void ComposeStockSummaryStats(IContainer container)
    {
        container.Column(column =>
        {
            column.Item().PaddingBottom(5).Text("Summary")
                .FontSize(12)
                .FontColor(PrimaryColor)
                .Bold();

            column.Item().Row(row =>
            {
                var totalProducts = 0;
                var totalQuantity = 0;
                var lowStockCount = 0;
                var outOfStockCount = 0;

                ComposeStatBox(row.RelativeItem(), "Total SKUs", totalProducts.ToString(), AccentColor);
                ComposeStatBox(row.RelativeItem(), "Total Quantity", totalQuantity.ToString(), PrimaryColor);
                ComposeStatBox(row.RelativeItem(), "Low Stock", lowStockCount.ToString(), WarningColor);
                ComposeStatBox(row.RelativeItem(), "Out of Stock", outOfStockCount.ToString(), DangerColor);
            });
        });
    }

    private void ComposeStockTable(IContainer container, List<StockReportData> data)
    {
        if (data.Count == 0)
        {
            container.AlignCenter().PaddingVertical(30).Text("No data available")
                .FontSize(12)
                .FontColor(TextMuted);
            return;
        }

        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(90);
                columns.RelativeColumn();
                columns.ConstantColumn(50);
                columns.ConstantColumn(60);
                columns.ConstantColumn(70);
                columns.ConstantColumn(80);
                columns.ConstantColumn(60);
            });

            table.Header(header =>
            {
                ComposeTableHeaderCell(header.Cell(), "Product");
                ComposeTableHeaderCell(header.Cell(), "SKU");
                ComposeTableHeaderCell(header.Cell(), "Color");
                ComposeTableHeaderCell(header.Cell(), "Size");
                ComposeTableHeaderCell(header.Cell(), "Category");
                ComposeTableHeaderCell(header.Cell(), "Qty On Hand");
                ComposeTableHeaderCell(header.Cell(), "Reorder");
            });

            int index = 0;
            foreach (var item in data)
            {
                var bgColor = index % 2 == 0 ? WhiteColor : LightBg;

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.ProductName).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.Sku).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.ColorName).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.SizeValue).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.Category).FontSize(8).FontColor(TextDark);

                var qtyColor = item.IsLowStock ? DangerColor : TextDark;
                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.QuantityOnHand.ToString()).FontSize(8).FontColor(qtyColor).Bold();

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.ReorderLevel.ToString()).FontSize(8).FontColor(TextDark);

                index++;
            }
        });
    }

    #endregion

    #region Sales Report

    private void ComposeSalesContent(IContainer container, List<SalesReportData> data)
    {
        container.Column(column =>
        {
            column.Item().Element(c => ComposeSalesSummaryStats(c, data));

            column.Item().PaddingBottom(5);

            column.Item().Element(c => ComposeSalesTable(c, data));
        });
    }

    private void ComposeSalesSummaryStats(IContainer container, List<SalesReportData> data)
    {
        var totalSales = data.Count;
        var totalRevenue = data.Sum(x => x.TotalAmount);
        var totalItems = data.Sum(x => x.ItemsCount);
        var averageOrder = totalSales > 0 ? totalRevenue / totalSales : 0;

        container.Column(column =>
        {
            column.Item().PaddingBottom(5).Text("Summary")
                .FontSize(12)
                .FontColor(PrimaryColor)
                .Bold();

            column.Item().Row(row =>
            {
                ComposeStatBox(row.RelativeItem(), "Total Sales", totalSales.ToString("N0"), PrimaryColor);
                ComposeStatBox(row.RelativeItem(), "Total Revenue", totalRevenue.ToString("C2"), SuccessColor);
                ComposeStatBox(row.RelativeItem(), "Items Sold", totalItems.ToString("N0"), AccentColor);
                ComposeStatBox(row.RelativeItem(), "Avg Order", averageOrder.ToString("C2"), WarningColor);
            });
        });
    }

    private void ComposeSalesTable(IContainer container, List<SalesReportData> data)
    {
        if (data.Count == 0)
        {
            container.AlignCenter().PaddingVertical(30).Text("No sales data available")
                .FontSize(12)
                .FontColor(TextMuted);
            return;
        }

        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(80);
                columns.ConstantColumn(75);
                columns.ConstantColumn(70);
                columns.ConstantColumn(80);
                columns.ConstantColumn(80);
                columns.ConstantColumn(50);
                columns.ConstantColumn(65);
            });

            table.Header(header =>
            {
                ComposeTableHeaderCell(header.Cell(), "Sale #");
                ComposeTableHeaderCell(header.Cell(), "Date");
                ComposeTableHeaderCell(header.Cell(), "Channel");
                ComposeTableHeaderCell(header.Cell(), "Payment");
                ComposeTableHeaderCell(header.Cell(), "Total");
                ComposeTableHeaderCell(header.Cell(), "Items");
                ComposeTableHeaderCell(header.Cell(), "Status");
            });

            int index = 0;
            foreach (var item in data)
            {
                var bgColor = index % 2 == 0 ? WhiteColor : LightBg;

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.SaleNumber).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.Date.ToString("dd MMM yyyy")).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.Channel).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.PaymentMethod).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.TotalAmount.ToString("C2")).FontSize(8).FontColor(TextDark).Bold();

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.ItemsCount.ToString()).FontSize(8).FontColor(TextDark);

                var statusColor = item.Status?.ToLower() switch
                {
                    "completed" => SuccessColor,
                    "pending" => WarningColor,
                    "cancelled" => DangerColor,
                    _ => TextDark
                };
                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.Status ?? "").FontSize(8).FontColor(statusColor);

                index++;
            }
        });
    }

    #endregion

    #region Fournisseur Report

    private void ComposeFournisseurContent(IContainer container, List<FournisseurReportData> data)
    {
        container.Column(column =>
        {
            column.Item().Element(c => ComposeFournisseurSummaryStats(c, data));

            column.Item().PaddingBottom(5);

            column.Item().Element(c => ComposeFournisseurTable(c, data));
        });
    }

    private void ComposeFournisseurSummaryStats(IContainer container, List<FournisseurReportData> data)
    {
        var totalSuppliers = data.Count;
        var totalProducts = data.Sum(x => x.ProductCount);
        var totalPurchases = data.Sum(x => x.TotalPurchases);
        var totalInvoices = data.Sum(x => x.TotalInvoices);

        container.Column(column =>
        {
            column.Item().PaddingBottom(5).Text("Summary")
                .FontSize(12)
                .FontColor(PrimaryColor)
                .Bold();

            column.Item().Row(row =>
            {
                ComposeStatBox(row.RelativeItem(), "Total Suppliers", totalSuppliers.ToString("N0"), PrimaryColor);
                ComposeStatBox(row.RelativeItem(), "Products Sourced", totalProducts.ToString("N0"), AccentColor);
                ComposeStatBox(row.RelativeItem(), "Total Purchases", totalPurchases.ToString("C2"), SuccessColor);
                ComposeStatBox(row.RelativeItem(), "Total Invoices", totalInvoices.ToString("N0"), WarningColor);
            });
        });
    }

    private void ComposeFournisseurTable(IContainer container, List<FournisseurReportData> data)
    {
        if (data.Count == 0)
        {
            container.AlignCenter().PaddingVertical(30).Text("No supplier data available")
                .FontSize(12)
                .FontColor(TextMuted);
            return;
        }

        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn();
                columns.ConstantColumn(90);
                columns.ConstantColumn(110);
                columns.ConstantColumn(80);
                columns.ConstantColumn(60);
                columns.ConstantColumn(85);
                columns.ConstantColumn(55);
            });

            table.Header(header =>
            {
                ComposeTableHeaderCell(header.Cell(), "Supplier");
                ComposeTableHeaderCell(header.Cell(), "Contact");
                ComposeTableHeaderCell(header.Cell(), "Email");
                ComposeTableHeaderCell(header.Cell(), "Phone");
                ComposeTableHeaderCell(header.Cell(), "Products");
                ComposeTableHeaderCell(header.Cell(), "Purchases");
                ComposeTableHeaderCell(header.Cell(), "Invoices");
            });

            int index = 0;
            foreach (var item in data)
            {
                var bgColor = index % 2 == 0 ? WhiteColor : LightBg;

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.Name).FontSize(8).FontColor(TextDark).Bold();

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.Contact).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.Email).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.Phone).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.ProductCount.ToString()).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.TotalPurchases.ToString("C2")).FontSize(8).FontColor(TextDark).Bold();

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.TotalInvoices.ToString()).FontSize(8).FontColor(TextDark);

                index++;
            }
        });
    }

    #endregion

    #region Products Report

    private void ComposeProductsContent(IContainer container, List<ProductReportData> data)
    {
        container.Column(column =>
        {
            column.Item().Element(c => ComposeProductsSummaryStats(c, data));

            column.Item().PaddingBottom(5);

            column.Item().Element(c => ComposeProductsTable(c, data));
        });
    }

    private void ComposeProductsSummaryStats(IContainer container, List<ProductReportData> data)
    {
        var totalProducts = data.Count;
        var totalStock = data.Sum(x => x.Stock);
        var totalValue = data.Sum(x => x.Price * x.Stock);
        var liquidationCount = data.Count(x => x.IsLiquidation);

        container.Column(column =>
        {
            column.Item().PaddingBottom(5).Text("Summary")
                .FontSize(12)
                .FontColor(PrimaryColor)
                .Bold();

            column.Item().Row(row =>
            {
                ComposeStatBox(row.RelativeItem(), "Total Products", totalProducts.ToString("N0"), PrimaryColor);
                ComposeStatBox(row.RelativeItem(), "Total Stock", totalStock.ToString("N0"), AccentColor);
                ComposeStatBox(row.RelativeItem(), "Inventory Value", totalValue.ToString("C2"), SuccessColor);
                ComposeStatBox(row.RelativeItem(), "Liquidation", liquidationCount.ToString("N0"), DangerColor);
            });
        });
    }

    private void ComposeProductsTable(IContainer container, List<ProductReportData> data)
    {
        if (data.Count == 0)
        {
            container.AlignCenter().PaddingVertical(30).Text("No product data available")
                .FontSize(12)
                .FontColor(TextMuted);
            return;
        }

        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn();
                columns.ConstantColumn(80);
                columns.ConstantColumn(75);
                columns.ConstantColumn(55);
                columns.ConstantColumn(45);
                columns.ConstantColumn(60);
                columns.ConstantColumn(60);
                columns.ConstantColumn(50);
                columns.ConstantColumn(55);
            });

            table.Header(header =>
            {
                ComposeTableHeaderCell(header.Cell(), "Product");
                ComposeTableHeaderCell(header.Cell(), "Category");
                ComposeTableHeaderCell(header.Cell(), "SKU");
                ComposeTableHeaderCell(header.Cell(), "Color");
                ComposeTableHeaderCell(header.Cell(), "Size");
                ComposeTableHeaderCell(header.Cell(), "Price");
                ComposeTableHeaderCell(header.Cell(), "Cost");
                ComposeTableHeaderCell(header.Cell(), "Stock");
                ComposeTableHeaderCell(header.Cell(), "Status");
            });

            int index = 0;
            foreach (var item in data)
            {
                var bgColor = index % 2 == 0 ? WhiteColor : LightBg;

                table.Cell().Background(bgColor).PaddingHorizontal(5).PaddingVertical(4)
                    .Text(item.Name).FontSize(7.5f).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(5).PaddingVertical(4)
                    .Text(item.Category).FontSize(7.5f).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(5).PaddingVertical(4)
                    .Text(item.Sku).FontSize(7.5f).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(5).PaddingVertical(4)
                    .Text(item.Color).FontSize(7.5f).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(5).PaddingVertical(4)
                    .Text(item.Size).FontSize(7.5f).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(5).PaddingVertical(4)
                    .Text(item.Price.ToString("C2")).FontSize(7.5f).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(5).PaddingVertical(4)
                    .Text(item.CostPrice.ToString("C2")).FontSize(7.5f).FontColor(TextMuted);

                var stockColor = item.Stock <= 0 ? DangerColor : item.Stock < 10 ? WarningColor : TextDark;
                table.Cell().Background(bgColor).PaddingHorizontal(5).PaddingVertical(4)
                    .Text(item.Stock.ToString()).FontSize(7.5f).FontColor(stockColor).Bold();

                if (item.IsLiquidation)
                {
                    table.Cell().Background(DangerColor).PaddingHorizontal(5).PaddingVertical(4)
                        .Text("LIQUIDATION").FontSize(7).FontColor(WhiteColor).Bold();
                }
                else
                {
                    table.Cell().Background(bgColor).PaddingHorizontal(5).PaddingVertical(4)
                        .Text("Active").FontSize(7.5f).FontColor(SuccessColor);
                }

                index++;
            }
        });
    }

    #endregion

    #region Dashboard Summary Report

    private void ComposeDashboardContent(IContainer container, DashboardSummaryData data)
    {
        container.Column(column =>
        {
            column.Item().Element(c => ComposeDashboardMetricCards(c, data));

            column.Item().PaddingBottom(10);

            if (data.TopProducts?.Count > 0)
            {
                column.Item().PaddingBottom(10).Text("Top Products")
                    .FontSize(12)
                    .FontColor(PrimaryColor)
                    .Bold();

                column.Item().Element(c => ComposeTopProductsTable(c, data.TopProducts));

                column.Item().PaddingBottom(10);
            }

            if (data.CategoryBreakdown?.Count > 0)
            {
                column.Item().PaddingBottom(10).Text("Category Breakdown")
                    .FontSize(12)
                    .FontColor(PrimaryColor)
                    .Bold();

                column.Item().Element(c => ComposeCategoryTable(c, data.CategoryBreakdown));

                column.Item().PaddingBottom(10);
            }

            if (data.RecentSales?.Count > 0)
            {
                column.Item().PaddingBottom(10).Text("Recent Sales")
                    .FontSize(12)
                    .FontColor(PrimaryColor)
                    .Bold();

                column.Item().Element(c => ComposeRecentSalesTable(c, data.RecentSales));
            }
        });
    }

    private void ComposeDashboardMetricCards(IContainer container, DashboardSummaryData data)
    {
        container.Column(column =>
        {
            column.Item().PaddingBottom(5).Text("Key Metrics")
                .FontSize(12)
                .FontColor(PrimaryColor)
                .Bold();

            column.Item().Row(row =>
            {
                ComposeStatBox(row.RelativeItem(), "Total Products", data.TotalProducts.ToString("N0"), PrimaryColor);
                ComposeStatBox(row.RelativeItem(), "Total Suppliers", data.TotalFournisseurs.ToString("N0"), AccentColor);
                ComposeStatBox(row.RelativeItem(), "Total Sales", data.TotalSales.ToString("N0"), SuccessColor);
                ComposeStatBox(row.RelativeItem(), "Total Revenue", data.TotalRevenue.ToString("C2"), PrimaryColor);
            });

            column.Item().PaddingTop(5).Row(row =>
            {
                ComposeStatBox(row.RelativeItem(), "Total Purchases", data.TotalPurchases.ToString("C2"), WarningColor);
                ComposeStatBox(row.RelativeItem(), "Low Stock Items", data.LowStockCount.ToString("N0"), WarningColor);
                ComposeStatBox(row.RelativeItem(), "Out of Stock", data.OutOfStockCount.ToString("N0"), DangerColor);
                ComposeStatBox(row.RelativeItem(), "Avg Order Value", data.AverageOrderValue.ToString("C2"), AccentColor);
            });
        });
    }

    private void ComposeTopProductsTable(IContainer container, List<TopProductData> data)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(30);
                columns.RelativeColumn();
                columns.ConstantColumn(80);
                columns.ConstantColumn(90);
            });

            table.Header(header =>
            {
                ComposeTableHeaderCell(header.Cell(), "#");
                ComposeTableHeaderCell(header.Cell(), "Product");
                ComposeTableHeaderCell(header.Cell(), "Qty Sold");
                ComposeTableHeaderCell(header.Cell(), "Revenue");
            });

            int rank = 1;
            foreach (var item in data)
            {
                var bgColor = rank % 2 == 1 ? WhiteColor : LightBg;

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(rank.ToString()).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.Name).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.QuantitySold.ToString("N0")).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.Revenue.ToString("C2")).FontSize(8).FontColor(TextDark).Bold();

                rank++;
            }
        });
    }

    private void ComposeCategoryTable(IContainer container, List<CategoryData> data)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn();
                columns.ConstantColumn(90);
                columns.ConstantColumn(100);
            });

            table.Header(header =>
            {
                ComposeTableHeaderCell(header.Cell(), "Category");
                ComposeTableHeaderCell(header.Cell(), "Products");
                ComposeTableHeaderCell(header.Cell(), "Total Value");
            });

            int index = 0;
            foreach (var item in data)
            {
                var bgColor = index % 2 == 0 ? WhiteColor : LightBg;

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.Name).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.ProductCount.ToString("N0")).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.TotalValue.ToString("C2")).FontSize(8).FontColor(TextDark).Bold();

                index++;
            }
        });
    }

    private void ComposeRecentSalesTable(IContainer container, List<RecentSaleData> data)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(90);
                columns.ConstantColumn(80);
                columns.ConstantColumn(80);
                columns.ConstantColumn(70);
            });

            table.Header(header =>
            {
                ComposeTableHeaderCell(header.Cell(), "Sale #");
                ComposeTableHeaderCell(header.Cell(), "Date");
                ComposeTableHeaderCell(header.Cell(), "Amount");
                ComposeTableHeaderCell(header.Cell(), "Status");
            });

            int index = 0;
            foreach (var item in data)
            {
                var bgColor = index % 2 == 0 ? WhiteColor : LightBg;

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.SaleNumber).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.Date.ToString("dd MMM yyyy")).FontSize(8).FontColor(TextDark);

                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.Amount.ToString("C2")).FontSize(8).FontColor(TextDark).Bold();

                var statusColor = item.Status?.ToLower() switch
                {
                    "completed" => SuccessColor,
                    "pending" => WarningColor,
                    "cancelled" => DangerColor,
                    _ => TextDark
                };
                table.Cell().Background(bgColor).PaddingHorizontal(6).PaddingVertical(5)
                    .Text(item.Status ?? "").FontSize(8).FontColor(statusColor);

                index++;
            }
        });
    }

    #endregion

    #region Shared Helpers

    private void ComposeStatBox(IContainer container, string label, string value, string color)
    {
        container.Background(Colors.Grey.Lighten5)
            .BorderBottom(2).BorderColor(color)
            .Padding(8).Column(column =>
            {
                column.Item().Text(value)
                    .FontSize(14)
                    .FontColor(color)
                    .Bold();
                column.Item().PaddingTop(2).Text(label)
                    .FontSize(8)
                    .FontColor(TextMuted);
            });
    }

    private void ComposeTableHeaderCell(IContainer cell, string text)
    {
        cell.Background(PrimaryColor)
            .PaddingHorizontal(6)
            .PaddingVertical(5)
            .Text(text)
            .FontSize(8)
            .FontColor(WhiteColor)
            .Bold();
    }

    #endregion
}
