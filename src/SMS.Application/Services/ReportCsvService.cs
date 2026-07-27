using System.Text;

namespace SMS.Application.Services;

public class ReportCsvService
{
    private const string Separator = ";";
    private static readonly string Bom = "\uFEFF";

    private static string Escape(string value)
    {
        if (value.Contains(Separator) || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }
        return value;
    }

    private static string FmtDate(DateTime? date)
        => date.HasValue ? date.Value.ToString("dd/MM/yyyy HH:mm") : "";

    private static string FmtDec(decimal value)
        => value.ToString("F2");

    private static string FmtBool(bool value)
        => value ? "Oui" : "Non";

    public string GenerateStockCsv(List<StockReportData> data)
    {
        var sb = new StringBuilder();
        sb.Append(Bom);
        sb.AppendLine(string.Join(Separator, new[]
        {
            "Produit", "Couleur", "Taille", "SKU", "Catégorie", "Stock", "Seuil", "En alerte"
        }));

        foreach (var item in data)
        {
            sb.AppendLine(string.Join(Separator, new[]
            {
                Escape(item.ProductName),
                Escape(item.ColorName),
                Escape(item.SizeValue),
                Escape(item.Sku),
                Escape(item.Category),
                item.QuantityOnHand.ToString(),
                item.ReorderLevel.ToString(),
                FmtBool(item.IsLowStock)
            }));
        }

        return sb.ToString();
    }

    public string GenerateSalesCsv(List<SalesReportData> data)
    {
        var sb = new StringBuilder();
        sb.Append(Bom);
        sb.AppendLine(string.Join(Separator, new[]
        {
            "N° Vente", "Date", "Canal", "Paiement", "Montant", "Articles", "Statut"
        }));

        foreach (var item in data)
        {
            sb.AppendLine(string.Join(Separator, new[]
            {
                Escape(item.SaleNumber),
                FmtDate(item.Date),
                Escape(item.Channel),
                Escape(item.PaymentMethod),
                FmtDec(item.TotalAmount),
                item.ItemsCount.ToString(),
                Escape(item.Status)
            }));
        }

        return sb.ToString();
    }

    public string GenerateFournisseurCsv(List<FournisseurReportData> data)
    {
        var sb = new StringBuilder();
        sb.Append(Bom);
        sb.AppendLine(string.Join(Separator, new[]
        {
            "Nom", "Contact", "Email", "Téléphone", "Produits", "Total Achats", "Factures"
        }));

        foreach (var item in data)
        {
            sb.AppendLine(string.Join(Separator, new[]
            {
                Escape(item.Name),
                Escape(item.Contact),
                Escape(item.Email),
                Escape(item.Phone),
                item.ProductCount.ToString(),
                FmtDec(item.TotalPurchases),
                item.TotalInvoices.ToString()
            }));
        }

        return sb.ToString();
    }

    public string GenerateProductsCsv(List<ProductReportData> data)
    {
        var sb = new StringBuilder();
        sb.Append(Bom);
        sb.AppendLine(string.Join(Separator, new[]
        {
            "Produit", "Catégorie", "SKU", "Couleur", "Taille", "Prix", "Coût", "Stock", "Liquidation"
        }));

        foreach (var item in data)
        {
            sb.AppendLine(string.Join(Separator, new[]
            {
                Escape(item.Name),
                Escape(item.Category),
                Escape(item.Sku),
                Escape(item.Color),
                Escape(item.Size),
                FmtDec(item.Price),
                FmtDec(item.CostPrice),
                item.Stock.ToString(),
                FmtBool(item.IsLiquidation)
            }));
        }

        return sb.ToString();
    }
}
