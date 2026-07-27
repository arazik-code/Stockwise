namespace SMS.Application.DTOs;

public class StoreSettings
{
    public const string SectionName = "Store";
    public string Name { get; set; } = "Shoe Store";
    public string Phone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
}

public class TaxSettings
{
    public const string SectionName = "Tax";
    public decimal Rate { get; set; } = 0;
}

public class ShopifySettingsUpdateRequest
{
    public string ShopDomain { get; set; } = string.Empty;
    public string? AccessToken { get; set; }
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
    public string ApiVersion { get; set; } = "2025-01";
    public string? WebhookSecret { get; set; }
    public int PollingIntervalSeconds { get; set; } = 300;
    public string LocationId { get; set; } = string.Empty;
}

public class InvoiceTemplateSettings
{
    public const string SectionName = "InvoiceTemplate";

    public string ShopName { get; set; } = "FLEX SHOES";
    public string ShopAddress { get; set; } = string.Empty;
    public string ShopPhone { get; set; } = string.Empty;
    public string ShopEmail { get; set; } = string.Empty;
    public string ShopWebsite { get; set; } = string.Empty;
    public string TaxId { get; set; } = string.Empty;
    public string LogoBase64 { get; set; } = string.Empty;

    public bool ShowSku { get; set; } = true;
    public bool ShowColor { get; set; } = true;
    public bool ShowSize { get; set; } = true;
    public bool ShowBarcode { get; set; } = false;
    public bool ShowDescription { get; set; } = false;

    public bool ShowHeader { get; set; } = true;
    public bool ShowFooter { get; set; } = true;
    public bool ShowTax { get; set; } = true;
    public bool ShowPaymentInfo { get; set; } = true;
    public bool ShowSignature { get; set; } = false;
    public bool ShowBorders { get; set; } = true;

    public string FontFamily { get; set; } = "'Segoe UI', Arial, Helvetica, sans-serif";
    public string FontSize { get; set; } = "10";

    public string HeaderText { get; set; } = "FACTURE";
    public string FooterText { get; set; } = "Merci pour votre confiance!";
    public string NotesLabel { get; set; } = "Notes";
    public string DefaultNotes { get; set; } = string.Empty;

    public string PaperSize { get; set; } = "A4";
    public bool Landscape { get; set; } = false;
}

public class ReceiptTemplateSettings
{
    public const string SectionName = "ReceiptTemplate";

    public string ShopName { get; set; } = "FLEX SHOES";
    public string ShopTagline { get; set; } = "Chaussures & Plus";
    public string ShopAddress { get; set; } = string.Empty;
    public string ShopPhone { get; set; } = string.Empty;
    public string ShopWebsite { get; set; } = string.Empty;
    public string LogoBase64 { get; set; } = string.Empty;

    public bool ShowTicketNumber { get; set; } = true;
    public bool ShowDate { get; set; } = true;
    public bool ShowCashier { get; set; } = true;
    public bool ShowVariantDetails { get; set; } = true;
    public bool ShowSku { get; set; } = false;
    public bool ShowUnitPrice { get; set; } = true;
    public bool ShowSubtotal { get; set; } = true;
    public bool ShowTax { get; set; } = true;
    public bool ShowDiscount { get; set; } = true;
    public bool ShowPaymentMethod { get; set; } = true;
    public bool ShowLoyaltyInfo { get; set; } = true;
    public bool ShowQrCode { get; set; } = true;

    public string HeaderText { get; set; } = string.Empty;
    public string FooterText { get; set; } = "Merci et a bientot!";
    public string TermsText { get; set; } = "Delai d'echange : 15 jours\nEmballage et ticket de caisse obligatoire / Etat original\nArticles Soldes et Vestes en cuir ni repris";
    public string FontFamily { get; set; } = "'Consolas', 'Courier New', monospace";
}
