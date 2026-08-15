import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowDown, ArrowUp, Banknote, X } from 'lucide-react'
import { cashDrawerApi, type CashDrawerSummary, type CashDrawerMovementType } from '../../api/cashDrawer'
import { showToast } from '../../components/shared/Toast'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { Button, IconButton, Input, Modal, Skeleton, StatusDot, Tabs, Textarea } from '../ui'

interface CashDrawerModalProps {
  onClose: () => void
}

export default function CashDrawerModal({ onClose }: CashDrawerModalProps) {
  const [summary, setSummary] = useState<CashDrawerSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<CashDrawerMovementType>('Withdrawal')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      setSummary(await cashDrawerApi.getSummary())
    } catch {
      showToast("Erreur lors du chargement de l'historique caisse", 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    amountRef.current?.focus()
  }, [load])

  const numericAmount = parseFloat(amount.replace(',', '.'))
  const isValid = !isNaN(numericAmount) && numericAmount > 0

  const handleSubmit = async () => {
    if (!isValid || submitting) return
    setSubmitting(true)
    try {
      await cashDrawerApi.create({ type, amount: numericAmount, reason: reason.trim() || undefined })
      showToast(
        type === 'Deposit' ? 'Dépôt enregistré' : 'Retrait enregistré',
        'success'
      )
      setAmount('')
      setReason('')
      await load()
      amountRef.current?.focus()
    } catch {
      showToast("Erreur lors de l'enregistrement du mouvement", 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Modal open onClose={onClose} closeOnEsc={false} size="sm" showClose={false} bodyClassName="p-0">
      {/* The whole dialog (header, body, footer) shares one onKeyDown scope, same as
          before the restyle - it must keep covering every focusable control inside,
          which is why it is not split across Modal's own title/footer slots. */}
      <div onKeyDown={handleKeyDown}>
        <div className="flex items-center justify-between gap-3 rounded-t-surface border-b border-border bg-surface-2 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-[var(--accent-soft)] text-[var(--accent)]">
              <Banknote className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-fg">Mouvement de caisse</p>
              <p className="text-[11px] text-fg-subtle">Accès administrateur</p>
            </div>
          </div>
          <IconButton icon={<X className="h-4 w-4" />} label="Fermer" size="xs" onClick={onClose} />
        </div>

        <div className="px-6 pt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] uppercase tracking-wide text-fg-subtle">Solde caisse</span>
            {loading ? (
              <Skeleton className="h-5" width="80px" />
            ) : (
              <span className="num text-xl font-bold text-fg">{formatCurrency(summary?.balance ?? 0)}</span>
            )}
          </div>
          {!loading && summary && (
            <p className="mt-1 text-[11px] text-fg-subtle">
              Ventes especes <span className="num">{formatCurrency(summary.cashSalesTotal)}</span>
              {summary.cashRefundsTotal !== 0 && <> · Retours <span className="num">{formatCurrency(summary.cashRefundsTotal)}</span></>}
              {summary.manualNet !== 0 && <> · Mouvements manuels <span className="num">{formatCurrency(summary.manualNet)}</span></>}
            </p>
          )}
        </div>

        <div className="p-6">
          <Tabs
            variant="segmented"
            className="mb-4 grid w-full grid-cols-2"
            items={[
              { value: 'Deposit', label: 'Dépôt', icon: <ArrowUp className="h-4 w-4" /> },
              { value: 'Withdrawal', label: 'Retrait', icon: <ArrowDown className="h-4 w-4" /> },
            ]}
            value={type}
            onChange={setType}
          />

          <Input
            ref={amountRef}
            type="text"
            inputMode="decimal"
            label="Montant (MAD)"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
            placeholder="0.00"
            wrapperClassName="mb-4"
            className={
              'num h-auto px-4 py-3 text-2xl font-bold ' +
              (type === 'Deposit'
                ? 'text-[var(--positive)] focus:border-[var(--positive)] focus:shadow-[0_0_0_3px_var(--positive-soft)]'
                : 'text-[var(--negative)] focus:border-[var(--negative)] focus:shadow-[0_0_0_3px_var(--negative-soft)]')
            }
          />

          <Textarea
            label="Motif (optionnel)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex : achat fournitures, dépôt banque, avance..."
            rows={2}
            wrapperClassName="mb-5"
            className="resize-none"
          />

          {/* grid, not flex: two shrink-0 fullWidth buttons in a flex row both
              claim 100% width and can't shrink for each other - see Button.tsx. */}
          <div className="mb-5 grid grid-cols-2 gap-2">
            <Button variant="outline" fullWidth onClick={onClose}>
              Annuler
            </Button>
            <Button
              variant={type === 'Deposit' ? 'success' : 'danger'}
              fullWidth
              onClick={handleSubmit}
              disabled={!isValid || submitting}
              loading={submitting}
            >
              {type === 'Deposit' ? 'Confirmer le dépôt' : 'Confirmer le retrait'}
            </Button>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Mouvements récents</p>
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-9" />
                ))}
              </div>
            ) : !summary || summary.recent.length === 0 ? (
              <p className="py-3 text-center text-sm text-fg-subtle">Aucun mouvement enregistré</p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {summary.recent.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-inset px-3 py-2 text-sm hover:bg-surface-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <StatusDot tone={m.type === 'Deposit' ? 'positive' : 'negative'} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-fg-muted">{m.reason || (m.type === 'Deposit' ? 'Dépôt' : 'Retrait')}</p>
                        <p className="text-[11px] text-fg-subtle">{m.userFullName} · {formatDateTime(m.createdAt)}</p>
                      </div>
                    </div>
                    <span
                      className={
                        'num ml-2 shrink-0 font-semibold ' +
                        (m.type === 'Deposit' ? 'text-[var(--positive)]' : 'text-[var(--negative)]')
                      }
                    >
                      {m.type === 'Deposit' ? '+' : '-'}{formatCurrency(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
