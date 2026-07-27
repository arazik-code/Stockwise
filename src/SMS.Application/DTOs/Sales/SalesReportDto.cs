using SMS.Domain.Enums;

namespace SMS.Application.DTOs.Sales;

public class SalesReportDto
{
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public int TotalSales { get; set; }
    public int TotalItemsSold { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal TotalCost { get; set; }
    public decimal TotalProfit { get; set; }
    public decimal TotalTax { get; set; }
    public decimal TotalDiscount { get; set; }
    public decimal AverageOrderValue { get; set; }
    public decimal AverageItemsPerOrder { get; set; }

    public PaymentBreakdownDto PaymentBreakdown { get; set; } = new();
    public ChannelBreakdownDto ChannelBreakdown { get; set; } = new();
    public List<CategoryBreakdownDto> CategoryBreakdown { get; set; } = [];
    public List<TopProductReportDto> TopProducts { get; set; } = [];
    public List<DailyRevenueDto> DailyRevenue { get; set; } = [];
    public List<SaleDto> Sales { get; set; } = [];
}

public class PaymentBreakdownDto
{
    public decimal Cash { get; set; }
    public decimal Card { get; set; }
    public decimal Online { get; set; }
    public int CashCount { get; set; }
    public int CardCount { get; set; }
    public int OnlineCount { get; set; }
}

public class ChannelBreakdownDto
{
    public decimal Local { get; set; }
    public decimal Shopify { get; set; }
    public int LocalCount { get; set; }
    public int ShopifyCount { get; set; }
}

public class CategoryBreakdownDto
{
    public SaleCategory Category { get; set; }
    public int Count { get; set; }
    public decimal Revenue { get; set; }
}

public class TopProductReportDto
{
    public int ProductVariantId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string ColorName { get; set; } = string.Empty;
    public string SizeValue { get; set; } = string.Empty;
    public int QuantitySold { get; set; }
    public decimal Revenue { get; set; }
    public decimal Cost { get; set; }
    public decimal Profit { get; set; }
    public decimal AverageUnitPrice { get; set; }
}

public class DailyRevenueDto
{
    public DateTime Date { get; set; }
    public int SalesCount { get; set; }
    public decimal Revenue { get; set; }
    public decimal Profit { get; set; }
    public int ItemsSold { get; set; }
}
