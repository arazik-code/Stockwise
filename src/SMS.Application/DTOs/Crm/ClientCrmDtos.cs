using SMS.Domain.Enums;

namespace SMS.Application.DTOs.Crm;

public enum ClientSegment
{
    New,
    Regular,
    Vip,
    AtRisk,
    Lost
}

public record ClientCrmSummaryDto(
    int Id,
    string Name,
    string Phone,
    string? Email,
    decimal TotalSpent,
    int OrderCount,
    DateTime? LastOrderAt,
    int? DaysSinceLastOrder,
    ClientSegment Segment,
    string? FavoriteCategory,
    string? Tags,
    bool IsShopifyImported,
    DateTime CreatedAt,
    string? City = null,
    string? AddressLine = null,
    decimal? ShopifyTotalSpent = null,
    int? ShopifyOrdersCount = null,
    // Loyalty tier (Nouveau/Bon/Premium) - independent of Segment above, which is a separate,
    // marketing-oriented signal (see ClientCrmAppService.DetermineSegment doc comment).
    ClientCategory LoyaltyCategory = ClientCategory.Nouveau);

public record CrmDashboardDto(
    int TotalClients,
    decimal TotalRevenue,
    int VipCount,
    int AtRiskCount,
    int LostCount,
    int NewCount,
    List<ClientCrmSummaryDto> Clients);

public record CrmSegmentCountDto(ClientSegment Segment, int Count, decimal Revenue);
public record CrmCityStatDto(string City, int ClientCount, decimal Revenue);
public record CrmTopProductDto(int ProductId, string Name, string? ImageUrl, string CategoryName, int UnitsSold, decimal Revenue);
public record CrmTopCategoryDto(string CategoryName, int UnitsSold, decimal Revenue, int BuyerCount);

public record CrmAnalyticsDto(
    int TotalClients,
    int ClientsWithOrders,
    decimal TotalRevenue,
    decimal AvgClientValue,
    int ShopifyImportedCount,
    // Extra headline insights.
    decimal AvgOrderValue,
    int TotalOrders,
    int RepeatClients,
    decimal RepeatRate,
    int ClientsWithCity,
    int DistinctCities,
    List<CrmSegmentCountDto> Segments,
    // Full geographic scatter: every city with at least one client, not just the top few.
    List<CrmCityStatDto> Cities,
    List<CrmTopProductDto> TopProducts,
    List<CrmTopCategoryDto> TopCategories,
    List<ClientCrmSummaryDto> TopClients);

public record ClientPurchaseHistoryItemDto(
    DateTime Date,
    string Source,
    string OrderReference,
    string ProductName,
    string? Sku,
    string? ColorName,
    string? SizeValue,
    int Quantity,
    decimal UnitPrice,
    decimal LineTotal);

public record CategoryBreakdownItemDto(string CategoryName, decimal AmountSpent, int UnitsBought);

public record ProductRecommendationDto(
    int ProductId,
    string Name,
    string? ImageUrl,
    decimal Price,
    string CategoryName,
    string Reason);

public record ClientAnalyticsDto(
    ClientCrmSummaryDto Summary,
    List<ClientPurchaseHistoryItemDto> PurchaseHistory,
    List<CategoryBreakdownItemDto> CategoryBreakdown,
    List<ProductRecommendationDto> Recommendations);

public record ShopifyClientImportResultDto(
    bool Configured,
    bool Approved = true,
    string? Message = null,
    int Created = 0,
    int Updated = 0,
    int TotalFetched = 0,
    int OrdersImported = 0,
    int OrdersFetched = 0,
    int OrderItemsMatched = 0);
