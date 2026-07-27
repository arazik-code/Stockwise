# Stock Management System — Architecture

## 1. Solution Structure

```
StockManagementSystem/
├── src/
│   ├── SMS.Domain/                    # Entities, enums, interfaces (zero dependencies)
│   ├── SMS.Application/               # Services, DTOs, validators, interfaces
│   ├── SMS.Infrastructure/            # EF Core, Shopify client, SignalR hubs
│   ├── SMS.API/                       # Controllers, minimal endpoints, middleware, Program.cs
│   └── SMS.React/                     # React SPA (Vite + TypeScript)
├── tests/
│   ├── SMS.Domain.Tests/
│   ├── SMS.Application.Tests/
│   └── SMS.API.IntegrationTests/
├── StockManagementSystem.sln
└── docker-compose.yml                 # PostgreSQL + API + React dev
```

### 1.1 SMS.Domain

No dependencies. Pure domain model.

```
SMS.Domain/
├── Entities/
│   ├── Product.cs
│   ├── Category.cs
│   ├── Producer.cs
│   ├── StockItem.cs
│   ├── StockMovement.cs
│   ├── Sale.cs
│   ├── SaleItem.cs
│   ├── ShopifyOrder.cs
│   ├── ShopifyOrderLineItem.cs
│   ├── ShopifyProduct.cs
│   └── User.cs
├── Enums/
│   ├── SaleChannel.cs                 # Local, Shopify
│   ├── PaymentMethod.cs               # Cash, Card, Online
│   ├── StockMovementType.cs           # Sale, Return, Adjustment, Initial, ShopifySync
│   ├── OrderStatus.cs                 # Pending, Processing, Shipped, Delivered, Cancelled, Refunded
│   └── UserRole.cs                    # Admin, Cashier, Manager
├── Interfaces/
│   ├── IRepository.cs                 # Generic repository (optional, thin)
│   ├── IProductRepository.cs
│   ├── IStockRepository.cs
│   ├── ISaleRepository.cs
│   ├── IShopifyOrderRepository.cs
│   └── IUnitOfWork.cs
└── Exceptions/
    ├── InsufficientStockException.cs
    └── DuplicateShopifyOrderException.cs
```

### 1.2 SMS.Application

Depends on: SMS.Domain

```
SMS.Application/
├── Interfaces/
│   ├── IProductService.cs
│   ├── IStockService.cs
│   ├── ISaleService.cs
│   ├── IShopifySyncService.cs
│   ├── IShopifyApiClient.cs
│   ├── IInventoryNotifier.cs          # Abstraction over SignalR
│   └── IReceiptGenerator.cs
├── Services/
│   ├── ProductAppService.cs
│   ├── StockAppService.cs
│   ├── SaleAppService.cs
│   └── ShopifySyncAppService.cs
├── DTOs/
│   ├── Products/
│   │   ├── ProductDto.cs
│   │   ├── CreateProductRequest.cs
│   │   ├── UpdateProductRequest.cs
│   │   └── ProductSearchRequest.cs
│   ├── Stock/
│   │   ├── StockItemDto.cs
│   │   ├── StockAdjustmentRequest.cs
│   │   └── StockMovementDto.cs
│   ├── Sales/
│   │   ├── SaleDto.cs
│   │   ├── CreateSaleRequest.cs
│   │   ├── SaleItemRequest.cs
│   │   ├── DailySalesReportDto.cs
│   │   └── ReceiptDto.cs
│   └── Shopify/
│       ├── ShopifyOrderDto.cs
│       ├── ShopifyProductDto.cs
│       └── ShopifySyncStatusDto.cs
├── Validators/
│   ├── CreateProductValidator.cs      # FluentValidation
│   ├── CreateSaleValidator.cs
│   └── StockAdjustmentValidator.cs
├── Mappings/
│   └── MappingProfile.cs             # AutoMapper or manual maps
└── Behaviors/
    └── ValidationBehavior.cs          # MediatR pipeline (if using MediatR)
```

### 1.3 SMS.Infrastructure

Depends on: SMS.Domain, SMS.Application

