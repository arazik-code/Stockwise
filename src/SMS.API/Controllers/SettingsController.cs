using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using SMS.API.Authorization;
using SMS.Application.DTOs;
using SMS.Domain.Constants;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireSection(Sections.Settings)]
public class SettingsController : ControllerBase
{
    private readonly IConfigurationRoot _configRoot;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;

    public SettingsController(IConfiguration config, IWebHostEnvironment env)
    {
        _config = config;
        _configRoot = (IConfigurationRoot)config;
        _env = env;
    }

    private string ConfigPath => Path.Combine(_env.ContentRootPath, "appsettings.json");

    private async Task ReloadConfig(CancellationToken ct)
    {
        _configRoot.Reload();
        await Task.CompletedTask;
    }

    private static string Sanitize(string? value, int maxLength = 500)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        var cleaned = Regex.Replace(value, "<[^>]*>", "");
        cleaned = System.Net.WebUtility.HtmlEncode(cleaned);
        return cleaned.Length > maxLength ? cleaned[..maxLength] : cleaned;
    }

    private static bool ValidateNoScriptInjection(string? value, string fieldName)
    {
        if (string.IsNullOrEmpty(value)) return true;
        var patterns = new[] { "<script", "javascript:", "onerror=", "onload=", "onclick=", "onmouse" };
        return !patterns.Any(p => value.Contains(p, StringComparison.OrdinalIgnoreCase));
    }

    // ── Loyalty ──

    [HttpGet("loyalty")]
    public IActionResult GetLoyaltySettings()
    {
        var s = _config.GetSection("Loyalty");
        return Ok(new
        {
            NewClientRate = s.GetValue<int>("NewClientRate"),
            AncientClientRate = s.GetValue<int>("AncientClientRate"),
            PremiumClientRate = s.GetValue<int>("PremiumClientRate"),
            PointsForRedemption = s.GetValue<int>("PointsForRedemption"),
            DhPerRedemption = s.GetValue<decimal>("DhPerRedemption"),
            WelcomePoints = s.GetValue<int>("WelcomePoints"),
            Enabled = s.GetValue<bool>("Enabled")
        });
    }

    [HttpPut("loyalty")]
    public async Task<IActionResult> UpdateLoyaltySettings([FromBody] LoyaltySettings updated, CancellationToken ct)
    {
        var json = await System.IO.File.ReadAllTextAsync(ConfigPath, ct);
        var root = JsonSerializer.Deserialize<Dictionary<string, object?>>(json) ?? [];

        root["Loyalty"] = new Dictionary<string, object>
        {
            ["NewClientRate"] = updated.NewClientRate,
            ["AncientClientRate"] = updated.AncientClientRate,
            ["PremiumClientRate"] = updated.PremiumClientRate,
            ["PointsForRedemption"] = updated.PointsForRedemption,
            ["DhPerRedemption"] = updated.DhPerRedemption,
            ["WelcomePoints"] = updated.WelcomePoints,
            ["Enabled"] = updated.Enabled
        };

        await System.IO.File.WriteAllTextAsync(ConfigPath, JsonSerializer.Serialize(root, new JsonSerializerOptions { WriteIndented = true }), ct);
        await ReloadConfig(ct);
        return Ok(updated);
    }

    // ── Store ──

    [HttpGet("store")]
    public IActionResult GetStoreSettings()
    {
        var s = _config.GetSection("Store");
        return Ok(new
        {
            Name = s.GetValue<string>("Name") ?? "",
            Phone = s.GetValue<string>("Phone") ?? "",
            Address = s.GetValue<string>("Address") ?? ""
        });
    }

    [HttpPut("store")]
    public async Task<IActionResult> UpdateStoreSettings([FromBody] StoreSettings updated, CancellationToken ct)
    {
        if (!ValidateNoScriptInjection(updated.Name, "Name") ||
            !ValidateNoScriptInjection(updated.Phone, "Phone") ||
            !ValidateNoScriptInjection(updated.Address, "Address"))
            return BadRequest(new { message = "Contenu invalide detecte" });

        var json = await System.IO.File.ReadAllTextAsync(ConfigPath, ct);
        var root = JsonSerializer.Deserialize<Dictionary<string, object?>>(json) ?? [];

        root["Store"] = new Dictionary<string, object>
        {
            ["Name"] = Sanitize(updated.Name),
            ["Phone"] = Sanitize(updated.Phone, 20),
            ["Address"] = Sanitize(updated.Address, 300)
        };

        await System.IO.File.WriteAllTextAsync(ConfigPath, JsonSerializer.Serialize(root, new JsonSerializerOptions { WriteIndented = true }), ct);
        await ReloadConfig(ct);
        return Ok(new { Name = Sanitize(updated.Name), Phone = Sanitize(updated.Phone, 20), Address = Sanitize(updated.Address, 300) });
    }

    // ── Tax ──

    [HttpGet("tax")]
    public IActionResult GetTaxSettings()
    {
        var s = _config.GetSection("Tax");
        return Ok(new { Rate = s.GetValue<decimal>("Rate") });
    }

    [HttpPut("tax")]
    public async Task<IActionResult> UpdateTaxSettings([FromBody] TaxSettings updated, CancellationToken ct)
    {
        if (updated.Rate < 0 || updated.Rate > 100)
            return BadRequest(new { message = "Le taux de taxe doit etre entre 0 et 100" });

        var json = await System.IO.File.ReadAllTextAsync(ConfigPath, ct);
        var root = JsonSerializer.Deserialize<Dictionary<string, object?>>(json) ?? [];

        root["Tax"] = new Dictionary<string, object>
        {
            ["Rate"] = updated.Rate
        };

        await System.IO.File.WriteAllTextAsync(ConfigPath, JsonSerializer.Serialize(root, new JsonSerializerOptions { WriteIndented = true }), ct);
        await ReloadConfig(ct);
        return Ok(updated);
    }

    // ── Invoice Template ──

    [HttpGet("invoice-template")]
    public IActionResult GetInvoiceTemplateSettings()
    {
        var s = _config.GetSection("InvoiceTemplate");
        return Ok(new InvoiceTemplateSettings
        {
            ShopName = s.GetValue<string>("ShopName") ?? "MY STORE",
            ShopAddress = s.GetValue<string>("ShopAddress") ?? "",
            ShopPhone = s.GetValue<string>("ShopPhone") ?? "",
            ShopEmail = s.GetValue<string>("ShopEmail") ?? "",
            ShopWebsite = s.GetValue<string>("ShopWebsite") ?? "",
            TaxId = s.GetValue<string>("TaxId") ?? "",
            LogoBase64 = s.GetValue<string>("LogoBase64") ?? "",
            ShowSku = s.GetValue<bool>("ShowSku"),
            ShowColor = s.GetValue<bool>("ShowColor"),
            ShowSize = s.GetValue<bool>("ShowSize"),
            ShowBarcode = s.GetValue<bool>("ShowBarcode"),
            ShowDescription = s.GetValue<bool>("ShowDescription"),
            ShowHeader = s.GetValue<bool>("ShowHeader"),
            ShowFooter = s.GetValue<bool>("ShowFooter"),
            ShowTax = s.GetValue<bool>("ShowTax"),
            ShowPaymentInfo = s.GetValue<bool>("ShowPaymentInfo"),
            ShowSignature = s.GetValue<bool>("ShowSignature"),
            ShowBorders = s.GetValue<bool>("ShowBorders"),
            FontFamily = s.GetValue<string>("FontFamily") ?? "'Segoe UI', Arial, sans-serif",
            FontSize = s.GetValue<string>("FontSize") ?? "10",
            HeaderText = s.GetValue<string>("HeaderText") ?? "FACTURE",
            FooterText = s.GetValue<string>("FooterText") ?? "Merci pour votre confiance!",
            NotesLabel = s.GetValue<string>("NotesLabel") ?? "Notes",
            DefaultNotes = s.GetValue<string>("DefaultNotes") ?? "",
            PaperSize = s.GetValue<string>("PaperSize") ?? "A4",
            Landscape = s.GetValue<bool>("Landscape")
        });
    }

    [HttpPut("invoice-template")]
    public async Task<IActionResult> UpdateInvoiceTemplateSettings([FromBody] InvoiceTemplateSettings updated, CancellationToken ct)
    {
        var json = await System.IO.File.ReadAllTextAsync(ConfigPath, ct);
        var root = JsonSerializer.Deserialize<Dictionary<string, object?>>(json) ?? [];

        root["InvoiceTemplate"] = new Dictionary<string, object>
        {
            ["ShopName"] = Sanitize(updated.ShopName),
            ["ShopAddress"] = Sanitize(updated.ShopAddress, 300),
            ["ShopPhone"] = Sanitize(updated.ShopPhone, 20),
            ["ShopEmail"] = Sanitize(updated.ShopEmail, 100),
            ["ShopWebsite"] = Sanitize(updated.ShopWebsite, 200),
            ["TaxId"] = Sanitize(updated.TaxId, 50),
            ["LogoBase64"] = updated.LogoBase64 ?? "",
            ["ShowSku"] = updated.ShowSku,
            ["ShowColor"] = updated.ShowColor,
            ["ShowSize"] = updated.ShowSize,
            ["ShowBarcode"] = updated.ShowBarcode,
            ["ShowDescription"] = updated.ShowDescription,
            ["ShowHeader"] = updated.ShowHeader,
            ["ShowFooter"] = updated.ShowFooter,
            ["ShowTax"] = updated.ShowTax,
            ["ShowPaymentInfo"] = updated.ShowPaymentInfo,
            ["ShowSignature"] = updated.ShowSignature,
            ["ShowBorders"] = updated.ShowBorders,
            ["FontFamily"] = Sanitize(updated.FontFamily, 100),
            ["FontSize"] = Sanitize(updated.FontSize, 10),
            ["HeaderText"] = Sanitize(updated.HeaderText, 100),
            ["FooterText"] = Sanitize(updated.FooterText, 300),
            ["NotesLabel"] = Sanitize(updated.NotesLabel, 50),
            ["DefaultNotes"] = Sanitize(updated.DefaultNotes, 500),
            ["PaperSize"] = Sanitize(updated.PaperSize, 20),
            ["Landscape"] = updated.Landscape
        };

        await System.IO.File.WriteAllTextAsync(ConfigPath, JsonSerializer.Serialize(root, new JsonSerializerOptions { WriteIndented = true }), ct);
        await ReloadConfig(ct);
        return Ok(updated);
    }

    // ── Shopify ──

    [HttpGet("shopify")]
    public IActionResult GetShopifySettings()
    {
        var s = _config.GetSection("Shopify");
        var accessToken = s.GetValue<string>("AccessToken") ?? "";
        var webhookSecret = s.GetValue<string>("WebhookSecret") ?? "";
        var clientId = s.GetValue<string>("ClientId") ?? "";
        var clientSecret = s.GetValue<string>("ClientSecret") ?? "";
        return Ok(new
        {
            ShopDomain = s.GetValue<string>("ShopDomain") ?? "",
            ApiVersion = s.GetValue<string>("ApiVersion") ?? "2025-01",
            LocationId = s.GetValue<string>("LocationId") ?? "",
            PollingIntervalSeconds = s.GetValue<int?>("PollingIntervalSeconds") ?? 300,
            AccessTokenSet = !string.IsNullOrEmpty(accessToken),
            AccessTokenMasked = MaskSecret(accessToken),
            WebhookSecretSet = !string.IsNullOrEmpty(webhookSecret),
            WebhookSecretMasked = MaskSecret(webhookSecret),
            ClientIdSet = !string.IsNullOrEmpty(clientId),
            ClientIdMasked = MaskSecret(clientId),
            ClientSecretSet = !string.IsNullOrEmpty(clientSecret),
            ClientSecretMasked = MaskSecret(clientSecret)
        });
    }

    [HttpPut("shopify")]
    public async Task<IActionResult> UpdateShopifySettings([FromBody] ShopifySettingsUpdateRequest updated, CancellationToken ct)
    {
        var json = await System.IO.File.ReadAllTextAsync(ConfigPath, ct);
        var root = JsonSerializer.Deserialize<Dictionary<string, object?>>(json) ?? [];

        var existing = _config.GetSection("Shopify");
        var accessToken = string.IsNullOrEmpty(updated.AccessToken) ? existing.GetValue<string>("AccessToken") ?? "" : updated.AccessToken;
        var webhookSecret = string.IsNullOrEmpty(updated.WebhookSecret) ? existing.GetValue<string>("WebhookSecret") ?? "" : updated.WebhookSecret;
        var clientId = string.IsNullOrEmpty(updated.ClientId) ? existing.GetValue<string>("ClientId") ?? "" : updated.ClientId;
        var clientSecret = string.IsNullOrEmpty(updated.ClientSecret) ? existing.GetValue<string>("ClientSecret") ?? "" : updated.ClientSecret;

        root["Shopify"] = new Dictionary<string, object>
        {
            ["ShopDomain"] = Sanitize(updated.ShopDomain, 200),
            ["AccessToken"] = accessToken,
            ["ClientId"] = clientId,
            ["ClientSecret"] = clientSecret,
            ["ApiVersion"] = Sanitize(updated.ApiVersion, 20),
            ["WebhookSecret"] = webhookSecret,
            ["PollingIntervalSeconds"] = updated.PollingIntervalSeconds,
            ["LocationId"] = Sanitize(updated.LocationId, 50),
            ["MaxRetryAttempts"] = 3
        };

        await System.IO.File.WriteAllTextAsync(ConfigPath, JsonSerializer.Serialize(root, new JsonSerializerOptions { WriteIndented = true }), ct);
        await ReloadConfig(ct);
        return Ok(new { message = "Parametres Shopify enregistres. Redemarrez l'application pour appliquer les changements." });
    }

    private static string MaskSecret(string value)
        => string.IsNullOrEmpty(value) ? "" : value.Length <= 4 ? "****" : $"****{value[^4..]}";

    // ── OzonExpress ──

    [HttpGet("ozonexpress")]
    public IActionResult GetOzonSettings()
    {
        var s = _config.GetSection("OzonExpress");
        var customerId = s.GetValue<string>("CustomerId") ?? "";
        var apiKey = s.GetValue<string>("ApiKey") ?? "";
        return Ok(new
        {
            CustomerId = customerId,
            ApiKeySet = !string.IsNullOrEmpty(apiKey),
            ApiKeyMasked = MaskSecret(apiKey)
        });
    }

    public record OzonSettingsUpdateRequest(string CustomerId, string? ApiKey);

    [HttpPut("ozonexpress")]
    public async Task<IActionResult> UpdateOzonSettings([FromBody] OzonSettingsUpdateRequest updated, CancellationToken ct)
    {
        var json = await System.IO.File.ReadAllTextAsync(ConfigPath, ct);
        var root = JsonSerializer.Deserialize<Dictionary<string, object?>>(json) ?? [];

        var existing = _config.GetSection("OzonExpress");
        var apiKey = string.IsNullOrEmpty(updated.ApiKey) ? existing.GetValue<string>("ApiKey") ?? "" : updated.ApiKey;

        root["OzonExpress"] = new Dictionary<string, object>
        {
            ["CustomerId"] = Sanitize(updated.CustomerId, 50),
            ["ApiKey"] = apiKey
        };

        await System.IO.File.WriteAllTextAsync(ConfigPath, JsonSerializer.Serialize(root, new JsonSerializerOptions { WriteIndented = true }), ct);
        await ReloadConfig(ct);
        return Ok(new { message = "Parametres OzonExpress enregistres. Redemarrez l'application pour appliquer les changements." });
    }

    // ── Receipt Template ──

    [HttpGet("receipt-template")]
    public IActionResult GetReceiptTemplateSettings()
    {
        var s = _config.GetSection("ReceiptTemplate");
        return Ok(new ReceiptTemplateSettings
        {
            ShopName = s.GetValue<string>("ShopName") ?? "MY STORE",
            ShopTagline = s.GetValue<string>("ShopTagline") ?? "Thank you for shopping with us",
            ShopAddress = s.GetValue<string>("ShopAddress") ?? "",
            ShopPhone = s.GetValue<string>("ShopPhone") ?? "",
            ShopWebsite = s.GetValue<string>("ShopWebsite") ?? "",
            LogoBase64 = s.GetValue<string>("LogoBase64") ?? "",
            ShowTicketNumber = s.GetValue<bool>("ShowTicketNumber"),
            ShowDate = s.GetValue<bool>("ShowDate"),
            ShowCashier = s.GetValue<bool>("ShowCashier"),
            ShowVariantDetails = s.GetValue<bool>("ShowVariantDetails"),
            ShowSku = s.GetValue<bool>("ShowSku"),
            ShowUnitPrice = s.GetValue<bool>("ShowUnitPrice"),
            ShowSubtotal = s.GetValue<bool>("ShowSubtotal"),
            ShowTax = s.GetValue<bool>("ShowTax"),
            ShowDiscount = s.GetValue<bool>("ShowDiscount"),
            ShowPaymentMethod = s.GetValue<bool>("ShowPaymentMethod"),
            ShowLoyaltyInfo = s.GetValue<bool>("ShowLoyaltyInfo"),
            ShowQrCode = s.GetValue<bool>("ShowQrCode"),
            HeaderText = s.GetValue<string>("HeaderText") ?? "",
            FooterText = s.GetValue<string>("FooterText") ?? "Merci et a bientot!",
            TermsText = s.GetValue<string>("TermsText") ?? "Delai d'echange : 15 jours\nEmballage et ticket de caisse obligatoire / Etat original\nArticles Soldes et Vestes en cuir ni repris",
            FontFamily = s.GetValue<string>("FontFamily") ?? "'Consolas', 'Courier New', monospace"
        });
    }

    [HttpPut("receipt-template")]
    public async Task<IActionResult> UpdateReceiptTemplateSettings([FromBody] ReceiptTemplateSettings updated, CancellationToken ct)
    {
        var json = await System.IO.File.ReadAllTextAsync(ConfigPath, ct);
        var root = JsonSerializer.Deserialize<Dictionary<string, object?>>(json) ?? [];

        root["ReceiptTemplate"] = new Dictionary<string, object>
        {
            ["ShopName"] = Sanitize(updated.ShopName),
            ["ShopTagline"] = Sanitize(updated.ShopTagline, 100),
            ["ShopAddress"] = Sanitize(updated.ShopAddress, 300),
            ["ShopPhone"] = Sanitize(updated.ShopPhone, 20),
            ["ShopWebsite"] = Sanitize(updated.ShopWebsite, 200),
            ["LogoBase64"] = updated.LogoBase64 ?? "",
            ["ShowTicketNumber"] = updated.ShowTicketNumber,
            ["ShowDate"] = updated.ShowDate,
            ["ShowCashier"] = updated.ShowCashier,
            ["ShowVariantDetails"] = updated.ShowVariantDetails,
            ["ShowSku"] = updated.ShowSku,
            ["ShowUnitPrice"] = updated.ShowUnitPrice,
            ["ShowSubtotal"] = updated.ShowSubtotal,
            ["ShowTax"] = updated.ShowTax,
            ["ShowDiscount"] = updated.ShowDiscount,
            ["ShowPaymentMethod"] = updated.ShowPaymentMethod,
            ["ShowLoyaltyInfo"] = updated.ShowLoyaltyInfo,
            ["ShowQrCode"] = updated.ShowQrCode,
            ["HeaderText"] = Sanitize(updated.HeaderText, 100),
            ["FooterText"] = Sanitize(updated.FooterText, 300),
            ["TermsText"] = Sanitize(updated.TermsText, 500),
            ["FontFamily"] = Sanitize(updated.FontFamily, 100)
        };

        await System.IO.File.WriteAllTextAsync(ConfigPath, JsonSerializer.Serialize(root, new JsonSerializerOptions { WriteIndented = true }), ct);
        await ReloadConfig(ct);
        return Ok(updated);
    }
}
