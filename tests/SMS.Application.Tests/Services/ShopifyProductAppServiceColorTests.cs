using SMS.Application.Services;

namespace SMS.Application.Tests.Services;

/// <summary>
/// Covers ShopifyProductAppService.ExtractColorFromTitle against real product titles pulled live
/// from this store's actual Shopify catalog - this is the fallback used when a product has no
/// Shopify color option (confirmed to be every product in this catalog: each one exposes a single
/// "Pointures" size option only, color lives only in the title).
/// </summary>
public class ShopifyProductAppServiceColorTests
{
    [Theory]
    [InlineData("Basket  En Cuir Beige - Hirman", "Beige")]
    [InlineData("Basket  En Cuir BLeu -  Cala", "Bleu")] // mixed-case typo
    [InlineData("Basket  En Cuir Grise - Tamesna", "Gris")] // feminine form normalizes to the masculine canonical
    [InlineData("Basket  en Cuir Daim Beige  - Vigo - Semelle 🇮🇹", "Beige")]
    [InlineData("Bally - Derby a pampilles en Cuir Noir", "Noir")] // color at the very end, no dash structure
    [InlineData("Basket En Cuir Marron -  Aknou", "Marron")]
    [InlineData("Chaussure bateau En Cuir Maron", "Marron")] // single-r typo, real catalog data
    [InlineData("Kooper - Sneakers en cuir blancs", "Blanc")] // plural form
    [InlineData("Larache  – Mocassin Daim Bleu Marine pour Hommes", "Bleu Marine")] // compound must win over plain "Bleu"
    [InlineData("Basket En Cuir Blue Marine - Ouazzane", "Bleu Marine")] // English spelling of the same compound
    [InlineData("Boots Benny Cognac", "Cognac")]
    [InlineData("Bottine Chelsea En Cuir Marron Chocolat - Tidsi", "Marron / Chocolat")] // two color words, reading order preserved
    [InlineData("Basket En Cuir Camel & Beige - Ouazzane", "Camel / Beige")]
    [InlineData("Black Leather Shoe - Sefrou", "Noir")] // English-titled product
    public void ExtractColorFromTitle_RealCatalogTitles_ReturnsExpectedColor(string title, string expected)
    {
        Assert.Equal(expected, ShopifyProductAppService.ExtractColorFromTitle(title));
    }

    [Theory]
    [InlineData("Baskets En Cuir Tendance Et Confortables.")] // genuinely no color word - must fall back to "Standard" upstream
    [InlineData("Sans titre 16sept._11:42")]
    [InlineData("")]
    [InlineData(null)]
    public void ExtractColorFromTitle_NoColorWordPresent_ReturnsNull(string? title)
    {
        Assert.Null(ShopifyProductAppService.ExtractColorFromTitle(title));
    }
}
