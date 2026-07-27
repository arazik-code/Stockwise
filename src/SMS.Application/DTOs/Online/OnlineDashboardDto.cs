namespace SMS.Application.DTOs.Online;

public class OnlineDashboardDto
{
    public int TodayOrders { get; set; }
    public decimal TodayRevenue { get; set; }
    public int PendingOrders { get; set; }
    public int ConflictCount { get; set; }
    public int WeekOrders { get; set; }
    public decimal WeekRevenue { get; set; }
    public int MonthOrders { get; set; }
    public decimal MonthRevenue { get; set; }

    public List<OrderTrendPointDto> OrdersTrend { get; set; } = [];
    public List<ChannelBreakdownPointDto> ChannelBreakdown { get; set; } = [];
    public List<OnlineOrderDto> RecentOrders { get; set; } = [];
}

public class OrderTrendPointDto
{
    public string Date { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal Revenue { get; set; }
}

public class ChannelBreakdownPointDto
{
    public string Channel { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal Revenue { get; set; }
}

public class OnlineReportDto
{
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public int TotalOrders { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal TotalDeliveryFees { get; set; }
    public int CancelledCount { get; set; }
    public int ConflictCount { get; set; }
    public List<ChannelBreakdownPointDto> ChannelBreakdown { get; set; } = [];
    public List<OrderTrendPointDto> DailyRevenue { get; set; } = [];
}
