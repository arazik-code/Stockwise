namespace SMS.Application.DTOs.Sales;

public class DailySalesReportDto
{
    public DateTime Date { get; set; }
    public int TotalSales { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal TotalTax { get; set; }
    public decimal CashSales { get; set; }
    public decimal CardSales { get; set; }
    public decimal OnlineSales { get; set; }
    public List<TopProductDto> TopProducts { get; set; } = [];
}

public class TopProductDto
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string ColorName { get; set; } = string.Empty;
    public string SizeValue { get; set; } = string.Empty;
    public int QuantitySold { get; set; }
    public decimal Revenue { get; set; }
}
