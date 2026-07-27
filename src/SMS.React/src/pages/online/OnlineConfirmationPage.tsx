import { useState, useEffect, useCallback } from 'react'
import Header from '../../components/layout/Header'
import { showToast } from '../../components/shared/Toast'
import { confirmationApi, type ConfirmationQueueItem, type ConfirmationOutcome, type ConfirmationStats } from '../../api/confirmation'
import { onlineApi } from '../../api/online'
import { openWhatsApp, buildOrderConfirmationMessage, hasWhatsApp } from '../../utils/whatsapp'
import { formatCurrency } from '../../utils/format'
import type { OnlineOrder } from '../../types/onlineOrder'

const OUTCOME_BUTTONS: { outcome: ConfirmationOutcome; label: string; shortcut: string; className: string }[] = [
  { outcome: 'Confirmed', label: 'Confirmee', shortcut: '1', className: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  { outcome: 'NoAnswer', label: 'Pas de reponse', shortcut: '2', className: 'bg-amber-100 hover:bg-amber-200 text-amber-800' },
  { outcome: 'Busy', label: 'Occupe', shortcut: '3', className: 'bg-amber-100 hover:bg-amber-200 text-amber-800' },
  { outcome: 'Refused', label: 'Refusee', shortcut: '4', className: 'bg-red-600 hover:bg-red-700 text-white' },
  { outcome: 'WrongNumber', label: 'Mauvais numero', shortcut: '5', className: 'bg-slate-200 hover:bg-slate-300 text-slate-700' },
  { outcome: 'Postponed', label: 'Reporte', shortcut: '6', className: 'bg-sky-100 hover:bg-sky-200 text-sky-800' },
  { outcome: 'Duplicate', label: 'Doublon', shortcut: '7', className: 'bg-slate-200 hover:bg-slate-300 text-slate-700' },
  { outcome: 'AskedToChange', label: 'Modification demandee', shortcut: '8', className: 'bg-violet-100 hover:bg-violet-200 text-violet-800' },
]

export default function OnlineConfirmationPage() {
  const [queue, setQueue] = useState<ConfirmationQueueItem[]>([])
  const [stats, setStats] = useState<ConfirmationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState<OnlineOrder | null>(null)
  const [currentLoading, setCurrentLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [q, s] = await Promise.all([confirmationApi.getQueue(), confirmationApi.getStats()])
      setQueue(q)
      setStats(s)
    } catch {
      showToast('Erreur lors du chargement de la file de confirmation', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const head = queue[0]
    if (!head) { setCurrent(null); return }
    setCurrentLoading(true)
    onlineApi.getById(head.onlineOrderId).then(setCurrent).finally(() => setCurrentLoading(false))
  }, [queue])

  const handleOutcome = useCallback(async (outcome: ConfirmationOutcome, channel: 'Call' | 'WhatsApp' = 'Call') => {
    if (!current || submitting) return
    setSubmitting(true)
    try {
      await confirmationApi.logAttempt(current.id, channel, outcome, note.trim() || undefined)
      setNote('')
      showToast('Tentative enregistree', 'success')
      await load()
    } catch {
      showToast('Erreur lors de l\'enregistrement', 'error')
    } finally {
      setSubmitting(false)
    }
  }, [current, submitting, note, load])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!current) return
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') return
      const match = OUTCOME_BUTTONS.find((b) => b.shortcut === e.key)
      if (match) { e.preventDefault(); handleOutcome(match.outcome) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [current, handleOutcome])

  const handleWhatsApp = (lang: 'fr' | 'darija') => {
    if (!current) return
    const ok = openWhatsApp(current.customerPhone, buildOrderConfirmationMessage({
      orderNumber: current.orderNumber,
      customerName: current.customerName,
      items: current.items.map((i) => ({ productName: i.productName, sizeValue: i.sizeValue, colorName: i.colorName, quantity: i.quantity })),
      total: current.totalAmount,
      city: current.city,
      addressLine: current.addressLine,
    }, lang))
    if (!ok) { showToast('Aucun numero de telephone valide', 'error'); return }
    handleOutcome('Confirmed', 'WhatsApp')
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="File de confirmation" />

      <div className="px-6 pt-4 grid grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide">En attente</p>
          <p className="text-lg font-semibold text-slate-900">{stats?.queueCount ?? '-'}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Rappels dus</p>
          <p className="text-lg font-semibold text-amber-600">{stats?.dueCallbacks ?? '-'}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Confirmees aujourd'hui</p>
          <p className="text-lg font-semibold text-emerald-600">{stats?.confirmedToday ?? '-'}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Taux de confirmation</p>
          <p className="text-lg font-semibold text-slate-900">{stats?.confirmationRatePercent ?? '-'}%</p>
        </div>
      </div>

      <div className="p-6 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : queue.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto mb-3 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-slate-500">File de confirmation vide - tout est a jour.</p>
          </div>
        ) : currentLoading || !current ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-lg font-semibold text-slate-900">{current.customerName}</p>
                  <p className="text-sm font-mono text-slate-500">{current.orderNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-slate-900">{formatCurrency(current.totalAmount)}</p>
                  <p className="text-xs text-slate-400">{queue[0]?.attemptCount ?? 0} tentative(s) precedente(s)</p>
                </div>
              </div>

              {queue[0]?.duplicateOrderWarning && (
                <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                  ⚠ Ce numero a une autre commande en attente dans la file - verifier avant de confirmer.
                </div>
              )}
              {queue[0]?.priorDeliveredOrders > 0 && (
                <div className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800">
                  ✓ Client fidele : {queue[0].priorDeliveredOrders} commande(s) deja livree(s).
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Telephone</p>
                  <a href={`tel:${current.customerPhone}`} className="text-blue-600 font-medium hover:underline">{current.customerPhone || '-'}</a>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Ville</p>
                  <p className="text-slate-900">{current.city || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Adresse</p>
                  <p className="text-slate-900">{current.addressLine || '-'}</p>
                </div>
              </div>

              <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 mb-4">
                {current.items.map((i) => (
                  <div key={i.id} className="px-3 py-2 flex items-center justify-between text-sm">
                    <span className="text-slate-700">{i.productName} {[i.colorName, i.sizeValue].filter(Boolean).join(' / ')}</span>
                    <span className="text-slate-500">×{i.quantity}</span>
                  </div>
                ))}
              </div>

              {hasWhatsApp(current.customerPhone) && (
                <div className="flex gap-2 mb-4">
                  <button onClick={() => handleWhatsApp('darija')} className="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-500 rounded-md hover:bg-green-600">
                    🇲🇦 WhatsApp Darija
                  </button>
                  <button onClick={() => handleWhatsApp('fr')} className="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-500 rounded-md hover:bg-green-600">
                    🇫🇷 WhatsApp Francais
                  </button>
                </div>
              )}

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optionnel)"
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm mb-4"
              />

              <div className="grid grid-cols-4 gap-2">
                {OUTCOME_BUTTONS.map((b) => (
                  <button
                    key={b.outcome}
                    onClick={() => handleOutcome(b.outcome)}
                    disabled={submitting}
                    className={`px-2 py-2.5 text-xs font-medium rounded-md disabled:opacity-50 ${b.className}`}
                  >
                    {b.label} <span className="opacity-60">({b.shortcut})</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-center text-xs text-slate-400">{queue.length} commande(s) restante(s) dans la file</p>
          </div>
        )}
      </div>
    </div>
  )
}