```
SMS.Infrastructure/
├── Data/
│   ├── AppDbContext.cs
│   ├── Configurations/                # IEntityTypeConfiguration<T>
│   │   ├── ProductConfiguration.cs
│   │   ├── CategoryConfiguration.cs
│   │   ├── ProducerConfiguration.cs
│   │   ├── StockItemConfiguration.cs
│   │   ├── StockMovementConfiguration.cs
│   │   ├── SaleConfiguration.cs
│   │   ├── SaleItemConfiguration.cs
│   │   ├── ShopifyOrderConfiguration.cs
│   │   ├── ShopifyProductConfiguration.cs
│   │   └── UserConfiguration.cs
│   ├── Repositories/
│   │   ├── ProductRepository.cs
│   │   ├── StockRepository.cs
│   │   ├── SaleRepository.cs
│   │   ├── ShopifyOrderRepository.cs
│   │   └── UnitOfWork.cs
│   └── Migrations/
├── Shopify/
│   ├── ShopifyApiClient.cs            # IHttpClientFactory typed client
│   ├── ShopifyWebhookValidator.cs     # HMAC signature verification
│   ├── Models/
│   │   ├── ShopifyOrderResponse.cs
│   │   ├── ShopifyProductResponse.cs
│   │   └── ShopifyInventoryLevel.cs
│   └── Mappings/
│       └── ShopifyMappingExtensions.cs
├── SignalR/
│   ├── InventoryHub.cs                # Real-time inventory updates to POS
│   └── InventoryNotifier.cs           # IInventoryNotifier implementation
├── BackgroundServices/
│   ├── ShopifyPollingService.cs       # IHostedService fallback polling
│   ├── ShopifyWebhookRetryService.cs  # Retry failed webhook processing
│   └── InventorySyncService.cs        # Initial + periodic full sync
├── Receipt/
│   └── HtmlReceiptGenerator.cs        # IReceiptGenerator → HTML/PDF
└── Extensions/
    └── InfrastructureServiceCollectionExtensions.cs
```

### 1.4 SMS.API

Depends on: SMS.Application, SMS.Infrastructure

```
SMS.API/
├── Program.cs
├── Controllers/
│   ├── ProductsController.cs          # CRUD products
│   ├── CategoriesController.cs        # CRUD categories
│   ├── ProducersController.cs         # CRUD producers/suppliers
│   ├── StockController.cs             # Stock levels, adjustments, movements
│   ├── SalesController.cs             # POS sales, reports
│   └── ReportsController.cs           # Sales reports, inventory reports
├── Endpoints/
│   ├── WebhookEndpoints.cs            # Minimal API: Shopify webhooks
│   └── HealthEndpoints.cs             # Minimal API: health checks
├── Middleware/
│   ├── ExceptionHandlingMiddleware.cs  # ProblemDetails mapping
│   └── RequestLoggingMiddleware.cs
├── Filters/
│   └── ShopValidationFilter.cs
├── appsettings.json
├── appsettings.Development.json
└── Properties/
    └── launchSettings.json
```

### 1.5 SMS.React (Vite + TypeScript)

```
SMS.React/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   ├── client.ts                  # Axios/fetch instance with interceptors
│   │   ├── products.ts
│   │   ├── stock.ts
│   │   ├── sales.ts
│   │   └── reports.ts
│   ├── hooks/
│   │   ├── useSignalR.ts              # SignalR connection hook
│   │   ├── useProducts.ts
│   │   ├── useCart.ts
│   │   └── useDebounce.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── MainLayout.tsx
│   │   ├── pos/
│   │   │   ├── PosPage.tsx
│   │   │   ├── ProductGrid.tsx
│   │   │   ├── ProductSearch.tsx
│   │   │   ├── Cart.tsx
│   │   │   ├── CartItem.tsx
│   │   │   ├── CheckoutDialog.tsx
│   │   │   └── ReceiptPreview.tsx
│   │   ├── products/
│   │   │   ├── ProductListPage.tsx
│   │   │   ├── ProductForm.tsx
│   │   │   └── ProductDetail.tsx
│   │   ├── stock/
│   │   │   ├── StockOverviewPage.tsx
│   │   │   ├── StockAdjustmentDialog.tsx
│   │   │   └── StockMovementHistory.tsx
│   │   ├── sales/
│   │   │   ├── SalesHistoryPage.tsx
│   │   │   └── SaleDetail.tsx
│   │   ├── reports/
│   │   │   ├── DailySalesReport.tsx
│   │   │   └── InventoryReport.tsx
│   │   └── shared/
│   │       ├── DataTable.tsx
│   │       ├── ConfirmDialog.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── Toast.tsx
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── PosPage.tsx
│   │   ├── ProductsPage.tsx
│   │   ├── StockPage.tsx
│   │   ├── SalesPage.tsx
│   │   ├── ReportsPage.tsx
│   │   └── SettingsPage.tsx
│   ├── store/
│   │   ├── cartStore.ts               # Zustand or simple Context
│   │   └── inventoryStore.ts          # Real-time stock levels
│   ├── types/
│   │   ├── product.ts
│   │   ├── stock.ts
│   │   ├── sale.ts
│   │   └── report.ts
│   └── utils/
│       ├── format.ts                  # Currency, date formatting
│       └── barcode.ts                 # Barcode scanning helpers
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── .env                               # VITE_API_URL
```

---

## 2. Database Schema

### 2.1 Entity Definitions

