import { useState, useEffect, useCallback } from 'react'
import Header from '../../components/layout/Header'
import { onlineApi } from '../../api/online'
import { shopifyApi, type ShopifySyncStatus } from '../../api/shopify'
import { ozonApi } from '../../api/ozon'
import { showToast } from '../../components/shared/Toast'
import { formatCurrency, formatDateTime } from '../../utils/format'
import type { OnlineOrder } from '../../types/onlineOrder'

type SyncTab = 'conflicts' | 'status' | 'cities'

const TABS: { key: SyncTab; label: string }[] = [
  { key: 'conflicts', label: 'Conflits de stock' },
  { key: 'status', label: 'État de synchronisation' },
  { key: 'cities', label: 'Villes non résolues' },
]

export default function OnlineSyncPage() {
  const [tab, setTab] = useState<SyncTab>('conflicts')
  const [conflicts, setConflicts] = useState<OnlineOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<ShopifySyncStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [rematching, setRematching] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [unresolvedCities, setUnresolvedCities] = useState<{ rawCity: string; orderCount: number }[]>([])
  const [citiesLoading, setCitiesLoading] = useState(true)
  const [bootstrapping, setBootstrapping] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await onlineApi.getConflicts()
      setConflicts(data)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const data = await shopifyApi.getSyncStatus()
      setStatus(data)
    } finally {
      setStatusLoading(false)
    }
  }, [])

  const loadUnresolvedCities = useCallback(async () => {
    setCitiesLoading(true)
    try {
      const data = await ozonApi.getUnresolvedCities()
      setUnresolvedCities(data)
    } finally {
      setCitiesLoading(false)
    }
  }, [])

  useEffect(() => { if (tab === 'conflicts') load() }, [tab, load])
  useEffect(() => { if (tab === 'status') loadStatus() }, [tab, loadStatus])
  useEffect(() => { if (tab === 'cities') loadUnresolvedCities() }, [tab, loadUnresolvedCities])

  const handleBootstrapCities = async () => {
    setBootstrapping(true)
    try {
      const result = await ozonApi.bootstrapCities()
      showToast(
        `${result.resolved} ville(s) rapprochee(s) sur ${result.distinctSpellings}, ${result.ordersUpdated} commande(s) mise(s) a jour`,
        'success'
      )
      loadUnresolvedCities()
    } catch {
      showToast('Echec du rapprochement des villes', 'error')
    } finally {
      setBootstrapping(false)
    }
  }

  const handleCancel = async (order: OnlineOrder) => {
    if (!confirm(`Annuler la commande ${order.orderNumber} et libérer le stock réservé ?`)) return
    try {
      await onlineApi.cancel(order.id, 'Conflit de stock non résolu')
      showToast('Commande annulée', 'success')
      load()
    } catch {
      showToast('Erreur', 'error')
    }
  }

  const handleRematch = async () => {
    setRematching(true)
    try {
      const result = await shopifyApi.rematchConflicts()
      if (result.ordersResolved > 0) {
        showToast(`${result.ordersResolved} commande(s) résolue(s) sur ${result.conflictedOrders}`, 'success')
      } else {
        showToast('Aucune commande supplémentaire résolue pour le moment', 'info')
      }
      load()
    } catch {
      showToast('Échec du rapprochement', 'error')
    } finally {
      setRematching(false)
    }
  }

  const handleBackfill = async () => {
    if (!confirm("Récupérer les articles manquants depuis Shopify pour les commandes en conflit sans aucun article ? Cette opération peut prendre quelques minutes.")) return
    setBackfilling(true)
    try {
      const result = await shopifyApi.backfillConflicts()
      showToast(
        `${result.backfill.ordersRebuilt} commande(s) reconstruite(s), ${result.rematch.ordersResolved} résolue(s)`,
        'success'
      )
      load()
    } catch {
      showToast('Échec de la récupération — vérifiez la configuration Shopify', 'error')
    } finally {
      setBackfilling(false)
    }
  }

  const handleTriggerSync = async () => {
    setSyncing(true)
    try {
      await shopifyApi.triggerSync()
      showToast('Synchronisation déclenchée', 'success')
      await loadStatus()
    } catch {
      showToast("Échec de la synchronisation — vérifiez la configuration Shopify dans Paramètres", 'error')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Synchronisation" />
      <div className="px-6 pt-5">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {TABS.map((t) => (
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

      {tab === 'conflicts' && (
        <div className="p-6 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
          ) : conflicts.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-12 h-12 mx-auto mb-3 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-slate-500">Aucun conflit de stock — tout est synchronisé.</p>
            </div>
          ) : (
            <div className="bg-white border border-red-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between">
                <p className="text-sm font-medium text-red-700">{conflicts.length} commande(s) en conflit de stock</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBackfill}
                    disabled={backfilling}
                    title="Récupère les articles manquants depuis Shopify pour les commandes sans aucun article"
                    className="text-xs font-medium px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {backfilling ? 'Récupération…' : 'Récupérer depuis Shopify'}
                  </button>
                  <button
                    onClick={handleRematch}
                    disabled={rematching}
                    title="Retente le rapprochement avec le catalogue actuel pour tous les articles non résolus"
                    className="text-xs font-medium px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {rematching ? 'Rapprochement…' : 'Rapprocher le catalogue'}
                  </button>
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Commande</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Canal</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Client</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Articles</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {conflicts.map((order) => {
                    const unmapped = order.items.filter((i) => !i.productVariantId)
                    return (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-mono font-medium text-slate-900">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{order.channel}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{order.customerName}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(order.createdAt)}</td>
                        <td className="px-4 py-3 text-sm">
                          {order.items.length === 0 ? (
                            <span className="text-xs text-red-600 font-medium">Aucun article — utiliser "Récupérer depuis Shopify"</span>
                          ) : unmapped.length > 0 ? (
                            <div className="space-y-0.5">
                              {unmapped.map((i) => (
                                <div key={i.id} className="text-xs text-amber-700" title={`SKU Shopify: ${i.shopifySku ?? '—'}`}>
                                  ⚠ {i.productName} (×{i.quantity})
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">{order.items.length} article(s) — stock insuffisant</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-slate-900">{formatCurrency(order.totalAmount)}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <button onClick={() => handleCancel(order)} className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50">
                            Annuler
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {tab === 'status' && (
        <div className="p-6 flex-1">
          {statusLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
          ) : (
            <div className="max-w-2xl space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">Statut de la synchronisation Shopify</h3>
                  <button
                    onClick={handleTriggerSync}
                    disabled={syncing}
                    className="text-xs font-medium px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Dernière exécution</p>
                    <p className="text-sm font-medium text-slate-900">{status?.lastSyncTime ? formatDateTime(status.lastSyncTime) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Commandes en conflit</p>
                    <p className="text-sm font-medium text-slate-900">{status?.pendingOrders ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">État</p>
                    <p className="text-sm font-medium text-slate-900">{status?.isSyncing ? 'En cours' : 'Inactif'}</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                La synchronisation automatique nécessite une connexion Shopify configurée dans{' '}
                <span className="font-medium text-slate-500">Paramètres → Boutique en ligne → Shopify</span>. Sans domaine/jeton configurés, le déclenchement manuel n'a aucun effet.
              </p>
            </div>
          )}
        </div>
      )}
      {tab === 'cities' && (
        <div className="p-6 flex-1">
          {citiesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
          ) : unresolvedCities.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-12 h-12 mx-auto mb-3 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-slate-500">Toutes les villes sont rapprochees du catalogue OzonExpress.</p>
            </div>
          ) : (
            <div className="bg-white border border-amber-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                <p className="text-sm font-medium text-amber-700">{unresolvedCities.length} orthographe(s) de ville non rapprochee(s)</p>
                <button
                  onClick={handleBootstrapCities}
                  disabled={bootstrapping}
                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {bootstrapping ? 'Rapprochement…' : 'Relancer le rapprochement'}
                </button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Ville (texte brut)</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Commandes concernees</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unresolvedCities.map((c) => (
                    <tr key={c.rawCity} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-sm text-slate-900" dir="auto">{c.rawCity}</td>
                      <td className="px-4 py-2.5 text-sm text-right text-slate-600">{c.orderCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
