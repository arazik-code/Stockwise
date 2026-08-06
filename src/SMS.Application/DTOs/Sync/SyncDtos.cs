using SMS.Domain.Enums;

namespace SMS.Application.DTOs.Sync;

// The nightly VPS -> local-fallback sync deliberately covers only reference/catalog data
// (products, prices, stock, clients, users) - never transactional tables (Sales, Invoices,
// Refunds, CashDrawer movements), which are append-only, money-relevant, and reconciled
// separately (see the plan doc's Architecture Decision #1 and Phase 5).
public class SyncSnapshotDto
{
    public DateTime GeneratedAt { get; set; }
    // Categories/Fournisseurs are FK dependencies of Product (CategoryId is required) - included
    // even though the plan's original list named only "Products, Colors, Sizes, ProductVariants,
    // Stock, Clients, Users": without them, inserting a Product referencing a category the local
    // DB doesn't have yet would violate the FK constraint.
    public List<SyncCategoryDto> Categories { get; set; } = [];
    public List<SyncFournisseurDto> Fournisseurs { get; set; } = [];
    public List<SyncProductDto> Products { get; set; } = [];
    public List<SyncColorDto> Colors { get; set; } = [];
    public List<SyncSizeDto> Sizes { get; set; } = [];
    public List<SyncProductVariantDto> ProductVariants { get; set; } = [];
    public List<SyncStockItemDto> StockItems { get; set; } = [];
    public List<SyncClientDto> Clients { get; set; } = [];
    // Roles must travel with Users - a custom role created on the VPS after go-live wouldn't
    // exist on the local fallback DB otherwise, breaking that user's login/permissions offline.
    public List<SyncRoleDto> Roles { get; set; } = [];
    public List<SyncUserDto> Users { get; set; } = [];
}

public class SyncRoleDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsSystem { get; set; }
    public List<string> Sections { get; set; } = [];
}

public class SyncCategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? ParentCategoryId { get; set; }
}

public class SyncFournisseurDto
{
    public int Id { get; set; }
    public string Nom { get; set; } = string.Empty;
    public string? Contact { get; set; }
    public string? Email { get; set; }
    public string? Telephone { get; set; }
    public string? Adresse { get; set; }
}

public class SyncProductDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Brand { get; set; }
    public string? Barcode { get; set; }
    public string? ImageUrl { get; set; }
    public decimal Price { get; set; }
    public decimal? CostPrice { get; set; }
    public decimal? LiquidationPrice { get; set; }
    public decimal? OnlinePrice { get; set; }
    public int CategoryId { get; set; }
    public int? FournisseurId { get; set; }
    public bool IsActive { get; set; }
    public long? ShopifyProductId { get; set; }
}

public class SyncColorDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string HexCode { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}

public class SyncSizeDto
{
    public int Id { get; set; }
    public string Value { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}

public class SyncProductVariantDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public int ColorId { get; set; }
    public int SizeId { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; }
    public bool IsLiquidation { get; set; }
    public long? ShopifyVariantId { get; set; }
}

public class SyncStockItemDto
{
    public int ProductVariantId { get; set; }
    public int QuantityOnHand { get; set; }
    public int QuantityReserved { get; set; }
    public int ReorderLevel { get; set; }
    public int ReorderQuantity { get; set; }
    public DateTime LastUpdatedAt { get; set; }
}

public class SyncClientDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string QrCode { get; set; } = string.Empty;
    public int TotalPoints { get; set; }
    public int LifetimePoints { get; set; }
    public decimal TotalSpent { get; set; }
    public int LoyaltyRate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastVisitAt { get; set; }
    public long? ShopifyCustomerId { get; set; }
    public string? Tags { get; set; }
    public string? City { get; set; }
    public string? AddressLine { get; set; }
    public decimal? ShopifyTotalSpent { get; set; }
    public int? ShopifyOrdersCount { get; set; }
    public ClientCategory? ManualCategory { get; set; }
    public ClientCategory ComputedCategory { get; set; }
    public ClientCategory EffectiveCategory { get; set; }
    public DateTime? CategoryUpdatedAt { get; set; }
}

public class SyncUserDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    // Real password hash, not a placeholder - cashiers need to be able to log into the local
    // fallback with their actual current credentials. The whole channel is TLS + a static API
    // key (see SyncController), same trust level as every other secret this system already moves.
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public bool MustChangePassword { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SyncApplyResultDto
{
    public DateTime AppliedAt { get; set; }
    public int CategoriesUpserted { get; set; }
    public int FournisseursUpserted { get; set; }
    public int ProductsUpserted { get; set; }
    public int ColorsUpserted { get; set; }
    public int SizesUpserted { get; set; }
    public int ProductVariantsUpserted { get; set; }
    public int StockItemsUpserted { get; set; }
    public int StockItemsSkippedDueToLocalActivity { get; set; }
    public int ClientsUpserted { get; set; }
    public int ClientsSkippedLoyaltyFieldsDueToLocalActivity { get; set; }
    public int RolesUpserted { get; set; }
    public int UsersUpserted { get; set; }
}
