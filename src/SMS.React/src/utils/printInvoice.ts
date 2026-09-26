import type { InvoiceTemplateConfig } from '../api/clients'
import { printHtml } from './printBridge'

export interface InvoicePrintData {
  invoiceNumber: string
  date: string
  reference?: string
  dueDate?: string
  fournisseur?: string
  fournisseurAddress?: string
  fournisseurPhone?: string
  client?: string
  clientAddress?: string
  clientPhone?: string
  items: {
    productName: string
    sku: string
    colorName: string
    sizeValue: string
    barcode: string
    description: string
    quantity: number
    unitCost: number
    discountPercent: number
    discountAmount: number
    lineTotal: number
  }[]
  subTotal: number
  discountAmount: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  paymentTerms?: string
  notes?: string
  status?: string
  payments?: {
    date: string
    method: string
    amount: number
    reference?: string
  }[]
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function money(v: number): string {
  return v.toFixed(2) + ' DH'
}

function colAlign(col: string, idx: number): string {
  if (idx === 0) return 'center'
  if (col === 'Qté' || col === 'Rem.') return 'center'
  if (col === 'P.U.' || col === 'Total') return 'right'
  return 'left'
}

function paymentTermsLabel(terms?: string): string {
  switch (terms) {
    case 'Comptant': return 'Comptant'
    case 'Net15': return 'Net 15 jours'
    case 'Net30': return 'Net 30 jours'
    case 'Net45': return 'Net 45 jours'
    case 'Net60': return 'Net 60 jours'
    case 'Net90': return 'Net 90 jours'
    default: return terms ?? ''
  }
}

function buildHtml(t: InvoiceTemplateConfig, d: InvoicePrintData): string {
  const fs = parseInt(t.fontSize || '10')
  const ff = t.fontFamily || "'Segoe UI', Arial, sans-serif"
  const border = t.showBorders ? '1px solid #d1d5db' : 'none'

  const cols: string[] = ['#', 'Désignation']
  if (t.showSku) cols.push('Réf.')
  if (t.showBarcode) cols.push('Code-barres')
  if (t.showColor) cols.push('Couleur')
  if (t.showSize) cols.push('Taille')
  if (t.showDescription) cols.push('Description')
  cols.push('Qté', 'P.U.', 'Rem.', 'Total')

  const rows = d.items.map((item, idx) => {
    const c: string[] = []
    c.push(`<td style="padding:9px 8px;border-bottom:${border};text-align:center;color:#888;">${idx + 1}</td>`)
    c.push(`<td style="padding:9px 8px;border-bottom:${border};font-weight:600;">${esc(item.productName)}</td>`)
    if (t.showSku) c.push(`<td style="padding:9px 8px;border-bottom:${border};font-family:monospace;font-size:${fs - 2}px;color:#666;">${esc(item.sku)}</td>`)
    if (t.showBarcode) c.push(`<td style="padding:9px 8px;border-bottom:${border};font-family:monospace;font-size:${fs - 2}px;color:#666;">${esc(item.barcode || '—')}</td>`)
    if (t.showColor) c.push(`<td style="padding:9px 8px;border-bottom:${border};color:#333;">${esc(item.colorName)}</td>`)
    if (t.showSize) c.push(`<td style="padding:9px 8px;border-bottom:${border};color:#333;">${esc(item.sizeValue)}</td>`)
    if (t.showDescription) c.push(`<td style="padding:9px 8px;border-bottom:${border};font-size:${fs - 2}px;color:#666;font-style:italic;">${esc(item.description || '')}</td>`)
    c.push(`<td style="padding:9px 8px;border-bottom:${border};text-align:center;">${item.quantity}</td>`)
    c.push(`<td style="padding:9px 8px;border-bottom:${border};text-align:right;">${money(item.unitCost)}</td>`)
    c.push(`<td style="padding:9px 8px;border-bottom:${border};text-align:center;color:${item.discountPercent > 0 ? '#000' : '#ccc'};">${item.discountPercent > 0 ? item.discountPercent + '%' : '—'}</td>`)
    c.push(`<td style="padding:9px 8px;border-bottom:${border};text-align:right;font-weight:600;">${money(item.lineTotal)}</td>`)
    return `<tr>${c.join('')}</tr>`
  }).join('\n')

  const sub = d.subTotal
  const disc = d.discountAmount
  const taxAmt = d.taxAmount
  const tot = d.totalAmount
  const due = tot - d.paidAmount
  const totalPairs = d.items.reduce((s, it) => s + it.quantity, 0)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(d.invoiceNumber)}</title>
<style>
@page{size:${t.paperSize||'A4'} ${t.landscape?'landscape':'portrait'};margin:15mm;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:${ff};font-size:${fs}px;color:#000;line-height:1.5;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
@media print{html,body{margin:0;padding:0;}}
</style></head><body>
<div style="padding:20mm 18mm;">

${t.showHeader?`
<div style="margin-bottom:32px;">
<div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:16px;border-bottom:2px solid #000;">
<div>
${t.logoBase64?`<img src="${t.logoBase64}" style="max-height:50px;max-width:140px;object-fit:contain;margin-bottom:8px;filter:grayscale(100%);"/>`:''}
<div style="font-size:22px;font-weight:300;letter-spacing:6px;text-transform:uppercase;">${esc(t.shopName||'MY STORE')}</div>
${t.shopAddress?`<div style="color:#555;margin-top:4px;font-size:${fs-1}px;">${esc(t.shopAddress)}</div>`:''}
<div style="color:#555;font-size:${fs-1}px;margin-top:2px;">
${t.shopPhone?`<span>${esc(t.shopPhone)}</span>`:''}
${t.shopPhone&&t.shopEmail?'<span style="margin:0 6px;">·</span>':''}
${t.shopEmail?`<span>${esc(t.shopEmail)}</span>`:''}
</div>
${t.taxId?`<div style="color:#888;font-size:${fs-2}px;margin-top:4px;letter-spacing:1px;">IF: ${esc(t.taxId)}</div>`:''}
</div>
<div style="text-align:right;">
<div style="font-size:28px;font-weight:200;letter-spacing:8px;text-transform:uppercase;">${esc(t.headerText||'FACTURE')}</div>
${d.status&&['Cancelled','Overdue'].includes(d.status)?`<div style="margin-top:6px;display:inline-block;padding:3px 10px;border:1px solid #000;font-size:${fs-2}px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">${d.status==='Cancelled'?'Annulée':'En retard'}</div>`:''}
<div style="margin-top:12px;font-size:${fs+1}px;font-weight:600;letter-spacing:1px;">${esc(d.invoiceNumber)}</div>
${d.reference?`<div style="color:#555;font-size:${fs-1}px;margin-top:2px;">Réf: ${esc(d.reference)}</div>`:''}
<div style="color:#555;font-size:${fs-1}px;margin-top:2px;">${d.date}</div>
${d.paymentTerms?`<div style="color:#555;font-size:${fs-1}px;">Conditions: ${esc(paymentTermsLabel(d.paymentTerms))}</div>`:''}
${d.dueDate?`<div style="color:#555;font-size:${fs-1}px;">Échéance: ${esc(d.dueDate)}</div>`:''}
</div>
</div>
</div>`:''}

${d.fournisseur?`
<div style="margin-bottom:28px;display:flex;justify-content:space-between;">
<div>
<div style="font-size:${fs-2}px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:4px;font-weight:600;">Fournisseur</div>
<div style="font-weight:600;font-size:${fs+1}px;">${esc(d.fournisseur)}</div>
${d.fournisseurAddress?`<div style="color:#555;font-size:${fs-1}px;">${esc(d.fournisseurAddress)}</div>`:''}
${d.fournisseurPhone?`<div style="color:#555;font-size:${fs-1}px;">${esc(d.fournisseurPhone)}</div>`:''}
</div>
${d.client?`<div style="text-align:right;">
<div style="font-size:${fs-2}px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:4px;font-weight:600;">Client</div>
<div style="font-weight:600;font-size:${fs+1}px;">${esc(d.client)}</div>
${d.clientAddress?`<div style="color:#555;font-size:${fs-1}px;">${esc(d.clientAddress)}</div>`:''}
${d.clientPhone?`<div style="color:#555;font-size:${fs-1}px;">${esc(d.clientPhone)}</div>`:''}
</div>`:''}
</div>`:''}

<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
<thead><tr>
${cols.map((col, i) => `<th style="padding:10px 8px;font-size:${fs - 2}px;text-transform:uppercase;letter-spacing:1px;font-weight:600;text-align:${colAlign(col, i)};border-bottom:2px solid #000;border-top:1px solid #000;background:#f9f9f9;">${col}</th>`).join('\n')}
</tr></thead>
<tbody>
${rows}
</tbody>
</table>

<div style="display:flex;justify-content:flex-end;margin-bottom:24px;">
<div style="width:240px;">
<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #d1d5db;"><span style="color:#555;">${d.items.length} article(s) · ${totalPairs} paire(s)</span></div>
<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #d1d5db;"><span style="color:#555;">Sous-total</span><span style="font-weight:500;">${money(sub)}</span></div>
${disc>0?`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #d1d5db;"><span style="color:#555;">Remise</span><span style="font-weight:500;">-${money(disc)}</span></div>`:''}
${t.showTax?`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #d1d5db;"><span style="color:#555;">TVA (${(d.taxRate*100).toFixed(0)}%)</span><span style="font-weight:500;">${money(taxAmt)}</span></div>`:''}
<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:2px solid #000;border-top:1px solid #000;margin-top:4px;"><span style="font-size:${fs+4}px;font-weight:300;letter-spacing:2px;text-transform:uppercase;">Total</span><span style="font-size:${fs+4}px;font-weight:600;">${money(tot)}</span></div>
${t.showPaymentInfo?`
<div style="display:flex;justify-content:space-between;padding:6px 0;"><span style="color:#555;">Payé</span><span style="font-weight:500;">${money(d.paidAmount)}</span></div>
${due>0?`<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #d1d5db;"><span style="font-weight:600;">Reste à payer</span><span style="font-weight:600;">${money(due)}</span></div>`:''}
`:''}
</div></div>

${t.showPaymentInfo&&d.payments&&d.payments.length>0?`
<div style="margin-bottom:24px;">
<div style="font-size:${fs-2}px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:8px;font-weight:600;">Historique des paiements</div>
<table style="width:100%;border-collapse:collapse;">
<thead><tr>
<th style="padding:6px 8px;font-size:${fs-2}px;text-align:left;border-bottom:1px solid #000;color:#555;">Date</th>
<th style="padding:6px 8px;font-size:${fs-2}px;text-align:left;border-bottom:1px solid #000;color:#555;">Mode</th>
<th style="padding:6px 8px;font-size:${fs-2}px;text-align:left;border-bottom:1px solid #000;color:#555;">Référence</th>
<th style="padding:6px 8px;font-size:${fs-2}px;text-align:right;border-bottom:1px solid #000;color:#555;">Montant</th>
</tr></thead>
<tbody>
${d.payments.map((p) => `<tr>
<td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(p.date)}</td>
<td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(p.method)}</td>
<td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666;">${esc(p.reference||'—')}</td>
<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:500;">${money(p.amount)}</td>
</tr>`).join('\n')}
</tbody>
</table>
</div>`:''}

${d.notes?`<div style="margin-bottom:24px;padding:10px 14px;border-left:2px solid #000;background:#fafafa;"><div style="font-size:${fs-2}px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:4px;font-weight:600;">${esc(t.notesLabel||'Notes')}</div><div style="color:#333;font-size:${fs-1}px;">${esc(d.notes)}</div></div>`:''}

${t.showSignature?`
<div style="display:flex;justify-content:space-between;margin-top:50px;">
<div style="text-align:center;width:180px;"><div style="border-top:1px solid #000;margin-top:70px;padding-top:8px;"><div style="font-size:${fs-2}px;color:#555;letter-spacing:1px;">Fournisseur</div></div></div>
<div style="text-align:center;width:180px;"><div style="border-top:1px solid #000;margin-top:70px;padding-top:8px;"><div style="font-size:${fs-2}px;color:#555;letter-spacing:1px;">Signature & Cachet</div></div></div>
</div>`:''}

${t.showFooter?`
<div style="margin-top:40px;padding-top:14px;border-top:1px solid #000;text-align:center;">
<div style="font-size:${fs-1}px;letter-spacing:2px;text-transform:uppercase;color:#000;font-weight:300;">${esc(t.footerText||'Merci pour votre confiance!')}</div>
${(t.shopPhone||t.shopEmail||t.shopWebsite)?`<div style="color:#888;font-size:${fs-2}px;margin-top:6px;letter-spacing:1px;">
${t.shopPhone?esc(t.shopPhone):''}
${t.shopPhone&&t.shopEmail?' · ':''}
${t.shopEmail?esc(t.shopEmail):''}
${(t.shopPhone||t.shopEmail)&&t.shopWebsite?' · ':''}
${t.shopWebsite?esc(t.shopWebsite):''}
</div>`:''}
</div>`:''}

</div>
<script>window.onload = function() { window.print(); }</script>
</body></html>`
}

export function printInvoice(template: InvoiceTemplateConfig, data: InvoicePrintData): void {
  const html = buildHtml(template, data)
  printHtml(html)
}
