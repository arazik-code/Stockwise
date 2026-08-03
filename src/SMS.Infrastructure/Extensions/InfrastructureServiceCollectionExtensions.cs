using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SMS.Application.DTOs.Ozon;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;
using SMS.Domain.Interfaces;
using SMS.Infrastructure.BackgroundServices;
using SMS.Infrastructure.Data;
using SMS.Infrastructure.Data.Repositories;
using SMS.Infrastructure.Ozon;
using SMS.Infrastructure.Receipt;
using SMS.Infrastructure.Services;
using SMS.Infrastructure.Shopify;
using SMS.Infrastructure.SignalR;

namespace SMS.Infrastructure.Extensions;

public static class InfrastructureServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("Default")));

        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<IStockRepository, StockRepository>();
        services.AddScoped<ISaleRepository, SaleRepository>();
        services.AddScoped<IShopifyOrderRepository, ShopifyOrderRepository>();
        services.AddScoped<IClientRepository, ClientRepository>();
        services.AddScoped<ILoyaltyTransactionRepository, LoyaltyTransactionRepository>();
        services.AddScoped<IInvoiceRepository, InvoiceRepository>();
        services.AddScoped<IFournisseurRepository, FournisseurRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        services.AddScoped<IInventoryNotifier, InventoryNotifier>();
        services.AddScoped<HtmlReceiptGenerator>();
        services.AddScoped<IImageStorageService, ImageStorageService>();
        services.AddScoped<IBarcodeService, BarcodeService>();

        var shopifySection = configuration.GetSection("Shopify");
        services.Configure<ShopifyOptions>(shopifySection);

        // Registered unconditionally: SaleAppService always enqueues on a sale, and the worker
        // itself reports (loudly) when Shopify isn't configured rather than the sale path having
        // to know or care.
        services.AddSingleton<IInventoryPushQueue, InventoryPushQueue>();
        services.AddHostedService<InventoryPushService>();

        var shopifyOptions = shopifySection.Get<ShopifyOptions>();
        var hasCredentials = shopifyOptions is not null &&
            (!string.IsNullOrEmpty(shopifyOptions.AccessToken) ||
             (!string.IsNullOrEmpty(shopifyOptions.ClientId) && !string.IsNullOrEmpty(shopifyOptions.ClientSecret)));

        if (shopifyOptions is not null && !string.IsNullOrEmpty(shopifyOptions.ShopDomain) && hasCredentials)
        {
            services.AddHttpClient(ShopifyTokenProvider.HttpClientName);
            services.AddSingleton<IShopifyTokenProvider, ShopifyTokenProvider>();
            services.AddTransient<ShopifyAuthHandler>();

            services.AddHttpClient<IShopifyApiClient, ShopifyApiClient>(client =>
            {
                client.BaseAddress = new Uri($"https://{shopifyOptions.ShopDomain}");
                // Without this the default is 100s, so one stuck call could block a stock push for
                // over a minute with no feedback anywhere. Shopify normally answers in well under a second.
                client.Timeout = TimeSpan.FromSeconds(20);
            }).AddHttpMessageHandler<ShopifyAuthHandler>();

            services.AddHostedService<ShopifyPollingService>();
            services.AddHostedService<ShopifyWebhookRetryService>();

            // InventorySyncService (the full-catalog reconciliation) is deliberately NOT started
            // automatically any more. It walked all ~2,949 variants on every single app launch at
            // Shopify's ~2 req/s ceiling - roughly 25 minutes of continuous traffic that saturated
            // the rate limit and starved the real-time push a POS sale depends on. Reconciliation
            // is now on-demand via the "Synchroniser vers Shopify" button, which only pushes the
            // variants whose quantity actually differs.
            services.AddSingleton<ShopifyBulkSyncService>();
            services.AddSingleton<IShopifyBulkSync>(sp => sp.GetRequiredService<ShopifyBulkSyncService>());
            services.AddHostedService(sp => sp.GetRequiredService<ShopifyBulkSyncService>());
        }

        // OzonExpress courier integration — registered only when credentials are present so the
        // rest of the app works without it (and the service treats a null client as "not configured").
        var ozonSection = configuration.GetSection("OzonExpress");
        services.Configure<OzonExpressOptions>(ozonSection);

        // Registered unconditionally, same as the Shopify inventory queue: OzonExpressAppService
        // always takes a dependency on this, and the worker itself is a no-op (empty queue) when
        // Ozon isn't configured.
        services.AddSingleton<IOzonBlQueue, OzonBlQueue>();
        services.AddHostedService<OzonAutoBlService>();

        var ozonOptions = ozonSection.Get<OzonExpressOptions>();
        if (ozonOptions is not null && !string.IsNullOrWhiteSpace(ozonOptions.CustomerId) && !string.IsNullOrWhiteSpace(ozonOptions.ApiKey))
        {
            services.AddHttpClient<IOzonExpressApiClient, OzonExpressApiClient>(client =>
            {
                client.BaseAddress = new Uri("https://api.ozonexpress.ma");
                client.Timeout = TimeSpan.FromSeconds(60);
            });
            services.AddHostedService<OzonTrackingSyncService>();
        }

        services.AddSignalR();

        return services;
    }
}
