import QRCode from 'qrcode'
import type { CartItem } from '../store/cartStore'
import type { ReceiptTemplateConfig } from '../api/clients'

export interface ReceiptData {
  saleNumber: string
  date: Date
  cashier?: string
  items: CartItem[]
  subtotal: number
  taxRate: number
  taxAmount: number
  loyaltyDiscount: number
  total: number
  paymentMethod: 'Cash' | 'Card'
  amountPaid: number
  change: number
  clientName?: string
  clientQrCode?: string
  pointsEarned: number
  pointsRedeemed: number
  receiptBarcode?: string
}

const DEFAULT_TEMPLATE: ReceiptTemplateConfig = {
  shopName: 'FLEX SHOES',
  shopTagline: 'Chaussures & Plus',
  shopAddress: '',
  shopPhone: '',
  shopWebsite: 'www.flexshoes.ma',
  logoBase64: '',
  showTicketNumber: true,
  showDate: true,
  showCashier: true,
  showVariantDetails: true,
  showSku: false,
  showUnitPrice: true,
  showSubtotal: true,
  showTax: true,
  showDiscount: true,
  showPaymentMethod: true,
  showLoyaltyInfo: true,
  showQrCode: true,
  headerText: '',
  footerText: 'Merci et a bientot!',
  termsText: "Delai d'echange : 15 jours\nEmballage et ticket de caisse obligatoire / Etat original\nArticles Soldes et Vestes en cuir ni repris",
  fontFamily: "'Consolas', 'Courier New', monospace",
}

