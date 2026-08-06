import { useState, useEffect, useRef, useCallback } from 'react'
import { cashDrawerApi, type CashDrawerSummary, type CashDrawerMovementType } from '../../api/cashDrawer'
import { showToast } from '../../components/shared/Toast'
import { formatCurrency, formatDateTime } from '../../utils/format'

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
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-2xl w-full max-w-[460px] border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-6 pt-5 pb-4 bg-gradient-to-br from-slate-900 to-slate-700 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-8a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold">Mouvement de caisse</p>
                <p className="text-[11px] text-slate-300">Accès administrateur</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-300 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-[11px] uppercase tracking-wide text-slate-300">Solde caisse</span>
            {loading ? (
              <div className="h-5 w-20 bg-white/10 rounded animate-pulse" />
            ) : (
              <span className="text-xl font-bold tabular-nums">{formatCurrency(summary?.balance ?? 0)}</span>
            )}
          </div>
          {!loading && summary && (
            <p className="text-[11px] text-slate-400 mt-1">
              Ventes especes {formatCurrency(summary.cashSalesTotal)}
              {summary.cashRefundsTotal !== 0 && <> · Retours {formatCurrency(summary.cashRefundsTotal)}</>}
              {summary.manualNet !== 0 && <> · Mouvements manuels {formatCurrency(summary.manualNet)}</>}
            </p>
          )}
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-4">
            <button
              type="button"
              onClick={() => setType('Deposit')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                type === 'Deposit'
                  ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 19V5m0 0l-6 6m6-6l6 6" />
              </svg>
              Dépôt
            </button>
            <button
              type="button"
              onClick={() => setType('Withdrawal')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                type === 'Withdrawal'
                  ? 'bg-white text-red-700 shadow-sm ring-1 ring-red-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 5v14m0 0l-6-6m6 6l6-6" />
              </svg>
              Retrait
            </button>
          </div>

          <label className="block text-xs font-medium text-slate-500 mb-1.5">Montant (MAD)</label>
          <div className="relative mb-4">
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
              placeholder="0.00"
              className={`w-full px-4 py-3 text-2xl font-bold tabular-nums border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors ${
                type === 'Deposit'
                  ? 'border-slate-200 focus:border-emerald-400 focus:ring-emerald-100 text-emerald-700'
                  : 'border-slate-200 focus:border-red-400 focus:ring-red-100 text-red-700'
              }`}
            />
          </div>

          <label className="block text-xs font-medium text-slate-500 mb-1.5">Motif (optionnel)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex : achat fournitures, dépôt banque, avance..."
            rows={2}
            className="w-full px-3.5 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-100 focus:border-slate-300 resize-none mb-5"
          />

          <div className="flex gap-2 mb-5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || submitting}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                type === 'Deposit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {submitting ? '...' : type === 'Deposit' ? 'Confirmer le dépôt' : 'Confirmer le retrait'}
            </button>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Mouvements récents</p>
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-9 bg-slate-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : !summary || summary.recent.length === 0 ? (
              <p className="text-sm text-slate-400 py-3 text-center">Aucun mouvement enregistré</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {summary.recent.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          m.type === 'Deposit' ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-slate-700 truncate">{m.reason || (m.type === 'Deposit' ? 'Dépôt' : 'Retrait')}</p>
                        <p className="text-[11px] text-slate-400">{m.userFullName} · {formatDateTime(m.createdAt)}</p>
                      </div>
                    </div>
                    <span className={`font-semibold tabular-nums flex-shrink-0 ml-2 ${m.type === 'Deposit' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.type === 'Deposit' ? '+' : '-'}{formatCurrency(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
