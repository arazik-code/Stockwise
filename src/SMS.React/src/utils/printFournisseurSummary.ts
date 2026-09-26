import { printHtml } from './printBridge'

export interface FournisseurSummaryInvoice {
  invoiceNumber: string
  date: string
  dueDate?: string
  status: string
  totalAmount: number
  paidAmount: number
  balanceDue: number
}

export interface FournisseurSummaryData {
  fournisseurName: string
  fournisseurPhone?: string
  fournisseurAddress?: string
  shopName?: string
  invoices: FournisseurSummaryInvoice[]
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function money(v: number): string {
  return v.toFixed(2) + ' DH'
}

const STATUS_LABELS: Record<string, string> = {
  Pending: 'En attente',
  Paid: 'Payée',
  PartiallyPaid: 'Partiellement payée',
  Overdue: 'En retard',
  Cancelled: 'Annulée',
  Received: 'Réceptionnée',
}

// A brief, single-page account statement for one supplier - every invoice raised against them,
// what's owed, what's settled. Deliberately independent of the full InvoiceTemplateConfig used by
// printInvoice.ts (fonts/logos/toggles): this is a quick internal reference document, not a
// customer-facing invoice, so it always renders the same compact way regardless of how the shop's
// invoice template is configured.
function buildHtml(d: FournisseurSummaryData): string {
  const totalAmount = d.invoices.reduce((s, i) => s + i.totalAmount, 0)
  const totalPaid = d.invoices.reduce((s, i) => s + i.paidAmount, 0)
  const totalBalance = d.invoices.reduce((s, i) => s + i.balanceDue, 0)
  const printDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  const rows = d.invoices.map((inv) => `<tr>
<td style="padding:8px;border-bottom:1px solid #e5e5e5;font-weight:600;">${esc(inv.invoiceNumber)}</td>
<td style="padding:8px;border-bottom:1px solid #e5e5e5;color:#555;">${esc(inv.date)}</td>
<td style="padding:8px;border-bottom:1px solid #e5e5e5;color:#555;">${inv.dueDate ? esc(inv.dueDate) : '—'}</td>
<td style="padding:8px;border-bottom:1px solid #e5e5e5;">${esc(STATUS_LABELS[inv.status] ?? inv.status)}</td>
<td style="padding:8px;border-bottom:1px solid #e5e5e5;text-align:right;">${money(inv.totalAmount)}</td>
<td style="padding:8px;border-bottom:1px solid #e5e5e5;text-align:right;">${money(inv.paidAmount)}</td>
<td style="padding:8px;border-bottom:1px solid #e5e5e5;text-align:right;font-weight:600;${inv.balanceDue > 0 ? 'color:#b91c1c;' : ''}">${money(inv.balanceDue)}</td>
</tr>`).join('\n')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Résumé - ${esc(d.fournisseurName)}</title>
<style>
@page{size:A4 portrait;margin:15mm;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#000;line-height:1.5;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
@media print{html,body{margin:0;padding:0;}}
</style></head><body>
<div style="padding:16mm;">

<div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:14px;border-bottom:2px solid #000;margin-bottom:24px;">
<div>
<div style="font-size:20px;font-weight:300;letter-spacing:5px;text-transform:uppercase;">${esc(d.shopName || 'MY STORE')}</div>
<div style="color:#888;font-size:9px;margin-top:4px;">Édité le ${printDate}</div>
</div>
<div style="text-align:right;font-size:18px;font-weight:200;letter-spacing:4px;text-transform:uppercase;">Résumé Factures</div>
</div>

<div style="margin-bottom:22px;">
<div style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:4px;font-weight:600;">Fournisseur</div>
<div style="font-weight:600;font-size:14px;">${esc(d.fournisseurName)}</div>
${d.fournisseurAddress ? `<div style="color:#555;font-size:10px;">${esc(d.fournisseurAddress)}</div>` : ''}
${d.fournisseurPhone ? `<div style="color:#555;font-size:10px;">${esc(d.fournisseurPhone)}</div>` : ''}
</div>

<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
<thead><tr>
<th style="padding:8px;font-size:9px;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:2px solid #000;border-top:1px solid #000;background:#f9f9f9;">N° Facture</th>
<th style="padding:8px;font-size:9px;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:2px solid #000;border-top:1px solid #000;background:#f9f9f9;">Date</th>
<th style="padding:8px;font-size:9px;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:2px solid #000;border-top:1px solid #000;background:#f9f9f9;">Échéance</th>
<th style="padding:8px;font-size:9px;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:2px solid #000;border-top:1px solid #000;background:#f9f9f9;">Statut</th>
<th style="padding:8px;font-size:9px;text-transform:uppercase;letter-spacing:1px;text-align:right;border-bottom:2px solid #000;border-top:1px solid #000;background:#f9f9f9;">Total</th>
<th style="padding:8px;font-size:9px;text-transform:uppercase;letter-spacing:1px;text-align:right;border-bottom:2px solid #000;border-top:1px solid #000;background:#f9f9f9;">Payé</th>
<th style="padding:8px;font-size:9px;text-transform:uppercase;letter-spacing:1px;text-align:right;border-bottom:2px solid #000;border-top:1px solid #000;background:#f9f9f9;">Solde</th>
</tr></thead>
<tbody>
${rows}
</tbody>
</table>

<div style="display:flex;justify-content:flex-end;">
<div style="width:280px;">
<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #d1d5db;"><span style="color:#555;">${d.invoices.length} facture(s)</span></div>
<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #d1d5db;"><span style="color:#555;">Total facturé</span><span style="font-weight:500;">${money(totalAmount)}</span></div>
<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #d1d5db;"><span style="color:#555;">Total payé</span><span style="font-weight:500;">${money(totalPaid)}</span></div>
<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:2px solid #000;border-top:1px solid #000;margin-top:4px;"><span style="font-size:14px;font-weight:300;letter-spacing:1px;text-transform:uppercase;">Solde dû</span><span style="font-size:14px;font-weight:600;">${money(totalBalance)}</span></div>
</div>
</div>

</div>
<script>window.onload = function() { window.print(); }</script>
</body></html>`
}

export function printFournisseurSummary(data: FournisseurSummaryData): void {
  printHtml(buildHtml(data))
}
