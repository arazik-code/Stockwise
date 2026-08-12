import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Badge } from '../ui'
import type { Tone } from '../../design/status'

type Channel = 'shopify' | 'whatsapp'

interface OnlineComingSoonProps {
  title: string
  description: string
  icon: ReactNode
  features: string[]
  channels?: Channel[]
}

const CHANNEL_TONE: Record<Channel, Tone> = {
  shopify: 'positive',
  // WhatsApp is a brand colour handled by StatusBadge's tone escape - here we
  // reuse "positive" for the pill's tone geometry but override the dot/label
  // colour with the dedicated brand token so it reads as WhatsApp, not generic
  // success green.
  whatsapp: 'positive',
}

export default function OnlineComingSoon({ title, description, icon, features, channels = [] }: OnlineComingSoonProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-lg text-center">
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-surface text-[var(--accent-fg)] shadow-glow"
          style={{ background: 'var(--accent)' }}
        >
          {icon}
        </div>

        {channels.length > 0 && (
          <div className="mb-4 flex items-center justify-center gap-2">
            {channels.map((c) =>
              c === 'whatsapp' ? (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 rounded-chip border border-[color-mix(in_oklab,var(--brand-whatsapp)_35%,transparent)] bg-[var(--brand-whatsapp-soft)] px-2.5 py-1 text-xs font-medium text-[var(--brand-whatsapp-ink)]"
                >
                  <span className="h-1.5 w-1.5 rounded-chip bg-[var(--brand-whatsapp)]" />
                  WhatsApp
                </span>
              ) : (
                <Badge key={c} tone={CHANNEL_TONE[c]} dot>
                  Shopify
                </Badge>
              )
            )}
          </div>
        )}

        <h2 className="mb-2 text-xl font-bold text-fg">{title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-fg-subtle">{description}</p>

        <div className="surface-glass p-5 text-left">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            À venir dans cette section
          </p>
          <ul className="space-y-2.5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-fg-muted">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--positive)]" aria-hidden="true" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-5 text-xs text-fg-subtle">
          Section en construction — la boutique en ligne arrive bientôt.
        </p>
      </div>
    </div>
  )
}
