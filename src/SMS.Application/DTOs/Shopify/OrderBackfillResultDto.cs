namespace SMS.Application.DTOs.Shopify;

/// <summary>
/// Result of re-fetching line items from Shopify for conflicted orders that were created before
/// the line-item-preservation fix and so still have zero OnlineOrderItems.
/// </summary>
public record OrderBackfillResultDto(int OrdersNeedingBackfill, int OrdersRebuilt, int OrdersNotFoundOnShopify);