```csharp
// === SMS.Domain/Entities/Category.cs ===
public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? ParentCategoryId { get; set; }
    public Category? ParentCategory { get; set; }
    public ICollection<Category> SubCategories { get; set; } = [];
    public ICollection<Product> Products { get; set; } = [];
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// === SMS.Domain/Entities/Producer.cs ===
public class Producer
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ContactName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public ICollection<Product> Products { get; set; } = [];
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// === SMS.Domain/Entities/Product.cs ===
public class Product
{
    public int Id { get; set; }
    public string Sku { get; set; } = string.Empty;          // Unique SKU
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Barcode { get; set; }                      // EAN/UPC for scanning
    public decimal Price { get; set; }
    public decimal? CostPrice { get; set; }
    public string? Size { get; set; }                         // Shoe size
    public string? Color { get; set; }
    public string? Brand { get; set; }
    public string? ImageUrl { get; set; }
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;
    public int? ProducerId { get; set; }
    public Producer? Producer { get; set; }
    public long? ShopifyProductId { get; set; }               // Linked Shopify product ID
    public bool IsActive { get; set; } = true;
    public StockItem StockItem { get; set; } = null!;
    public ICollection<ShopifyProduct> ShopifyProducts { get; set; } = [];
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// === SMS.Domain/Entities/StockItem.cs ===
public class StockItem
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int QuantityOnHand { get; set; }                   // Current physical stock
    public int QuantityReserved { get; set; }                 // Reserved for pending Shopify orders
    public int ReorderLevel { get; set; }                     // Alert threshold
    public int ReorderQuantity { get; set; }                  // Suggested reorder amount
    public DateTime LastUpdatedAt { get; set; }

    [NotMapped]
    public int QuantityAvailable => QuantityOnHand - QuantityReserved;
}

// === SMS.Domain/Entities/StockMovement.cs ===
public class StockMovement
{
    public long Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public StockMovementType Type { get; set; }
    public int QuantityChange { get; set; }                   // Positive = in, Negative = out
    public int QuantityAfter { get; set; }                    // Stock level after movement
    public string? Reference { get; set; }                    // Sale ID, Shopify Order ID, etc.
    public string? Notes { get; set; }
    public int? UserId { get; set; }                          // Who made the change
    public User? User { get; set; }
    public DateTime CreatedAt { get; set; }
}

// === SMS.Domain/Entities/Sale.cs ===
public class Sale
{
    public int Id { get; set; }
    public string SaleNumber { get; set; } = string.Empty;    // e.g., "POS-20260630-001"
    public SaleChannel Channel { get; set; }                  // Local
    public PaymentMethod PaymentMethod { get; set; }
    public decimal SubTotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal AmountPaid { get; set; }
    public decimal ChangeGiven { get; set; }
    public OrderStatus Status { get; set; }
    public string? Notes { get; set; }
    public int UserId { get; set; }                           // Cashier
    public User User { get; set; } = null!;
    public ICollection<SaleItem> Items { get; set; } = [];
    public DateTime CreatedAt { get; set; }
}

// === SMS.Domain/Entities/SaleItem.cs ===
public class SaleItem
{
    public int Id { get; set; }
    public int SaleId { get; set; }
    public Sale Sale { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal LineTotal { get; set; }
}

// === SMS.Domain/Entities/ShopifyOrder.cs ===
public class ShopifyOrder
{
    public int Id { get; set; }
    public long ShopifyOrderId { get; set; }                  // Shopify's order ID
    public string OrderNumber { get; set; } = string.Empty;
    public string FinancialStatus { get; set; } = string.Empty;
    public string FulfillmentStatus { get; set; } = string.Empty;
    public decimal TotalPrice { get; set; }
    public string Currency { get; set; } = "USD";
    public string? CustomerEmail { get; set; }
    public string? CustomerName { get; set; }
    public string? ShippingAddress { get; set; }              // JSON blob
    public OrderStatus LocalStatus { get; set; }
    public bool InventoryDeducted { get; set; }               // Prevent double-deduction
    public ICollection<ShopifyOrderLineItem> LineItems { get; set; } = [];
    public DateTime ShopifyCreatedAt { get; set; }
    public DateTime SyncedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// === SMS.Domain/Entities/ShopifyOrderLineItem.cs ===
public class ShopifyOrderLineItem
{
    public int Id { get; set; }
    public int ShopifyOrderId { get; set; }
    public ShopifyOrder ShopifyOrder { get; set; } = null!;
    public long ShopifyProductId { get; set; }
    public long ShopifyVariantId { get; set; }
    public int? LocalProductId { get; set; }                  // Mapped to local product
    public Product? LocalProduct { get; set; }
    public string Title { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal Price { get; set; }
}

// === SMS.Domain/Entities/ShopifyProduct.cs ===
public class ShopifyProduct
{
    public int Id { get; set; }
    public long ShopifyProductId { get; set; }
    public long ShopifyVariantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Sku { get; set; }
    public decimal Price { get; set; }
    public int? LocalProductId { get; set; }                  // Mapped to local product
    public Product? LocalProduct { get; set; }
    public long ShopifyInventoryItemId { get; set; }
    public DateTime SyncedAt { get; set; }
}

// === SMS.Domain/Entities/User.cs ===
public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}
```

