import type { ReactNode } from 'react'

type Channel = 'shopify' | 'whatsapp'

interface OnlineComingSoonProps {
  title: string
  description: string
  icon: ReactNode
  features: string[]
  channels?: Channel[]
}

const CHANNEL_META: Record<Channel, { label: string; className: string; dot: string }> = {
  shopify: { label: 'Shopify', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  whatsapp: { label: 'WhatsApp', className: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
}

export default function OnlineComingSoon({ title, description, icon, features, channels = [] }: OnlineComingSoonProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
          {icon}
        </div>

        {channels.length > 0 && (
          <div className="flex items-center justify-center gap-2 mb-4">
            {channels.map((c) => (
              <span
                key={c}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${CHANNEL_META[c].className}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${CHANNEL_META[c].dot}`} />
                {CHANNEL_META[c].label}
              </span>
            ))}
          </div>
        )}

        <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">{description}</p>

        <div className="bg-white border border-slate-200 rounded-xl p-5 text-left">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">À venir dans cette section</p>
          <ul className="space-y-2.5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                <svg className="w-4 h-4 mt-0.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-slate-400 mt-5">Section en construction — la boutique en ligne arrive bientôt.</p>
      </div>
    </div>
  )
}
