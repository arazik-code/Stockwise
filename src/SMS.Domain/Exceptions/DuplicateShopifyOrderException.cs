namespace SMS.Domain.Exceptions;

public class DuplicateShopifyOrderException : Exception
{
    public long ShopifyOrderId { get; }

    public DuplicateShopifyOrderException(long shopifyOrderId)
        : base($"Shopify order {shopifyOrderId} has already been processed")
    {
        ShopifyOrderId = shopifyOrderId;
    }
}
