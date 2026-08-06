using Microsoft.EntityFrameworkCore;
using SMS.Domain.Entities;
using SMS.Infrastructure.BackgroundServices;

namespace SMS.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Fournisseur> Fournisseurs => Set<Fournisseur>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Color> Colors => Set<Color>();
    public DbSet<Size> Sizes => Set<Size>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<StockItem> StockItems => Set<StockItem>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<ShopifyOrder> ShopifyOrders => Set<ShopifyOrder>();
    public DbSet<ShopifyOrderLineItem> ShopifyOrderLineItems => Set<ShopifyOrderLineItem>();
    public DbSet<ShopifyProduct> ShopifyProducts => Set<ShopifyProduct>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<LoyaltyTransaction> LoyaltyTransactions => Set<LoyaltyTransaction>();
    public DbSet<FailedWebhook> FailedWebhooks => Set<FailedWebhook>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceLineItem> InvoiceLineItems => Set<InvoiceLineItem>();
    public DbSet<InvoicePayment> InvoicePayments => Set<InvoicePayment>();
    public DbSet<Refund> Refunds => Set<Refund>();
    public DbSet<RefundItem> RefundItems => Set<RefundItem>();
    public DbSet<ExchangeItem> ExchangeItems => Set<ExchangeItem>();
    public DbSet<ReceiptBarcode> ReceiptBarcodes => Set<ReceiptBarcode>();
    public DbSet<OnlineOrder> OnlineOrders => Set<OnlineOrder>();
    public DbSet<OnlineOrderItem> OnlineOrderItems => Set<OnlineOrderItem>();
    public DbSet<OrderStatusHistory> OrderStatusHistories => Set<OrderStatusHistory>();
    public DbSet<OzonParcel> OzonParcels => Set<OzonParcel>();
    public DbSet<CodLedgerEntry> CodLedgerEntries => Set<CodLedgerEntry>();
    public DbSet<CourierRemittance> CourierRemittances => Set<CourierRemittance>();
    public DbSet<CityAlias> CityAliases => Set<CityAlias>();
    public DbSet<OrderConfirmationAttempt> OrderConfirmationAttempts => Set<OrderConfirmationAttempt>();
    public DbSet<OzonCity> OzonCities => Set<OzonCity>();
    public DbSet<OzonDeliveryNote> OzonDeliveryNotes => Set<OzonDeliveryNote>();
    public DbSet<CashDrawerMovement> CashDrawerMovements => Set<CashDrawerMovement>();
    public DbSet<WhatsAppTemplate> WhatsAppTemplates => Set<WhatsAppTemplate>();
    public DbSet<SyncState> SyncStates => Set<SyncState>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<RoleSection> RoleSections => Set<RoleSection>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        modelBuilder.Entity<FailedWebhook>(entity =>
        {
            entity.HasKey(f => f.Id);
            entity.Property(f => f.Topic).IsRequired().HasMaxLength(100);
            entity.Property(f => f.Payload).IsRequired();
            entity.Property(f => f.ErrorMessage).HasMaxLength(2000);
        });
    }
}