### 2.2 Enums

```csharp
public enum SaleChannel { Local = 0, Shopify = 1 }
public enum PaymentMethod { Cash = 0, Card = 1, Online = 2 }
public enum StockMovementType { Sale = 0, Return = 1, Adjustment = 2, Initial = 3, ShopifySync = 4, Purchase = 5 }
public enum OrderStatus { Pending = 0, Processing = 1, Shipped = 2, Delivered = 3, Cancelled = 4, Refunded = 5 }
public enum UserRole { Admin = 0, Manager = 1, Cashier = 2 }
```

### 2.3 ER Diagram (Text)

```
Category ──1:N── SubCategories (self-ref)
    │
    1:N
    │
Producer ──1:N── Product ──1:1── StockItem
                     │
                     ├──1:N── StockMovement
                     │
                     ├──1:N── SaleItem ──N:1── Sale ──N:1── User
                     │
                     └──1:N── ShopifyProduct
                     
ShopifyOrder ──1:N── ShopifyOrderLineItem ──N:1── Product (optional link)
```

### 2.4 Key Indexes

```csharp
// In entity configurations:
product.HasIndex(p => p.Sku).IsUnique();
product.HasIndex(p => p.Barcode);
product.HasIndex(p => p.ShopifyProductId);
stockItem.HasIndex(s => s.ProductId).IsUnique();
shopifyOrder.HasIndex(o => o.ShopifyOrderId).IsUnique();
shopifyProduct.HasIndex(p => p.ShopifyProductId);
shopifyProduct.HasIndex(p => p.ShopifyVariantId);
sale.HasIndex(s => s.SaleNumber).IsUnique();
stockMovement.HasIndex(m => m.ProductId);
stockMovement.HasIndex(m => m.CreatedAt);
```

---

## 3. Shopify Integration Design

### 3.1 Configuration

```csharp
// appsettings.json
{
  "Shopify": {
    "ShopDomain": "your-store.myshopify.com",
    "AccessToken": "",                    // From user secrets
    "ApiVersion": "2025-01",
    "WebhookSecret": "",                  // From user secrets
    "PollingIntervalSeconds": 300,        // 5 min fallback
    "LocationId": "",                     // Shopify inventory location
    "MaxRetryAttempts": 3
  }
}
```

### 3.2 Webhook Endpoints (Minimal API)

```csharp
// SMS.API/Endpoints/WebhookEndpoints.cs
public static class WebhookEndpoints
{
    public static void MapWebhookEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/webhooks/shopify")
            .AllowAnonymous();  // Shopify sends unauthenticated requests; we verify HMAC

        group.MapPost("/orders-create", async (
            HttpRequest request,
            IShopifyWebhookProcessor processor,
            IOptions<ShopifyOptions> options) =>
        {
            // 1. Verify HMAC signature
            if (!await ShopifyWebhookValidator.VerifyAsync(request, options.Value.WebhookSecret))
                return Results.Unauthorized();

            // 2. Parse payload
            var payload = await request.ReadFromJsonAsync<ShopifyOrderWebhookPayload>();

            // 3. Enqueue for processing (idempotent)
            await processor.ProcessOrderCreatedAsync(payload!);
            return Results.Ok();
        });

        group.MapPost("/orders-cancelled", async (/* similar pattern */) => { });
        group.MapPost("/products-update", async (/* similar pattern */) => { });
        group.MapPost("/inventory-levels-update", async (/* similar pattern */) => { });
    }
}
```

### 3.3 Shopify API Client (Typed HttpClient)

