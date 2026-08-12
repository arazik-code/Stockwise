import { useState } from 'react'
import { Star } from 'lucide-react'
import { openWhatsApp, hasWhatsApp, renderWhatsAppTemplate } from '../../utils/whatsapp'
import { whatsappTemplatesApi, type WhatsAppTemplate } from '../../api/whatsappTemplates'
import { showToast } from './Toast'
import { Popover } from '../ui/Popover'
import { cn } from '../ui/cn'
import type { OnlineOrder } from '../../types/onlineOrder'

export const WhatsAppIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

function sendWithTemplate(order: OnlineOrder, template: WhatsAppTemplate) {
  const message = renderWhatsAppTemplate(template.body, {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    items: order.items.map((i) => ({ productName: i.productName, sizeValue: i.sizeValue, colorName: i.colorName, quantity: i.quantity })),
    total: order.totalAmount,
    city: order.city,
    addressLine: order.addressLine,
  })
  const ok = openWhatsApp(order.customerPhone, message)
  if (!ok) showToast('Aucun numéro de téléphone valide pour ce client', 'error')
}

/**
 * Green WhatsApp button offering every saved template (see /online/whatsapp-templates) before
 * launching the chat. Templates are user-editable and saveable - this used to be two hardcoded
 * FR/Darija messages baked into the frontend with no way to change the wording.
 *
 * The only file in the app using WhatsApp brand green instead of the accent/positive scale -
 * that is legitimate, matching a third party's mark is the whole point. See --brand-whatsapp-*
 * in src/design/semantic.css.
 */
export function WhatsAppConfirmMenu({ order, compact = false }: { order: OnlineOrder; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [loaded, setLoaded] = useState(false)

  if (!hasWhatsApp(order.customerPhone)) return null

  const pick = (template: WhatsAppTemplate) => { setOpen(false); sendWithTemplate(order, template) }

  return (
    <Popover
      placement="bottom-end"
      className="w-52 py-1"
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next && !loaded) {
          whatsappTemplatesApi.getAll()
            .then(setTemplates)
            .catch(() => showToast('Impossible de charger les modèles WhatsApp', 'error'))
            .finally(() => setLoaded(true))
        }
      }}
      trigger={
        compact ? (
          <button
            title="Confirmer via WhatsApp"
            className="rounded-inset px-1.5 py-1 text-[var(--brand-whatsapp-ink)] transition-colors hover:bg-[var(--brand-whatsapp-soft)]"
          >
            <WhatsAppIcon />
          </button>
        ) : (
          <button
            className={cn(
              'inline-flex items-center gap-1.5 rounded-field px-3 py-2 text-sm font-medium text-white shadow-e1',
              'transition-colors hover:brightness-95'
            )}
            style={{ background: 'var(--brand-whatsapp)' }}
          >
            <WhatsAppIcon /> Confirmer sur WhatsApp
          </button>
        )
      }
    >
      {!loaded ? (
        <div className="px-3 py-3 text-center text-xs text-fg-subtle">Chargement…</div>
      ) : templates.length === 0 ? (
        <div className="px-3 py-3 text-center text-xs text-fg-subtle">Aucun modèle enregistré</div>
      ) : (
        templates.map((t) => (
          <button
            key={t.id}
            onClick={() => pick(t)}
            className="w-full truncate px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-[var(--brand-whatsapp-soft)]"
            title={t.name}
          >
            {t.isDefault && (
              <Star className="mr-1 inline h-3 w-3 fill-[var(--caution)] text-[var(--caution)]" aria-hidden="true" />
            )}
            {t.name}
          </button>
        ))
      )}
    </Popover>
  )
}
