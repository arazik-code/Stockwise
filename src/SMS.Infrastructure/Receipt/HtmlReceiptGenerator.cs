using System.Globalization;
using System.Text;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Receipt;

public class HtmlReceiptGenerator
{
    private static string FormatMAD(decimal amount)
        => amount.ToString("N2", new CultureInfo("fr-MA")).Replace(",", " ") + " MAD";

    public string GenerateReceiptHtml(Sale sale)
    {
        var sb = new StringBuilder();
        sb.AppendLine("<!DOCTYPE html>");
        sb.AppendLine("<html><head><style>");
        sb.AppendLine("body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px}");
        sb.AppendLine(".center{text-align:center}.bold{font-weight:bold}");
        sb.AppendLine(".line{border-top:1px dashed #000;margin:5px 0}");
        sb.AppendLine("table{width:100%;border-collapse:collapse}");
        sb.AppendLine("td{padding:2px 0}.right{text-align:right}");
        sb.AppendLine("</style></head><body>");

        sb.AppendLine("<div class='center bold'>BOUTIQUE CHAUSSURES</div>");
        sb.AppendLine("<div class='center'>123 Rue Principale, Casablanca</div>");
        sb.AppendLine("<div class='center'>Tél : (555) 123-4567</div>");
        sb.AppendLine("<div class='line'></div>");

        sb.AppendLine($"<div>Date : {sale.CreatedAt:dd/MM/yyyy HH:mm}</div>");
        sb.AppendLine($"<div>Reçu : {sale.SaleNumber}</div>");
        sb.AppendLine($"<div>Caissier : {sale.User?.FullName ?? "N/A"}</div>");
        sb.AppendLine("<div class='line'></div>");

        sb.AppendLine("<table>");
        sb.AppendLine("<tr><td class='bold'>Article</td><td class='right bold'>Total</td></tr>");
        foreach (var item in sale.Items)
        {
            sb.AppendLine($"<tr><td>{item.ProductVariant?.Product?.Name ?? "Article"}</td><td></td></tr>");
            sb.AppendLine($"<tr><td>  {item.Quantity} x {FormatMAD(item.UnitPrice)}</td><td class='right'>{FormatMAD(item.LineTotal)}</td></tr>");
        }
        sb.AppendLine("</table>");

        sb.AppendLine("<div class='line'></div>");
        sb.AppendLine($"<table><tr><td>Sous-total</td><td class='right'>{FormatMAD(sale.SubTotal)}</td></tr>");
        sb.AppendLine($"<tr><td>Taxe</td><td class='right'>{FormatMAD(sale.TaxAmount)}</td></tr>");
        if (sale.DiscountAmount > 0)
            sb.AppendLine($"<tr><td>Remise</td><td class='right'>-{FormatMAD(sale.DiscountAmount)}</td></tr>");
        sb.AppendLine($"<tr class='bold'><td>TOTAL</td><td class='right'>{FormatMAD(sale.TotalAmount)}</td></tr></table>");

        sb.AppendLine("<div class='line'></div>");
        sb.AppendLine($"<div>Paiement : {sale.PaymentMethod}</div>");
        sb.AppendLine($"<div>Montant payé : {FormatMAD(sale.AmountPaid)}</div>");
        if (sale.ChangeGiven > 0)
            sb.AppendLine($"<div>Monnaie : {FormatMAD(sale.ChangeGiven)}</div>");

        sb.AppendLine("<div class='line'></div>");
        sb.AppendLine("<div class='center'>Merci pour votre achat !</div>");
        sb.AppendLine("</body></html>");

        return sb.ToString();
    }
}
