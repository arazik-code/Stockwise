import { useState, useEffect, useCallback } from 'react'
import Header from '../../components/layout/Header'
import { showToast } from '../../components/shared/Toast'
import { codFinanceApi, type CodFinanceDashboard, type CourierRemittance } from '../../api/codFinance'
import { formatCurrency, formatDateTime } from '../../utils/format'

type Tab = 'overview' | 'remittances'

export default function OnlineFinancePage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [dashboard, setDashboard] = useState<CodFinanceDashboard | null>(null)
  const [remittances, setRemittances] = useState<CourierRemittance[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, r] = await Promise.all([codFinanceApi.getDashboard(), codFinanceApi.getRemittances()])
      setDashboard(d)
      setRemittances(r)
    } catch {
      showToast('Erreur lors du chargement des donnees financieres', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedTotal = dashboard?.oldestOutstanding
    .filter((o) => selected.has(o.onlineOrderId))
    .reduce((sum, o) => sum + o.codAmount, 0) ?? 0

  const handleCreateRemittance = async (formData: FormData) => {
    if (selected.size === 0) {
      showToast('Selectionnez au moins une commande a inclure', 'error')
      return
    }
    setCreating(true)
    try {
      await codFinanceApi.createRemittance({
        carrier: 'OzonExpress',
        reference: (formData.get('reference') as string) || undefined,
        periodStart: formData.get('periodStart') as string,
        periodEnd: formData.get('periodEnd') as string,
        declaredAmount: parseFloat(formData.get('declaredAmount') as string) || 0,
        bankRef: (formData.get('bankRef') as string) || undefined,
        onlineOrderIds: Array.from(selected),
      })
      showToast('Remise enregistree', 'success')
      setSelected(new Set())
      setShowCreate(false)
      load()
    } catch {
      showToast('Echec de l\'enregistrement de la remise', 'error')
    } finally {
      setCreating(false)
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Encaissements COD" />
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Encaissements COD" />
      <div className="px-6 pt-5">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {[{ key: 'overview' as Tab, label: 'Vue d\'ensemble' }, { key: 'remittances' as Tab, label: 'Remises courrier' }].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && dashboard && (
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">COD en attente</p>
              <p className="text-xl font-semibold text-amber-600">{formatCurrency(dashboard.outstandingCod)}</p>
              <p className="text-xs text-slate-400 mt-1">{dashboard.outstandingCount} commande(s)</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Encaisse ce mois</p>
              <p className="text-xl font-semibold text-emerald-600">{formatCurrency(dashboard.collectedThisMonth)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Frais coursier ce mois</p>
              <p className="text-xl font-semibold text-red-600">{formatCurrency(dashboard.courierFeesThisMonth)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Net ce mois</p>
              <p className="text-xl font-semibold text-slate-900">{formatCurrency(dashboard.netThisMonth)}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Anciennete du COD en attente</h3>
            <div className="grid grid-cols-4 gap-3">
              {dashboard.aging.map((bucket) => (
                <div key={bucket.label} className={`rounded-lg p-3 border ${bucket.label === '30+ jours' && bucket.count > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                  <p className="text-xs text-slate-500">{bucket.label}</p>
                  <p className="text-lg font-semibold text-slate-900">{bucket.count}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(bucket.amount)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Commandes en attente de remise (les plus anciennes)</h3>
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{selected.size} selectionnee(s) - {formatCurrency(selectedTotal)}</span>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="text-xs font-medium px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Creer une remise
                  </button>
                </div>
              )}
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 w-8"></th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Commande</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Tracking</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Livree le</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Jours</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Montant COD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dashboard.oldestOutstanding.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">Rien en attente - tout est reconcilie.</td></tr>
                ) : dashboard.oldestOutstanding.map((o) => (
                  <tr key={o.onlineOrderId} className={`hover:bg-slate-50 ${selected.has(o.onlineOrderId) ? 'bg-emerald-50' : ''}`}>
                    <td className="px-4 py-2.5">
                      <input type="checkbox" checked={selected.has(o.onlineOrderId)} onChange={() => toggleSelect(o.onlineOrderId)} />
                    </td>
                    <td className="px-4 py-2.5 text-sm font-mono font-medium text-slate-900">{o.orderNumber}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-600">{o.customerName}</td>
                    <td className="px-4 py-2.5 text-sm font-mono text-slate-500">{o.trackingNumber ?? '-'}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-600">{o.deliveredAt ? formatDateTime(o.deliveredAt) : '-'}</td>
                    <td className={`px-4 py-2.5 text-sm text-right font-medium ${o.daysOutstanding > 30 ? 'text-red-600' : 'text-slate-600'}`}>{o.daysOutstanding}</td>
                    <td className="px-4 py-2.5 text-sm text-right font-medium text-slate-900">{formatCurrency(o.codAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'remittances' && (
        <div className="p-6">
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Reference</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Periode</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Declare</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Rapproche</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Ecart</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Statut</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Commandes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {remittances.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">Aucune remise enregistree pour le moment.</td></tr>
                ) : remittances.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{r.reference || `#${r.id}`}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-600">{formatDateTime(r.periodStart)} - {formatDateTime(r.periodEnd)}</td>
                    <td className="px-4 py-2.5 text-sm text-right text-slate-900">{formatCurrency(r.declaredAmount)}</td>
                    <td className="px-4 py-2.5 text-sm text-right text-slate-900">{formatCurrency(r.matchedAmount)}</td>
                    <td className={`px-4 py-2.5 text-sm text-right font-medium ${Math.abs(r.varianceAmount) > 0.01 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatCurrency(r.varianceAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        r.status === 'Reconciled' ? 'bg-emerald-50 text-emerald-700' : r.status === 'Disputed' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {r.status === 'Reconciled' ? 'Reconcilie' : r.status === 'Disputed' ? 'Ecart' : r.status === 'Closed' ? 'Cloture' : 'Brouillon'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right text-slate-600">{r.orderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[480px] border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Nouvelle remise coursier</h3>
            <form
              onSubmit={(e) => { e.preventDefault(); handleCreateRemittance(new FormData(e.currentTarget)) }}
              className="space-y-3"
            >
              <p className="text-xs text-slate-500 bg-slate-50 rounded p-2">
                {selected.size} commande(s) selectionnee(s) - total du a solder : {formatCurrency(selectedTotal)}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Debut periode</label>
                  <input name="periodStart" type="date" required className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Fin periode</label>
                  <input name="periodEnd" type="date" required className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Montant declare par le coursier (MAD)</label>
                <input name="declaredAmount" type="number" step="0.01" required defaultValue={selectedTotal.toFixed(2)} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Reference (optionnel)</label>
                <input name="reference" type="text" className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Reference bancaire (optionnel)</label>
                <input name="bankRef" type="text" className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-3.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 rounded-md">Annuler</button>
                <button type="submit" disabled={creating} className="px-3.5 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50">
                  {creating ? 'Enregistrement...' : 'Enregistrer la remise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