function fmt(v: number): string {
  return v.toFixed(2) + ' DH'
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function buildReceiptHtml(data: ReceiptData, config: ReceiptTemplateConfig): Promise<string> {
  const ff = config.fontFamily || "'Consolas', 'Courier New', monospace"

  // ── Header section ──
  let headerHtml = ''
  if (config.headerText) {
    headerHtml += `<div class="header-badge">${escapeHtml(config.headerText)}</div>`
  }

  if (config.logoBase64) {
    headerHtml += `<div class="logo"><img src="${config.logoBase64}" alt="Logo"></div>`
  }

  headerHtml += `<div class="shop-name">${escapeHtml(config.shopName || 'FLEX SHOES')}</div>`
  if (config.shopTagline) {
    headerHtml += `<div class="shop-tagline">${escapeHtml(config.shopTagline)}</div>`
  }
  if (config.shopAddress) {
    headerHtml += `<div class="shop-detail">${escapeHtml(config.shopAddress)}</div>`
  }
  if (config.shopPhone) {
    headerHtml += `<div class="shop-detail">${escapeHtml(config.shopPhone)}</div>`
  }
  if (config.shopWebsite) {
    headerHtml += `<div class="shop-website">${escapeHtml(config.shopWebsite)}</div>`
  }

  // ── Ticket info ──
  let ticketHtml = '<div class="ticket-info">'
  if (config.showTicketNumber) {
    ticketHtml += `<div class="ticket-row"><span class="ticket-label">N° Ticket</span><span class="ticket-value">${escapeHtml(data.saleNumber)}</span></div>`
  }
  if (config.showDate) {
    ticketHtml += `<div class="ticket-row"><span class="ticket-label">Date</span><span class="ticket-value">${formatDate(data.date)}</span></div>`
  }
  if (config.showCashier && data.cashier) {
    ticketHtml += `<div class="ticket-row"><span class="ticket-label">Vendeur</span><span class="ticket-value">${escapeHtml(data.cashier)}</span></div>`
  }
  ticketHtml += '</div>'

  // ── Items ──
  let itemsHtml = '<div class="items-section"><div class="section-title">ARTICLES</div>'
  for (const item of data.items) {
    itemsHtml += '<div class="item">'
    itemsHtml += `<div class="item-name">${escapeHtml(item.name)}</div>`
    if (config.showVariantDetails) {
      const variant = [item.colorName, item.sizeValue].filter(Boolean).join(' / ')
      if (variant) itemsHtml += `<div class="item-variant">${escapeHtml(variant)}</div>`
    }
    if (config.showSku && item.sku) {
      itemsHtml += `<div class="item-sku">${escapeHtml(item.sku)}</div>`
    }
    if (config.showUnitPrice) {
      itemsHtml += `<div class="item-pricing"><span>${item.quantity} × ${fmt(item.unitPrice)}</span><span class="item-total">${fmt(item.lineTotal)}</span></div>`
    } else {
      const unitP = item.lineTotal / item.quantity
      itemsHtml += `<div class="item-pricing"><span>${item.quantity} × ${fmt(unitP)}</span><span class="item-total">${fmt(item.lineTotal)}</span></div>`
    }
    itemsHtml += '</div>'
  }
  itemsHtml += '</div>'

  // ── Totals ──
  let totalsHtml = '<div class="totals-section">'
  if (config.showSubtotal) {
    totalsHtml += `<div class="total-row"><span>Sous-total</span><span>${fmt(data.subtotal)}</span></div>`
  }
  if (config.showDiscount && data.loyaltyDiscount > 0) {
    totalsHtml += `<div class="total-row discount"><span>Remise fidelite</span><span>-${fmt(data.loyaltyDiscount)}</span></div>`
  }
  if (config.showTax && data.taxAmount > 0) {
    totalsHtml += `<div class="total-row"><span>TVA (${(data.taxRate * 100).toFixed(0)}%)</span><span>${fmt(data.taxAmount)}</span></div>`
  }
  totalsHtml += `<div class="total-row grand-total"><span>TOTAL</span><span>${fmt(data.total)}</span></div>`
  totalsHtml += '</div>'

  // ── Payment ──
  let paymentHtml = ''
  if (config.showPaymentMethod) {
    const isCash = data.paymentMethod === 'Cash'
    paymentHtml = `<div class="payment-section">
      <div class="payment-badge ${isCash ? 'cash' : 'card'}">${isCash ? 'ESPECES' : 'CARTE'}</div>`
    if (isCash) {
      paymentHtml += `<div class="payment-row"><span>Paye</span><span>${fmt(data.amountPaid)}</span></div>`
      if (data.change > 0) {
        paymentHtml += `<div class="payment-row change"><span>Monnaie</span><span>${fmt(data.change)}</span></div>`
      }
    }
    paymentHtml += '</div>'
  }

  // ── Loyalty ──
  let loyaltyHtml = ''
  if (config.showLoyaltyInfo && (data.clientName || data.pointsEarned > 0 || data.pointsRedeemed > 0)) {
    loyaltyHtml = '<div class="loyalty-section">'
    if (data.clientName) {
      loyaltyHtml += `<div class="loyalty-client">${escapeHtml(data.clientName)}</div>`
    }
    if (data.pointsRedeemed > 0) {
      loyaltyHtml += `<div class="loyalty-row redeemed">-${data.pointsRedeemed} points utilises</div>`
    }
    if (data.pointsEarned > 0) {
      loyaltyHtml += `<div class="loyalty-row earned">+${data.pointsEarned} points gagnes</div>`
    }
    loyaltyHtml += '</div>'
  }

  // ── Footer ──
  let footerHtml = ''
  if (config.footerText) {
    footerHtml = `<div class="footer-text">${escapeHtml(config.footerText)}</div>`
  }

  // ── Terms ──
  let termsHtml = ''
  if (config.termsText) {
    const termsLines = config.termsText.split('\n').filter(l => l.trim())
    if (termsLines.length > 0) {
      termsHtml = '<div class="terms-section">'
      for (const line of termsLines) {
        termsHtml += `<div class="terms-line">${escapeHtml(line.trim())}</div>`
      }
      termsHtml += '</div>'
    }
  }

  // ── Receipt QR Code (unified: loyalty client QR or walk-in receipt QR) ──
  let receiptQrHtml = ''
  if (config.showQrCode) {
    const qrValue = data.clientQrCode || data.receiptBarcode
    if (qrValue) {
      const isLoyaltyClient = !!data.clientQrCode
      const qrLabel = isLoyaltyClient
        ? (data.clientName ? `Fidelite: ${data.clientName}` : 'QR Fidelite')
        : 'Bon de caisse'
      const qrExpiry = isLoyaltyClient ? '' : '<div class="qr-expiry">Valable 15 jours</div>'

      try {
        const qrDataUrl = await QRCode.toDataURL(qrValue, {
          width: 180,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        })
        receiptQrHtml = `<div class="receipt-qr-section">
          <div class="receipt-qr-title">${escapeHtml(qrLabel)}</div>
          <img class="receipt-qr-code" src="${qrDataUrl}" alt="QR Code">
          ${qrExpiry}
        </div>`
      } catch {
        receiptQrHtml = `<div class="receipt-qr-section">
          <div class="receipt-qr-title">${escapeHtml(qrLabel)}</div>
          <div class="qr-fallback">${escapeHtml(qrValue)}</div>
          ${qrExpiry}
        </div>`
      }
    }
  }

  footerHtml += '<div class="footer-divider"></div>'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ticket ${escapeHtml(data.saleNumber)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${ff};
      font-size: 13px;
      font-weight: bold;
      line-height: 1.3;
      width: 80mm;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt {
      width: 72mm;
      margin: 0 auto;
      padding: 3mm 0;
    }

    /* ── Header ── */
    .header-badge {
      text-align: center;
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #000;
      margin-bottom: 4px;
    }
    .logo {
      text-align: center;
      margin: 6px 0;
    }
    .logo img {
      max-height: 48px;
      max-width: 68px;
      object-fit: contain;
      filter: grayscale(100%) contrast(1.3);
    }
    .shop-name {
      text-align: center;
      font-size: 22px;
      font-weight: bold;
      letter-spacing: 5px;
      text-transform: uppercase;
      margin: 2px 0;
    }
    .shop-tagline {
      text-align: center;
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 2px;
      color: #000;
      margin-bottom: 2px;
    }
    .shop-detail {
      text-align: center;
      font-size: 11px;
      font-weight: bold;
      color: #000;
    }
    .shop-website {
      text-align: center;
      font-size: 11px;
      font-weight: bold;
      color: #000;
      letter-spacing: 1px;
    }

    /* ── Separator ── */
    .ticket-info, .items-section, .totals-section, .payment-section, .loyalty-section {
      border-top: 2px dashed #000;
      margin-top: 6px;
      padding-top: 5px;
    }

    /* ── Ticket Info ── */
    .ticket-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: bold;
      padding: 1px 0;
    }
    .ticket-label { color: #000; font-weight: bold; }
    .ticket-value { font-weight: bold; }

    /* ── Items ── */
    .section-title {
      text-align: center;
      font-size: 12px;
      font-weight: bold;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #000;
      margin-bottom: 4px;
    }
    .item {
      padding: 4px 0;
      border-bottom: 1px dashed #000;
    }
    .item:last-child { border-bottom: none; }
    .item-name {
      font-weight: bold;
      font-size: 13px;
      line-height: 1.2;
    }
    .item-variant {
      font-size: 13px;
      font-weight: bold;
      color: #000;
      margin-top: 1px;
    }
    .item-sku {
      font-size: 10px;
      font-weight: bold;
      color: #000;
      margin-top: 1px;
    }
    .item-pricing {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: bold;
      margin-top: 1px;
    }
    .item-total { font-weight: bold; }

    /* ── Totals ── */
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: bold;
      padding: 2px 0;
    }
    .total-row.discount { color: #000; }
    .total-row.grand-total {
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      margin-top: 3px;
      padding: 5px 0;
      font-size: 18px;
      font-weight: bold;
      letter-spacing: 2px;
    }

    /* ── Payment ── */
    .payment-badge {
      display: inline-block;
      padding: 3px 10px;
      font-size: 12px;
      font-weight: bold;
      letter-spacing: 2px;
      border: 2px solid #000;
      text-align: center;
      margin-bottom: 3px;
    }
    .payment-badge.cash { border-style: dashed; }
    .payment-badge.card { background: #000; color: #fff; }
    .payment-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: bold;
      padding: 1px 0;
    }
    .payment-row.change { font-weight: bold; }

    /* ── Loyalty ── */
    .loyalty-client {
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 2px;
    }
    .loyalty-row {
      font-size: 12px;
      font-weight: bold;
      padding: 1px 0;
    }
    .loyalty-row.redeemed { color: #000; }
    .loyalty-row.earned { color: #000; font-weight: bold; }

    /* ── Footer ── */
    .footer-text {
      text-align: center;
      font-size: 12px;
      font-weight: bold;
      color: #000;
      margin-top: 8px;
      letter-spacing: 1px;
    }
    .footer-divider {
      border-top: 2px dashed #000;
      margin-top: 6px;
    }

    /* ── Terms ── */
    .terms-section {
      border-top: 1px solid #000;
      margin-top: 8px;
      padding-top: 5px;
    }
    .terms-line {
      font-size: 10px;
      font-weight: bold;
      color: #000;
      line-height: 1.3;
      padding: 1px 0;
    }

    /* ── Receipt QR Code ── */
    .receipt-qr-section {
      text-align: center;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 2px dashed #000;
    }
    .receipt-qr-title {
      font-size: 11px;
      font-weight: bold;
      color: #000;
      margin-bottom: 4px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .receipt-qr-code {
      width: 100px;
      height: 100px;
      image-rendering: pixelated;
    }
    .qr-expiry {
      font-size: 9px;
      font-weight: bold;
      color: #000;
      margin-top: 2px;
    }
    .qr-fallback {
      font-size: 10px;
      font-weight: bold;
      color: #000;
      letter-spacing: 1px;
      padding: 8px;
      border: 1px dashed #000;
      display: inline-block;
    }

    @media print {
      html, body { width: 80mm; height: auto; margin: 0; padding: 0; }
      .receipt { width: 72mm; margin: 0 auto; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    ${headerHtml}
    ${ticketHtml}
    ${itemsHtml}
    ${totalsHtml}
    ${paymentHtml}
    ${loyaltyHtml}
    ${footerHtml}
    ${termsHtml}
    ${receiptQrHtml}
  </div>
</body>
</html>`
}

let cachedTemplate: ReceiptTemplateConfig | null = null

export function invalidateReceiptTemplateCache(): void {
  cachedTemplate = null
}

async function getTemplate(): Promise<ReceiptTemplateConfig> {
  if (cachedTemplate) return cachedTemplate
  try {
    const { settingsApi } = await import('../api/clients')
    cachedTemplate = await settingsApi.getReceiptTemplate()
    return cachedTemplate
  } catch {
    return DEFAULT_TEMPLATE
  }
}

export async function printReceipt(data: ReceiptData, template?: ReceiptTemplateConfig): Promise<void> {
  const config = template || await getTemplate()
  const html = await buildReceiptHtml(data, config)

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '-9999px'
  iframe.style.width = '80mm'
  iframe.style.height = '1px'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    document.body.removeChild(iframe)
    return
  }

  iframeDoc.open()
  iframeDoc.write(html)
  iframeDoc.close()

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 300)
  }
}

export function buildReceiptData(opts: {
  saleNumber: string
  items: CartItem[]
  subtotal: number
  taxRate: number
  taxAmount: number
  loyaltyDiscount: number
  total: number
  paymentMethod: 'Cash' | 'Card'
  amountPaid: number
  change: number
  clientName?: string
  clientQrCode?: string
  pointsEarned: number
  pointsRedeemed: number
  cashier?: string
  receiptBarcode?: string
}): ReceiptData {
  return {
    saleNumber: opts.saleNumber,
    date: new Date(),
    cashier: opts.cashier,
    items: opts.items,
    subtotal: opts.subtotal,
    taxRate: opts.taxRate,
    taxAmount: opts.taxAmount,
    loyaltyDiscount: opts.loyaltyDiscount,
    total: opts.total,
    paymentMethod: opts.paymentMethod,
    amountPaid: opts.amountPaid,
    change: opts.change,
    clientName: opts.clientName,
    clientQrCode: opts.clientQrCode,
    pointsEarned: opts.pointsEarned,
    pointsRedeemed: opts.pointsRedeemed,
    receiptBarcode: opts.receiptBarcode,
  }
}

function center(str: string, len: number): string {
  const pad = Math.max(0, len - str.length)
  const left = Math.floor(pad / 2)
  return ' '.repeat(left) + str
}

function formatDateShort(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

export interface ExchangeReceiptData {
  originalSaleNumber: string
  returnedItems: {
    productName: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }[]
  totalRefundAmount: number
  exchangeItems: {
    productName: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }[]
  priceDifference: number
}

export function printExchangeReceipt(data: ReceiptData, exchange: ExchangeReceiptData): void {
  const fmt = (n: number) => new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' DH'
  const pad = (s: string, len: number) => s.length >= len ? s : s + ' '.repeat(len - s.length)
  const rpad = (s: string, len: number) => s.length >= len ? s : ' '.repeat(len - s.length) + s

  const W = 32
  const lines: string[] = []

  lines.push('════════════════════════════════')
  lines.push(center('FLEX SHOES', W))
  lines.push(center('Chaussures & Plus', W))
  lines.push('════════════════════════════════')
  lines.push(center('* TICKET D\'ÉCHANGE *', W))
  lines.push('')
  lines.push(`Ticket:     ${data.saleNumber}`)
  lines.push(`Vente orig: ${exchange.originalSaleNumber}`)
  lines.push(`Date:       ${formatDateShort(data.date)}`)
  if (data.clientName) lines.push(`Client:     ${data.clientName}`)
  if (data.cashier) lines.push(`Caissier:   ${data.cashier}`)
  lines.push('──────────────────────────────')
  lines.push(center('ARTICLES RETOURNÉS', W))
  lines.push('──────────────────────────────')

  for (const item of exchange.returnedItems) {
    lines.push(item.productName)
    lines.push(`  ${item.quantity} x ${fmt(item.unitPrice)}${' '.repeat(6)}${fmt(item.lineTotal)}`)
  }

  lines.push('──────────────────────────────')
  lines.push(`${pad('Total retours:', 20)}${rpad(fmt(exchange.totalRefundAmount), 12)}`)
  lines.push('')
  lines.push(center('ARTICLES ÉCHANGÉS', W))
  lines.push('──────────────────────────────')

  for (const item of exchange.exchangeItems) {
    lines.push(item.productName)
    lines.push(`  ${item.quantity} x ${fmt(item.unitPrice)}${' '.repeat(6)}${fmt(item.lineTotal)}`)
  }

  lines.push('──────────────────────────────')
  lines.push(`${pad('Sous-total:', 20)}${rpad(fmt(data.subtotal), 12)}`)
  if (data.loyaltyDiscount > 0) {
    lines.push(`${pad('Remise fidélité:', 20)}${rpad('-' + fmt(data.loyaltyDiscount), 12)}`)
  }
  lines.push(`${pad('Crédit échange:', 20)}${rpad('-' + fmt(exchange.totalRefundAmount), 12)}`)
  lines.push('──────────────────────────────')
  lines.push(`${pad('TOTAL À PAYER:', 20)}${rpad(fmt(data.total), 12)}`)
  lines.push('──────────────────────────────')
  lines.push(`${pad('Paiement:', 20)}${data.paymentMethod === 'Cash' ? 'Espèces' : 'Carte'}`)
  if (data.paymentMethod === 'Cash') {
    lines.push(`${pad('Payé:', 20)}${rpad(fmt(data.amountPaid), 12)}`)
    if (data.change > 0) lines.push(`${pad('Monnaie:', 20)}${rpad(fmt(data.change), 12)}`)
  }
  lines.push('════════════════════════════════')
  if (exchange.priceDifference !== 0) {
    const sign = exchange.priceDifference > 0 ? '+' : ''
    lines.push(center(`Différence: ${sign}${fmt(exchange.priceDifference)}`, W))
  }
  if (data.receiptBarcode) {
    lines.push(center(`Bon: ${data.receiptBarcode}`, W))
    lines.push(center('Valable 15 jours', W))
  }
  lines.push(center('Merci et a bientot!', W))
  lines.push('════════════════════════════════')

  const html = `<!DOCTYPE html>
<html><head><title>Échange ${data.saleNumber}</title>
<style>
  @page { size: 80mm auto; margin: 2mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 80mm; padding: 2mm; color: #000; }
  pre { white-space: pre; line-height: 1.3; }
</style></head>
<body><pre>${lines.join('\n')}</pre>
<script>window.onload = function() { window.print(); }</script>
</body></html>`

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '-9999px'
  iframe.style.width = '80mm'
  iframe.style.height = '1px'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    document.body.removeChild(iframe)
    return
  }

  iframeDoc.open()
  iframeDoc.write(html)
  iframeDoc.close()

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 300)
  }
}
