import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, CheckCircle2, MapPin, Phone } from 'lucide-react'
import { showToast } from '../../components/shared/Toast'
import { confirmationApi, type ConfirmationQueueItem, type ConfirmationOutcome, type ConfirmationStats } from '../../api/confirmation'
import { onlineApi } from '../../api/online'
import { openWhatsApp, buildOrderConfirmationMessage, hasWhatsApp } from '../../utils/whatsapp'
import { formatCurrency } from '../../utils/format'
import {
  Button, Card, EmptyState, KeyHint, Page, Skeleton, SkeletonStats,
  StatCard, Textarea,
} from '../../components/ui'
import { STATUS } from '../../design/status'
import type { OnlineOrder } from '../../types/onlineOrder'

const OUTCOME_BUTTONS: { outcome: ConfirmationOutcome; shortcut: string }[] = [
  { outcome: 'Confirmed', shortcut: '1' },
  { outcome: 'NoAnswer', shortcut: '2' },
  { outcome: 'Busy', shortcut: '3' },
  { outcome: 'Refused', shortcut: '4' },
  { outcome: 'WrongNumber', shortcut: '5' },
  { outcome: 'Postponed', shortcut: '6' },
  { outcome: 'Duplicate', shortcut: '7' },
  { outcome: 'AskedToChange', shortcut: '8' },
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
    <Page section="onlineConfirm" title="File de confirmation">
      <div className="space-y-6">
        {loading && !stats ? (
          <SkeletonStats count={4} />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="En attente" value={stats?.queueCount ?? '-'} />
            <StatCard label="Rappels dus" value={stats?.dueCallbacks ?? '-'} tone="caution" />
            <StatCard label="Confirmées aujourd'hui" value={stats?.confirmedToday ?? '-'} tone="positive" />
            <StatCard label="Taux de confirmation" value={`${stats?.confirmationRatePercent ?? '-'}%`} />
          </div>
        )}

        {loading ? (
          <div className="mx-auto max-w-2xl space-y-4">
            <Skeleton className="h-96" />
          </div>
        ) : queue.length === 0 ? (
          <div className="surface-glass">
            <EmptyState
              icon={CheckCircle2}
              title="File de confirmation vide"
              description="Tout est à jour."
            />
          </div>
        ) : currentLoading || !current ? (
          <div className="mx-auto max-w-2xl">
            <Skeleton className="h-96" />
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            <Card>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold text-fg">{current.customerName}</p>
                  <p className="num text-sm text-fg-subtle">{current.orderNumber}</p>
                </div>
                <div className="text-right">
                  <p className="num text-lg font-semibold text-fg">{formatCurrency(current.totalAmount)}</p>
                  <p className="num text-xs text-fg-subtle">{queue[0]?.attemptCount ?? 0} tentative(s) précédente(s)</p>
                </div>
              </div>

              {queue[0]?.duplicateOrderWarning && (
                <div
                  data-tone="caution"
                  className="mb-3 flex items-start gap-2 rounded-inset border border-[color-mix(in_oklab,var(--tone)_28%,transparent)] bg-[var(--tone-soft)] px-3 py-2 text-xs text-[var(--tone-ink)]"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Ce numéro a une autre commande en attente dans la file — vérifier avant de confirmer.
                </div>
              )}
              {queue[0]?.priorDeliveredOrders > 0 && (
                <div
                  data-tone="positive"
                  className="mb-3 flex items-start gap-2 rounded-inset border border-[color-mix(in_oklab,var(--tone)_28%,transparent)] bg-[var(--tone-soft)] px-3 py-2 text-xs text-[var(--tone-ink)]"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Client fidèle : {queue[0].priorDeliveredOrders} commande(s) déjà livrée(s).
                </div>
              )}

              <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-fg-subtle">Téléphone</p>
                  <a
                    href={`tel:${current.customerPhone}`}
                    className="inline-flex items-center gap-1 font-medium text-[var(--accent)] hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {current.customerPhone || '-'}
                  </a>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-fg-subtle">Ville</p>
                  <p className="inline-flex items-center gap-1 text-fg">
                    <MapPin className="h-3.5 w-3.5 text-fg-subtle" />
                    {current.city || '-'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs uppercase tracking-wide text-fg-subtle">Adresse</p>
                  <p className="text-fg">{current.addressLine || '-'}</p>
                </div>
              </div>

              <div className="mb-4 divide-y divide-border rounded-field border border-border">
                {current.items.map((i) => (
                  <div key={i.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-fg">{i.productName} {[i.colorName, i.sizeValue].filter(Boolean).join(' / ')}</span>
                    <span className="num text-fg-muted">×{i.quantity}</span>
                  </div>
                ))}
              </div>

              {hasWhatsApp(current.customerPhone) && (
                // grid, not flex: two shrink-0 fullWidth buttons in a flex row both
                // claim 100% width and can't shrink for each other - see Button.tsx.
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <Button
                    fullWidth
                    size="sm"
                    className="text-white"
                    style={{ background: 'var(--brand-whatsapp)' }}
                    onClick={() => handleWhatsApp('darija')}
                  >
                    🇲🇦 WhatsApp Darija
                  </Button>
                  <Button
                    fullWidth
                    size="sm"
                    className="text-white"
                    style={{ background: 'var(--brand-whatsapp)' }}
                    onClick={() => handleWhatsApp('fr')}
                  >
                    🇫🇷 WhatsApp Français
                  </Button>
                </div>
              )}

              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optionnel)"
                rows={2}
                wrapperClassName="mb-4"
              />

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {OUTCOME_BUTTONS.map((b) => {
                  const def = STATUS.confirmationOutcome[b.outcome]
                  return (
                    <button
                      key={b.outcome}
                      data-tone={def.tone}
                      onClick={() => handleOutcome(b.outcome)}
                      disabled={submitting}
                      className="rounded-field bg-[var(--tone-soft)] px-2 py-2.5 text-xs font-medium text-[var(--tone-ink)] transition-colors hover:brightness-95 disabled:opacity-50"
                    >
                      {def.label} <KeyHint keys={[b.shortcut]} className="ml-1 opacity-70" />
                    </button>
                  )
                })}
              </div>
            </Card>

            <p className="num text-center text-xs text-fg-subtle">{queue.length} commande(s) restante(s) dans la file</p>
          </div>
        )}
      </div>
    </Page>
  )
}
