namespace SMS.Application.DTOs.Shopify;

public record UnlinkedVariantDto(
    int ProductVariantId,
    int ProductId,
    string ProductName,
    string? ColorName,
    string? SizeValue,
    string Sku,
    string? Barcode,
    int QuantityOnHand);

public record ShopifyVariantCandidateDto(
    long ShopifyProductId,
    long ShopifyVariantId,
    string ProductTitle,
    string? VariantTitle,
    string? Sku,
    string? Barcode,
    decimal Price,
    long InventoryItemId,
    int? InventoryQuantity,
    bool AlreadyLinked,
    int? LinkedLocalVariantId,
    string? MatchReason = null);

public record LinkVariantRequest(long ShopifyVariantId);

public record LinkVariantResultDto(
    bool Success,
    string Message,
    int ProductVariantId,
    long? ShopifyVariantId = null,
    long? InventoryItemId = null,
    int? QuantityPushed = null,
    string? SharedSku = null);

public record AutoLinkResultDto(int Linked, int Ambiguous, int NoMatch, List<string> Details);
