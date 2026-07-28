namespace SMS.Application.DTOs.Shopify;

public record ShopifyProductListResponse(List<ShopifyProductItem> Products);

public record ShopifyProductItem(
    long Id, string Title, List<ShopifyVariantItem> Variants,
    string? BodyHtml = null, string? Vendor = null, string? ProductType = null, string? Status = null,
    ShopifyImageItem? Image = null, List<ShopifyImageItem>? Images = null, List<ShopifyOptionItem>? Options = null);

public record ShopifyVariantItem(
    long Id, string Sku, string Price, long InventoryItemId,
    string? Barcode = null, string? Option1 = null, string? Option2 = null, string? Option3 = null,
    int? InventoryQuantity = null, long? ImageId = null);

public record ShopifyVariantResponse(ShopifyVariantItem Variant);

public record ShopifyImageItem(long Id, string Src, int Position);
public record ShopifyOptionItem(string Name, int Position, List<string> Values);

public record ShopifyOrderListResponse(List<ShopifyOrderItem> Orders);
public record ShopifyOrderItem(
    long Id, long OrderNumber, string FinancialStatus, string FulfillmentStatus,
    string TotalPrice, string Currency, string? Email, string? Name,
    List<ShopifyLineItemData> LineItems, string CreatedAt,
    ShopifyOrderCustomer? Customer = null, string? CancelledAt = null,
    string? Phone = null, string? SubtotalPrice = null, string? TotalDiscounts = null,
    ShopifyOrderAddress? ShippingAddress = null, ShopifyOrderAddress? BillingAddress = null);
public record ShopifyOrderCustomer(long Id, string? FirstName = null, string? LastName = null, string? Phone = null, string? Email = null);
public record ShopifyOrderAddress(
    string? Name = null, string? FirstName = null, string? LastName = null, string? Phone = null,
    string? Address1 = null, string? Address2 = null, string? City = null, string? Province = null, string? Zip = null);
// product_id and variant_id are null on custom line items and orders referencing deleted products.
public record ShopifyLineItemData(long? ProductId, long? VariantId, string Title, int Quantity, string Price, string? Sku = null);

public record ShopifyLocationListResponse(List<ShopifyLocationItem> Locations);
public record ShopifyLocationItem(long Id, string Name, string? City, bool Active);

public record ShopifyCollectionListResponse(List<ShopifyCollectionItem> CustomCollections);
public record ShopifyCollectionItem(long Id, string Title);

public record ShopifySmartCollectionListResponse(List<ShopifyCollectionItem> SmartCollections);

public record ShopifyCollectListResponse(List<ShopifyCollectItem> Collects);
public record ShopifyCollectItem(long CollectionId, long ProductId);

public record ShopifyCustomerListResponse(List<ShopifyCustomerItem> Customers);
public record ShopifyCustomerItem(
    long Id, string? FirstName, string? LastName, string? Email, string? Phone,
    string? Tags, string? TotalSpent, int? OrdersCount, string CreatedAt,
    ShopifyCustomerAddress? DefaultAddress = null);
public record ShopifyCustomerAddress(string? City, string? Address1, string? Phone);
