using System.Text;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SMS.API.Endpoints;
using SMS.API.Filters;
using SMS.API.Middleware;
using SMS.Application.Interfaces;
using SMS.Application.Services;
using SMS.Application.Validators;
using SMS.Infrastructure.Data;
using SMS.Infrastructure.Extensions;
using SMS.Infrastructure.SignalR;
using SMS.Application.DTOs;

var builder = WebApplication.CreateBuilder(args);

QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddScoped<IProductService, ProductAppService>();
builder.Services.AddScoped<IStockService, StockAppService>();
builder.Services.AddScoped<ISaleService, SaleAppService>();
builder.Services.AddScoped<IShopifySyncService, ShopifySyncAppService>();
builder.Services.AddScoped<IInvoiceService, InvoiceAppService>();
builder.Services.AddScoped<IFournisseurService, FournisseurAppService>();
builder.Services.AddScoped<IColorService, ColorService>();
builder.Services.AddScoped<ISizeService, SizeService>();
builder.Services.AddScoped<IRefundService, RefundService>();
builder.Services.AddScoped<IOnlineOrderService, OnlineOrderAppService>();
builder.Services.AddScoped<IShopifyProductService, ShopifyProductAppService>();
builder.Services.AddScoped<IClientCrmService, ClientCrmAppService>();
builder.Services.AddScoped<IOzonExpressService, OzonExpressAppService>();
builder.Services.AddScoped<ICodLedgerService, CodLedgerAppService>();
builder.Services.AddScoped<ICityResolverService, CityResolverService>();
builder.Services.AddScoped<IOrderConfirmationService, OrderConfirmationAppService>();
builder.Services.AddScoped<ICashDrawerService, CashDrawerService>();
builder.Services.AddScoped<IShopifyInventoryPusher, ShopifyInventoryPusher>();
builder.Services.AddScoped<IShopifyLinkService, ShopifyLinkService>();
builder.Services.AddScoped<IWhatsAppTemplateService, WhatsAppTemplateAppService>();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<ThermalPrinterService>();
builder.Services.AddScoped<ReportPdfService>();
builder.Services.AddScoped<ReportCsvService>();

builder.Services.Configure<LoyaltySettings>(builder.Configuration.GetSection(LoyaltySettings.SectionName));
builder.Services.Configure<StoreSettings>(builder.Configuration.GetSection(StoreSettings.SectionName));
builder.Services.Configure<TaxSettings>(builder.Configuration.GetSection(TaxSettings.SectionName));
builder.Services.Configure<InvoiceTemplateSettings>(builder.Configuration.GetSection(InvoiceTemplateSettings.SectionName));
builder.Services.Configure<ReceiptTemplateSettings>(builder.Configuration.GetSection(ReceiptTemplateSettings.SectionName));

builder.Services.AddValidatorsFromAssemblyContaining<CreateProductValidator>();

var jwtSecret = builder.Configuration["Jwt:SecretKey"]
    ?? Environment.GetEnvironmentVariable("JWT_SECRET_KEY")
    ?? throw new InvalidOperationException("Jwt:SecretKey is not configured. Set it in appsettings.json or via JWT_SECRET_KEY environment variable.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "StockManagementSystem";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "StockManagementSystem";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ClockSkew = TimeSpan.Zero
    };
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            if (!string.IsNullOrEmpty(accessToken) && context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("login", limiterOptions =>
    {
        limiterOptions.PermitLimit = 10;
        limiterOptions.Window = TimeSpan.FromMinutes(5);
        limiterOptions.QueueLimit = 0;
    });
    options.AddFixedWindowLimiter("api", limiterOptions =>
    {
        limiterOptions.PermitLimit = 100;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 10;
    });
    options.AddFixedWindowLimiter("write", limiterOptions =>
    {
        limiterOptions.PermitLimit = 30;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 5;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

builder.Services.AddControllers(options =>
{
    options.Filters.Add<FluentValidationFilter>();
}).AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    options.JsonSerializerOptions.Converters.Add(new UtcDateTimeConverter());
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Enter your JWT token"
    });
    options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddProblemDetails();

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
    options.MimeTypes = Microsoft.AspNetCore.ResponseCompression.ResponseCompressionDefaults.MimeTypes
        .Concat(["application/json"]);
});

builder.Services.AddCors(options =>
{
    var configuredOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
    var defaultOrigins = new[]
    {
        builder.Configuration["React:BaseUrl"] ?? "http://localhost:5173",
        "http://localhost:5173",
        "http://localhost:5001",
        "http://localhost:5000"
    };
    var origins = defaultOrigins.Concat(configuredOrigins).Distinct().ToArray();

    options.AddPolicy("ReactSpa", policy =>
        policy.WithOrigins(origins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (!app.Environment.IsEnvironment("Testing"))
    {
        var autoMigrate = builder.Configuration.GetValue("Database:AutoMigrate", true);
        if (autoMigrate)
        {
            await db.Database.MigrateAsync();
        }
        await SeedData.InitializeAsync(db);
    }
}

app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseResponseCompression();

app.UseCors("ReactSpa");

app.UseSecurityHeaders();

app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var isHashedAsset = ctx.File.Name != "index.html" && ctx.Context.Request.Path.StartsWithSegments("/assets");
        if (isHashedAsset)
        {
            ctx.Context.Response.Headers.Append("Cache-Control", "public, max-age=31536000, immutable");
        }
        else
        {
            ctx.Context.Response.Headers.Append("Cache-Control", "no-cache, no-store, must-revalidate");
            ctx.Context.Response.Headers.Append("Pragma", "no-cache");
            ctx.Context.Response.Headers.Append("Expires", "0");
        }
    }
});
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers().RequireRateLimiting("api");
app.MapHub<InventoryHub>("/hubs/inventory").RequireAuthorization();
app.MapWebhookEndpoints();
app.MapHealthEndpoints();
app.MapFallbackToFile("index.html").AllowAnonymous();

app.Run();

public class UtcDateTimeConverter : System.Text.Json.Serialization.JsonConverter<DateTime>
{
    public override DateTime Read(ref System.Text.Json.Utf8JsonReader reader, Type typeToConvert, System.Text.Json.JsonSerializerOptions options)
    {
        var value = reader.GetDateTime();
        return DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }

    public override void Write(System.Text.Json.Utf8JsonWriter writer, DateTime value, System.Text.Json.JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToUniversalTime().ToString("O"));
    }
}
