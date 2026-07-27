namespace SMS.Application.DTOs.Shopify;

public record OrderRematchResultDto(int ConflictedOrders, int OrdersResolved, int ItemsMatched, int ItemsStillUnresolved);
