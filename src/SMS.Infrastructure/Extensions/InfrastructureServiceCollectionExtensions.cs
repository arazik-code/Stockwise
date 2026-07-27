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
            }).AddHttpMessageHandler<ShopifyAuthHandler>();

            services.AddHostedService<ShopifyPollingService>();
            services.AddHostedService<ShopifyWebhookRetryService>();
            services.AddHostedService<InventorySyncService>();
        }

        // OzonExpress courier integration — registered only when credentials are present so the
        // rest of the app works without it (and the service treats a null client as "not configured").
        var ozonSection = configuration.GetSection("OzonExpress");
        services.Configure<OzonExpressOptions>(ozonSection);
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
