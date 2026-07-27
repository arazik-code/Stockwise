export interface PackingSlipData {
  orderNumber: string
  channel: string
  createdAt: string
  customerName: string
  customerPhone?: string
  addressLine?: string
  city?: string
  carrierName?: string
  trackingNumber?: string
  paymentMethod: string
  paymentStatus: string
  totalAmount: number
  items: {
    productName: string
    sku: string
    colorName?: string
    sizeValue?: string
    quantity: number
  }[]
  notes?: string
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const PAYMENT_LABELS: Record<string, string> = {
  COD: 'Paiement à la livraison',
  Manual: 'Paiement manuel',
  BankTransfer: 'Virement bancaire',
  ShopifyCheckout: 'Payé en ligne (Shopify)',
}

function buildHtml(d: PackingSlipData): string {
  const rows = d.items.map((item, idx) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;color:#888;">${idx + 1}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;font-weight:600;">${esc(item.productName)}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;color:#555;">${esc(item.colorName || '—')} / ${esc(item.sizeValue || '—')}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;font-family:monospace;font-size:11px;color:#666;">${esc(item.sku)}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;font-weight:600;">${item.quantity}</td>
    </tr>`).join('\n')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(d.orderNumber)}</title>
<style>
@page{size:A4 portrait;margin:15mm;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#000;line-height:1.5;}
</style></head><body>
<div style="padding:10mm;">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:14px;border-bottom:2px solid #000;margin-bottom:20px;">
    <div>
      <div style="font-size:22px;font-weight:300;letter-spacing:4px;text-transform:uppercase;">Bon de préparation</div>
      <div style="color:#555;margin-top:4px;">Canal: ${esc(d.channel)} · ${esc(d.createdAt)}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:20px;font-weight:600;">${esc(d.orderNumber)}</div>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
    <div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:4px;font-weight:600;">Destinataire</div>
      <div style="font-weight:600;font-size:14px;">${esc(d.customerName)}</div>
      ${d.customerPhone ? `<div style="color:#555;">${esc(d.customerPhone)}</div>` : ''}
      ${d.addressLine ? `<div style="color:#555;">${esc(d.addressLine)}</div>` : ''}
      ${d.city ? `<div style="color:#555;">${esc(d.city)}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:4px;font-weight:600;">Livraison</div>
      <div style="font-weight:600;">${esc(d.carrierName || 'Non assignée')}</div>
      ${d.trackingNumber ? `<div style="color:#555;font-family:monospace;">${esc(d.trackingNumber)}</div>` : ''}
      <div style="color:#555;margin-top:6px;">${esc(PAYMENT_LABELS[d.paymentMethod] || d.paymentMethod)}</div>
      <div style="color:${d.paymentStatus === 'Paid' ? '#059669' : '#dc2626'};font-weight:600;">${d.paymentStatus === 'Paid' ? 'PAYÉ' : `À ENCAISSER: ${d.totalAmount.toFixed(2)} DH`}</div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead><tr>
      <th style="padding:8px;font-size:10px;text-transform:uppercase;text-align:center;border-bottom:2px solid #000;background:#f5f5f5;">#</th>
      <th style="padding:8px;font-size:10px;text-transform:uppercase;text-align:left;border-bottom:2px solid #000;background:#f5f5f5;">Produit</th>
      <th style="padding:8px;font-size:10px;text-transform:uppercase;text-align:left;border-bottom:2px solid #000;background:#f5f5f5;">Couleur/Taille</th>
      <th style="padding:8px;font-size:10px;text-transform:uppercase;text-align:left;border-bottom:2px solid #000;background:#f5f5f5;">SKU</th>
      <th style="padding:8px;font-size:10px;text-transform:uppercase;text-align:center;border-bottom:2px solid #000;background:#f5f5f5;">Qté</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${d.notes ? `<div style="padding:10px 14px;border-left:2px solid #000;background:#fafafa;margin-bottom:20px;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:4px;font-weight:600;">Notes</div>
    <div>${esc(d.notes)}</div>
  </div>` : ''}

  <div style="display:flex;justify-content:space-between;margin-top:60px;">
    <div style="text-align:center;width:160px;"><div style="border-top:1px solid #000;margin-top:50px;padding-top:6px;font-size:10px;color:#555;">Préparé par</div></div>
    <div style="text-align:center;width:160px;"><div style="border-top:1px solid #000;margin-top:50px;padding-top:6px;font-size:10px;color:#555;">Vérifié par</div></div>
  </div>
</div>
<script>window.onload = function() { window.print(); }</script>
</body></html>`
}

export function printPackingSlip(data: PackingSlipData): void {
  const html = buildHtml(data)
  const w = window.open('', '_blank', 'width=800,height=700')
  if (!w) return
  w.document.write(html)
  w.document.close()
}
