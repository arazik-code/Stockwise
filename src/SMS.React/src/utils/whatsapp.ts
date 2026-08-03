// Helpers for launching WhatsApp chats with pre-filled messages (order confirmation, client contact).
// Phone numbers in the system arrive in many shapes ("0612...", "+212 612...", "212612...");
// wa.me needs a bare international number with no '+', spaces or leading zero.

const STORE_NAME = 'FlexShoes'

/** Normalize a Moroccan (or already-international) phone number to wa.me digits, or null if unusable. */
export function toWhatsAppNumber(phone?: string | null): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null

  // Already international with country code.
  if (digits.startsWith('212')) {
    // handle a stray leading zero after the country code: 2120612... -> 212612...
    if (digits.length === 13 && digits[3] === '0') digits = '212' + digits.slice(4)
    return digits
  }
  // Local Moroccan format: 06.../07... (10 digits starting 0) -> drop 0, prepend 212.
  if (digits.startsWith('0')) return '212' + digits.slice(1)
  // Bare 9-digit local (612345678) -> prepend 212.
  if (digits.length === 9) return '212' + digits
  // Fallback: assume it's already a usable international number.
  return digits
}

export function hasWhatsApp(phone?: string | null): boolean {
  return toWhatsAppNumber(phone) !== null
}

/** Open a WhatsApp chat (new tab) with an optional pre-filled message. */
export function openWhatsApp(phone?: string | null, message?: string): boolean {
  const num = toWhatsAppNumber(phone)
  if (!num) return false
  const url = `https://wa.me/${num}${message ? `?text=${encodeURIComponent(message)}` : ''}`
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

export type WhatsAppLang = 'fr' | 'darija'

interface OrderMsgInput {
  orderNumber: string
  customerName?: string
  items: { productName: string; sizeValue?: string; colorName?: string; quantity: number }[]
  total: number
  city?: string
  addressLine?: string
}

const fmtMad = (n: number) => `${n.toLocaleString('fr-MA')} MAD`

function itemsLines(items: OrderMsgInput['items']): string {
  return items
    .map((i) => {
      const variant = [i.colorName, i.sizeValue].filter(Boolean).join(' / ')
      return `• ${i.productName}${variant ? ` (${variant})` : ''} x${i.quantity}`
    })
    .join('\n')
}

/** Build an order-confirmation message in French or Moroccan Darija (Latin script). */
export function buildOrderConfirmationMessage(o: OrderMsgInput, lang: WhatsAppLang): string {
  const name = o.customerName?.trim() || ''
  const lines = itemsLines(o.items)
  const addr = [o.addressLine, o.city].filter(Boolean).join(', ')

  if (lang === 'darija') {
    return [
      `Salam${name ? ` ${name}` : ''} 👋`,
      `Ana m3ak mn ${STORE_NAME}. Bghina n2akdo m3ak commande dyalk r9m ${o.orderNumber}:`,
      '',
      lines,
      '',
      `Total: ${fmtMad(o.total)} (khalas 3nd l'livraison)`,
      addr ? `L'adresse: ${addr}` : '',
      '',
      'Wach t9dr t2akd liya l commande w l3unwan dyal livraison? Choukran bzaf 🙏',
    ]
      .filter((l) => l !== null && l !== undefined)
      .join('\n')
  }

  // French
  return [
    `Bonjour${name ? ` ${name}` : ''} 👋`,
    `Ici ${STORE_NAME}. Nous souhaitons confirmer votre commande n° ${o.orderNumber} :`,
    '',
    lines,
    '',
    `Total : ${fmtMad(o.total)} (paiement à la livraison)`,
    addr ? `Adresse : ${addr}` : '',
    '',
    'Pouvez-vous confirmer votre commande et l\'adresse de livraison ? Merci beaucoup 🙏',
  ]
    .filter((l) => l !== null && l !== undefined)
    .join('\n')
}

// Placeholders available in saved WhatsApp templates (see /online/whatsapp-templates). Kept in
// sync with the seed templates in WhatsAppTemplateAppService - same tokens either way.
function replaceToken(text: string, token: string, value: string): string {
  return text.split(token).join(value)
}

export function renderWhatsAppTemplate(body: string, o: OrderMsgInput): string {
  const addr = [o.addressLine, o.city].filter(Boolean).join(', ')
  let result = body
  result = replaceToken(result, '{clientName}', o.customerName?.trim() || '')
  result = replaceToken(result, '{orderNumber}', o.orderNumber)
  result = replaceToken(result, '{items}', itemsLines(o.items))
  result = replaceToken(result, '{total}', fmtMad(o.total))
  result = replaceToken(result, '{address}', addr)
  result = replaceToken(result, '{storeName}', STORE_NAME)
  return result
}

/** Build a light greeting message for contacting a client directly. */
export function buildClientGreeting(name?: string, lang: WhatsAppLang = 'fr'): string {
  const n = name?.trim() || ''
  if (lang === 'darija') {
    return `Salam${n ? ` ${n}` : ''} 👋, ana m3ak mn ${STORE_NAME}. Kif n9dr n3awnek?`
  }
  return `Bonjour${n ? ` ${n}` : ''} 👋, ici ${STORE_NAME}. Comment pouvons-nous vous aider ?`
}