```csharp
// SMS.Infrastructure/Shopify/ShopifyApiClient.cs
public class ShopifyApiClient : IShopifyApiClient
{
    private readonly HttpClient _http;
    private readonly ShopifyOptions _options;
    private readonly ILogger<ShopifyApiClient> _logger;

    public ShopifyApiClient(
        HttpClient httpClient,
        IOptions<ShopifyOptions> options,
        ILogger<ShopifyApiClient> logger)
    {
        _http = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    // --- Products ---
    public async Task<ShopifyProductListResponse> GetProductsAsync(
        int limit = 50, string? pageInfo = null, CancellationToken ct = default);

    public async Task<ShopifyProductResponse?> GetProductAsync(
        long productId, CancellationToken ct = default);

    // --- Orders ---
    public async Task<ShopifyOrderListResponse> GetOrdersAsync(
        string status = "any", int limit = 50,
        DateTime? createdAtMin = null, string? pageInfo = null,
        CancellationToken ct = default);

    // --- Inventory ---
    public async Task<ShopifyInventoryLevelResponse> GetInventoryLevelsAsync(
        long inventoryItemId, CancellationToken ct = default);

    public async Task<bool> UpdateInventoryLevelAsync(
        long inventoryItemId, long locationId, int available,
        CancellationToken ct = default);

    // --- Webhooks ---
    public async Task<bool> RegisterWebhookAsync(
        string topic, string callbackUrl, CancellationToken ct = default);

    public async Task<ShopifyWebhookListResponse> GetWebhooksAsync(
        CancellationToken ct = default);

    // --- Helper ---
    private string BuildUrl(string path, string? query = null)
        => $"/admin/api/{_options.ApiVersion}/{path}{query}";
}

// Registration in DI:
// builder.Services.AddHttpClient<IShopifyApiClient, ShopifyApiClient>(client =>
// {
//     client.BaseAddress = new Uri($"https://{shopifyConfig.ShopDomain}");
//     client.DefaultRequestHeaders.Add("X-Shopify-Access-Token", shopifyConfig.AccessToken);
// });
```

### 3.4 Background Services

```csharp
// SMS.Infrastructure/BackgroundServices/ShopifyPollingService.cs
// Fallback: polls Shopify every N minutes for orders created since last sync
public class ShopifyPollingService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ShopifyOptions _options;
    private readonly ILogger<ShopifyPollingService> _logger;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var syncService = scope.ServiceProvider.GetRequiredService<IShopifySyncService>();
                await syncService.SyncRecentOrdersAsync(stoppingToken);
                await syncService.SyncInventoryLevelsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Shopify polling sync failed");
            }

            await Task.Delay(
                TimeSpan.FromSeconds(_options.PollingIntervalSeconds),
                stoppingToken);
        }
    }
}

// SMS.Infrastructure/BackgroundServices/ShopifyWebhookRetryService.cs
// Retries failed webhook processing from a queue table
public class ShopifyWebhookRetryService : BackgroundService
{
    // Processes failed_webhooks table every 60 seconds
    // Retries up to MaxRetryAttempts, then marks as permanently failed
}

// SMS.Infrastructure/BackgroundServices/InventorySyncService.cs
// One-time initial full sync + periodic reconciliation
public class InventorySyncService : BackgroundService
{
    // On startup: syncs all Shopify products/orders to local DB
    // Every 6 hours: full inventory reconciliation
}
```

### 3.5 Sync Strategy

**Initial Data Load** (runs once on first startup or manual trigger):
1. Fetch all Shopify products → map to local `Product` + `ShopifyProduct`
2. Fetch all Shopify orders (last 90 days) → create `ShopifyOrder` records
3. Match Shopify SKUs to local SKUs for product mapping
4. Set `StockItem.QuantityOnHand` as source of truth (local wins)

**Real-time Sync** (webhooks):
- `orders/create` → Create `ShopifyOrder`, deduct inventory, create `StockMovement`
- `orders/cancelled` → Restore inventory, update order status
- `products/update` → Update `ShopifyProduct` mapping
- `inventory_levels/update` → Update `StockItem` if change came from Shopify admin

**Polling Fallback** (every 5 min):
- Fetch orders created since last successful sync timestamp
- Fetch inventory levels for all tracked products
- Compare and reconcile differences

### 3.6 Conflict Resolution: Last-Item Race

When both channels sell the last item simultaneously:

```
1. Local POS sale starts → checks QuantityAvailable >= requested
2. If sufficient → decrement QuantityOnHand → commit → push to Shopify
3. Shopify webhook arrives → checks QuantityAvailable >= ordered
4. If insufficient → mark order as "inventory conflict"
   → Create ShopifyOrder with FulfillmentStatus = "inventory_conflict"
   → Alert manager via SignalR notification
   → Manager resolves manually (restock, cancel Shopify order, or source from another location)
```

**Implementation**: Use database-level optimistic concurrency on `StockItem`:

```csharp
// StockItem has a RowVersion (concurrency token)
public byte[] RowVersion { get; set; } = null!;

// In StockItemConfiguration:
stockItem.Property(s => s.RowVersion).IsRowVersion();

// In StockService.DecrementStockAsync:
// If DbUpdateConcurrencyException → retry once (re-read, re-check, re-decrement)
// If still insufficient after retry → throw InsufficientStockException
```

---

## 4. POS System Design

### 4.1 Cart Management (Client-side)

```typescript
// SMS.React/src/store/cartStore.ts
interface CartItem {
  productId: number;
  sku: string;
  name: string;
  size: string | null;
  color: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  subtotal: () => number;
  tax: () => number;
  total: () => number;
}
```

