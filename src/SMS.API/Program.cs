using System.Text;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
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
builder.Services.AddScoped<ThermalPrinterService>();
builder.Services.AddScoped<ReportPdfService>();
builder.Services.AddScoped<ReportCsvService>();

builder.Services.Configure<LoyaltySettings>(builder.Configuration.GetSection(LoyaltySettings.SectionName));
builder.Services.Configure<StoreSettings>(builder.Configuration.GetSection(StoreSettings.SectionName));
builder.Services.Configure<TaxSettings>(builder.Configuration.GetSection(TaxSettings.SectionName));
builder.Services.Configure<InvoiceTemplateSettings>(builder.Configuration.GetSection(InvoiceTemplateSettings.SectionName));
builder.Services.Configure<ReceiptTemplateSettings>(builder.Configuration.GetSection(ReceiptTemplateSettings.SectionName));

builder.Services.AddValidatorsFromAssemblyContaining<CreateProductValidator>();

var jwtSecret = builder.Configuration["Jwt:SecretKey"] ?? throw new InvalidOperationException("Jwt:SecretKey is not configured");
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
});
builder.Services.AddAuthorization();

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

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactSpa", policy =>
        policy.WithOrigins(
                builder.Configuration["React:BaseUrl"] ?? "http://localhost:5173",
                "http://localhost:5173",
                "http://localhost:5001",
                "http://192.168.1.105:5173",
                "http://192.168.1.105:5001")
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
        // Was EnsureCreatedAsync() with 14 unapplied EF migrations sitting unused in the repo -
        // no upgrade path existed for the live database and schema changes were all hand-written
        // SQL. The live DB has since been stamped with an InitialBaseline migration matching its
        // actual schema (verified via a full column/type/nullability diff against a prod restore),
        // so MigrateAsync is now safe: it is a no-op today and applies real migrations going forward.
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

app.UseCors("ReactSpa");
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Cache-Control", "no-cache, no-store, must-revalidate");
        ctx.Context.Response.Headers.Append("Pragma", "no-cache");
        ctx.Context.Response.Headers.Append("Expires", "0");
    }
});
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<InventoryHub>("/hubs/inventory");
app.MapWebhookEndpoints();
app.MapHealthEndpoints();
app.MapFallbackToFile("index.html");

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