### 4.2 Product Search / Barcode Scanning

```typescript
// SMS.React/src/components/pos/ProductSearch.tsx
// - Text search: by name, SKU (debounced 300ms)
// - Barcode scan: USB scanner types fast → onKeyPress rapid entry → submit on Enter
// - Grid display: shows product image, name, size, color, price, stock count
// - Stock count updates in real-time via SignalR
```

### 4.3 Checkout Flow

```
1. Cashier clicks "Checkout" → CheckoutDialog opens
2. Shows: items list, subtotal, tax (configurable rate), total
3. Payment method selection: Cash / Card
4. Cash flow:
   a. Enter amount tendered
   b. Auto-calculate change
   c. Confirm → POST /api/sales
5. Card flow:
   a. Mark as card payment (external terminal)
   b. Confirm → POST /api/sales
6. On success:
   a. Show receipt preview
   b. Print receipt (thermal printer via browser print or dedicated endpoint)
   c. Cart clears
   d. Product grid stock counts update via SignalR
```

### 4.4 Receipt Generation

```csharp
// SMS.Infrastructure/Receipt/HtmlReceiptGenerator.cs
public class HtmlReceiptGenerator : IReceiptGenerator
{
    public string GenerateReceiptHtml(Sale sale)
    {
        // Returns HTML string formatted for 80mm thermal receipt printer
        // Store name, address, date/time
        // Item list with qty, unit price, line total
        // Subtotal, tax, total
        // Payment method, amount paid, change
        // "Thank you!" footer
    }
}
```

### 4.5 Real-time Inventory via SignalR

```csharp
// SMS.Infrastructure/SignalR/InventoryHub.cs
public class InventoryHub : Hub
{
    public async Task JoinPosRoom()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "pos");
    }
}

// SMS.Infrastructure/SignalR/InventoryNotifier.cs
public class InventoryNotifier : IInventoryNotifier
{
    private readonly IHubContext<InventoryHub> _hubContext;

    public async Task NotifyStockChangedAsync(int productId, int newQuantity)
    {
        await _hubContext.Clients.Group("pos")
            .SendAsync("StockChanged", new { productId, newQuantity });
    }

    public async Task NotifyLowStockAsync(int productId, string productName, int quantity)
    {
        await _hubContext.Clients.Group("pos")
            .SendAsync("LowStockAlert", new { productId, productName, quantity });
    }

    public async Task NotifyNewShopifyOrderAsync(string orderNumber, decimal total)
    {
        await _hubContext.Clients.Group("pos")
            .SendAsync("NewShopifyOrder", new { orderNumber, total });
    }
}
```

```typescript
// SMS.React/src/hooks/useSignalR.ts
export function useSignalR() {
  const connection = useRef<HubConnection | null>(null);
  const updateStock = useInventoryStore(s => s.updateStock);
  const addNotification = useNotificationStore(s => s.add);

  useEffect(() => {
    connection.current = new HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/inventory`)
      .withAutomaticReconnect()
      .build();

    connection.current.on("StockChanged", ({ productId, newQuantity }) => {
      updateStock(productId, newQuantity);
    });

    connection.current.on("LowStockAlert", ({ productName, quantity }) => {
      addNotification(`Low stock: ${productName} (${quantity} left)`, "warning");
    });

    connection.current.on("NewShopifyOrder", ({ orderNumber, total }) => {
      addNotification(`New online order: ${orderNumber} ($${total})`, "info");
    });

    connection.current.start();
    return () => { connection.current?.stop(); };
  }, []);
}
```

---

## 5. API Design

### 5.1 Products Controller

```
GET    /api/products                      → List products (paginated, searchable)
GET    /api/products/{id}                 → Get product by ID
GET    /api/products/barcode/{barcode}    → Get product by barcode (for POS scanning)
POST   /api/products                      → Create product
PUT    /api/products/{id}                 → Update product
DELETE /api/products/{id}                 → Soft-delete (set IsActive = false)
GET    /api/products/search?q={query}     → Search by name/SKU/barcode
```

### 5.2 Categories Controller

```
GET    /api/categories                    → List all (tree structure)
GET    /api/categories/{id}               → Get with products
POST   /api/categories                    → Create
PUT    /api/categories/{id}               → Update
DELETE /api/categories/{id}               → Delete (if no products)
```

### 5.3 Producers Controller

```
GET    /api/producers                     → List all
GET    /api/producers/{id}                → Get with products
POST   /api/producers                     → Create
PUT    /api/producers/{id}                → Update
DELETE /api/producers/{id}                → Delete (if no products)
```

### 5.4 Stock Controller

```
GET    /api/stock                         → List all stock levels (paginated)
GET    /api/stock/{productId}             → Get stock for product
GET    /api/stock/low                     → Low stock items (below reorder level)
POST   /api/stock/adjust                  → Manual stock adjustment
GET    /api/stock/movements               → Movement history (paginated, filterable)
GET    /api/stock/movements/{productId}   → Movement history for product
```

### 5.5 Sales Controller

```
POST   /api/sales                         → Create sale (POS checkout)
GET    /api/sales                         → List sales (paginated, filterable by date/channel)
GET    /api/sales/{id}                    → Get sale detail
GET    /api/sales/{id}/receipt            → Get receipt HTML
POST   /api/sales/{id}/refund             → Process refund
GET    /api/sales/daily-report            → Daily sales summary
GET    /api/sales/report                  → Sales report (date range, group by day/week/month)
```

### 5.6 Shopify Controller (Admin)

```
GET    /api/shopify/orders                → List synced Shopify orders
GET    /api/shopify/orders/{id}           → Get Shopify order detail
POST   /api/shopify/sync/trigger          → Trigger manual sync
GET    /api/shopify/sync/status           → Get sync status (last sync time, pending)
POST   /api/shopify/webhooks/register     → Re-register all webhooks
```

### 5.7 Reports Controller

```
GET    /api/reports/dashboard             → Dashboard summary (today's sales, low stock count, etc.)
GET    /api/reports/inventory             → Current inventory report
GET    /api/reports/sales-by-channel      → Sales comparison: Local vs Shopify
GET    /api/reports/top-products          → Top selling products
```

### 5.8 Webhook Endpoints (Minimal API)

```
POST   /api/webhooks/shopify/orders-create
POST   /api/webhooks/shopify/orders-cancelled
POST   /api/webhooks/shopify/products-update
POST   /api/webhooks/shopify/inventory-levels-update
```

### 5.9 Health Endpoints (Minimal API)

```
GET    /api/health                        → Basic health check
GET    /api/health/shopify                → Shopify connectivity check
```

---

## 6. Key Workflows

### 6.1 Local POS Sale → Inventory Update → Shopify Sync

```
Cashier scans/adds items to cart
         │
         ▼
Cashier clicks Checkout → selects payment method
         │
         ▼
POST /api/sales (CreateSaleRequest)
         │
         ▼
┌─ SaleAppService.CreateSaleAsync ─────────────────────────┐
│  1. Validate request (items exist, quantities > 0)       │
│  2. BEGIN TRANSACTION                                    │
│  3. FOR EACH item:                                       │
│     a. Read StockItem (with RowVersion)                  │
│     b. Check QuantityAvailable >= requested qty          │
│     c. If insufficient → throw InsufficientStock        │
│     d. Decrement StockItem.QuantityOnHand                │
│     e. Create StockMovement (Type=Sale, qty=-N)          │
│  4. Create Sale + SaleItems                              │
│  5. COMMIT TRANSACTION                                   │
│  6. Notify via SignalR: StockChanged for each product    │
│  7. Notify via SignalR: LowStock if below reorder level  │
│  8. BACKGROUND: Push inventory update to Shopify         │
│     (fire-and-forget via IShopifyApiClient)              │
│  9. Return SaleDto with receipt                          │
└──────────────────────────────────────────────────────────┘
         │
         ▼
POS receives response → displays receipt → cart clears
SignalR pushes updated stock counts to POS grid
Shopify inventory updated async (may lag 1-2 seconds)
```

### 6.2 Shopify Order Webhook → Inventory Update → POS Notification

```
Shopify sends POST /api/webhooks/shopify/orders-create
         │
         ▼
WebhookEndpoints: Verify HMAC signature
         │
         ▼
ShopifyWebhookProcessor.ProcessOrderCreatedAsync
         │
         ▼
┌─ PROCESSING ─────────────────────────────────────────────┐
│  1. Check idempotency: ShopifyOrderId exists?            │
│     → If yes, skip (already processed)                   │
│  2. BEGIN TRANSACTION                                    │
│  3. Create ShopifyOrder + ShopifyOrderLineItems          │
│  4. FOR EACH line item:                                  │
│     a. Match to local Product (by SKU/ShopifyProductId)  │
│     b. If matched:                                       │
│        - Read StockItem                                  │
│        - Check QuantityAvailable                         │
│        - If sufficient:                                  │
│          * Decrement QuantityOnHand                      │
│          * Create StockMovement (Type=ShopifySync)       │
│          * Mark ShopifyOrder.InventoryDeducted = true    │
│        - If insufficient:                                │
│          * Mark as inventory_conflict                    │
│          * Notify manager via SignalR                    │
│  5. COMMIT TRANSACTION                                   │
│  6. Notify POS via SignalR: NewShopifyOrder              │
│  7. Notify POS via SignalR: StockChanged for each item   │
└──────────────────────────────────────────────────────────┘
         │
         ▼
If webhook processing fails → saved to failed_webhooks table
→ ShopifyWebhookRetryService retries later
```

### 6.3 Stock Adjustment → Audit Trail → Both Channels Updated

```
Manager opens Stock page → clicks "Adjust Stock"
         │
         ▼
StockAdjustmentDialog: select product, enter new qty or +/- delta, add reason
         │
         ▼
POST /api/stock/adjust (StockAdjustmentRequest)
         │
         ▼
┌─ StockAppService.AdjustStockAsync ───────────────────────┐
│  1. Validate product exists                              │
│  2. BEGIN TRANSACTION                                    │
│  3. Read StockItem                                       │
│  4. Calculate new QuantityOnHand                         │
│  5. Update StockItem.QuantityOnHand                      │
│  6. Create StockMovement:                                │
│     - Type = StockMovementType.Adjustment                │
│     - QuantityChange = delta (+ or -)                    │
│     - QuantityAfter = new on-hand                        │
│     - Notes = reason provided by manager                 │
│     - UserId = current user                              │
│  7. COMMIT TRANSACTION                                   │
│  8. Notify POS via SignalR: StockChanged                 │
│  9. Notify POS via SignalR: LowStock if applicable       │
│ 10. BACKGROUND: Push inventory update to Shopify         │
│     via IShopifyApiClient.UpdateInventoryLevelAsync      │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Program.cs Structure

```csharp
// SMS.API/Program.cs
var builder = WebApplication.CreateBuilder(args);

// --- Database ---
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// --- Application Services ---
builder.Services.AddScoped<IProductService, ProductAppService>();
builder.Services.AddScoped<IStockService, StockAppService>();
builder.Services.AddScoped<ISaleService, SaleAppService>();
builder.Services.AddScoped<IShopifySyncService, ShopifySyncAppService>();
builder.Services.AddScoped<IInventoryNotifier, InventoryNotifier>();

// --- Repositories ---
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<IStockRepository, StockRepository>();
builder.Services.AddScoped<ISaleRepository, SaleRepository>();
builder.Services.AddScoped<IShopifyOrderRepository, ShopifyOrderRepository>();
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();

// --- Shopify ---
var shopifySection = builder.Configuration.GetSection("Shopify");
builder.Services.Configure<ShopifyOptions>(shopifySection);
builder.Services.AddHttpClient<IShopifyApiClient, ShopifyApiClient>(client =>
{
    var options = shopifySection.Get<ShopifyOptions>()!;
    client.BaseAddress = new Uri($"https://{options.ShopDomain}");
    client.DefaultRequestHeaders.Add("X-Shopify-Access-Token", options.AccessToken);
});

// --- SignalR ---
builder.Services.AddSignalR();

// --- Background Services ---
builder.Services.AddHostedService<ShopifyPollingService>();
builder.Services.AddHostedService<ShopifyWebhookRetryService>();

// --- Controllers + Validation ---
builder.Services.AddControllers();
builder.Services.AddFluentValidationAutoValidation();

// --- API ---
builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// --- CORS ---
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactSpa", policy =>
        policy.WithOrigins(builder.Configuration["React:BaseUrl"]!)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

var app = builder.Build();

// --- Pipeline ---
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors("ReactSpa");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<InventoryHub>("/hubs/inventory");
app.MapWebhookEndpoints();       // Minimal API endpoints
app.MapHealthEndpoints();        // Minimal API health

app.Run();
```

---

## 8. NuGet Packages Required

```
SMS.Domain:          (none)

SMS.Application:     FluentValidation, FluentValidation.DependencyInjectionExtensions
                     AutoMapper.Extensions.Microsoft.DependencyInjection (optional)

SMS.Infrastructure:  Npgsql.EntityFrameworkCore.PostgreSQL
                     Microsoft.EntityFrameworkCore.Design
                     Microsoft.EntityFrameworkCore.Tools
                     Microsoft.Extensions.Http
                     Microsoft.AspNetCore.SignalR

SMS.API:             Microsoft.AspNetCore.OpenApi
                     Swashbuckle.AspNetCore
                     FluentValidation.AspNetCore
```

---

## 9. React Dependencies

```json
{
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "react-router-dom": "^7",
    "@microsoft/signalr": "^9",
    "zustand": "^5",
    "axios": "^1"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vite": "^6",
    "@vitejs/plugin-react": "^4",
    "tailwindcss": "^4"
  }
}
```

---

## 10. Deployment Notes

- **Single server deployment** is fine for this scale (1-2 registers, <500 products)
- PostgreSQL can run on the same machine or a small cloud instance
- React SPA builds to static files, served by `UseStaticFiles()` or nginx
- HTTPS required for Shopify webhook delivery
- Use .NET User Secrets for Shopify credentials in development
- Use environment variables or Azure Key Vault in production
