import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { onlineApi } from '../../api/online'
import { shopifyApi, type ShopifySyncStatus } from '../../api/shopify'
import { ozonApi } from '../../api/ozon'
import { showToast } from '../../components/shared/Toast'
import { formatCurrency, formatDateTime } from '../../utils/format'
import {
  Button, Card, DataTable, EmptyState, Page, Skeleton, Tabs, type Column,
} from '../../components/ui'
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

  const conflictColumns: Column<OnlineOrder>[] = [
    { key: 'orderNumber', header: 'Commande', render: (o) => <span className="num font-medium text-fg">{o.orderNumber}</span> },
    { key: 'channel', header: 'Canal', render: (o) => <span className="text-fg-muted">{o.channel}</span> },
    { key: 'customer', header: 'Client', render: (o) => <span className="text-fg-muted">{o.customerName}</span> },
    { key: 'date', header: 'Date', render: (o) => <span className="text-fg-muted">{formatDateTime(o.createdAt)}</span> },
    {
      key: 'items',
      header: 'Articles',
      render: (o) => {
        const unmapped = o.items.filter((i) => !i.productVariantId)
        if (o.items.length === 0) {
          return <span className="text-xs font-medium text-[var(--negative)]">Aucun article — utiliser "Récupérer depuis Shopify"</span>
        }
        if (unmapped.length > 0) {
          return (
            <div className="space-y-0.5">
              {unmapped.map((i) => (
                <div key={i.id} className="flex items-center gap-1 text-xs text-[var(--caution-ink)]" title={`SKU Shopify: ${i.shopifySku ?? '—'}`}>
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {i.productName} (×{i.quantity})
                </div>
              ))}
            </div>
          )
        }
        return <span className="text-xs text-fg-subtle">{o.items.length} article(s) — stock insuffisant</span>
      },
    },
    { key: 'total', header: 'Total', numeric: true, render: (o) => <span className="font-medium text-fg">{formatCurrency(o.totalAmount)}</span> },
    {
      key: 'action',
      header: 'Action',
      align: 'center',
      render: (o) => (
        <button onClick={() => handleCancel(o)} className="rounded-inset px-2 py-1 text-xs font-medium text-[var(--negative)] transition-colors hover:bg-[var(--negative-soft)]">
          Annuler
        </button>
      ),
    },
  ]

  const cityColumns: Column<{ rawCity: string; orderCount: number }>[] = [
    { key: 'rawCity', header: 'Ville (texte brut)', render: (c) => <span className="text-fg" dir="auto">{c.rawCity}</span> },
    { key: 'orderCount', header: 'Commandes concernées', numeric: true, render: (c) => <span className="text-fg-muted">{c.orderCount}</span> },
  ]

  return (
    <Page section="onlineSync" title="Synchronisation">
      <div className="space-y-5">
        <Tabs
          variant="segmented"
          layoutGroupId="sync-tabs"
          value={tab}
          onChange={(v) => setTab(v as SyncTab)}
          items={TABS.map((t) => ({ value: t.key, label: t.label }))}
        />

        {tab === 'conflicts' && (
          conflicts.length === 0 && !loading ? (
            <div className="surface-glass">
              <EmptyState icon={CheckCircle2} title="Aucun conflit de stock" description="Tout est synchronisé." />
            </div>
          ) : (
            <Card padded={false} className="border-[color-mix(in_oklab,var(--negative)_25%,transparent)]">
              <div className="flex items-center justify-between border-b border-[color-mix(in_oklab,var(--negative)_25%,transparent)] bg-[var(--negative-soft)] px-4 py-3">
                <p className="num text-sm font-medium text-[var(--negative-ink)]">{conflicts.length} commande(s) en conflit de stock</p>
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    loading={backfilling}
                    title="Récupère les articles manquants depuis Shopify pour les commandes sans aucun article"
                    onClick={handleBackfill}
                  >
                    Récupérer depuis Shopify
                  </Button>
                  <Button size="xs" variant="success" loading={rematching} onClick={handleRematch}>
                    Rapprocher le catalogue
                  </Button>
                </div>
              </div>
              <DataTable columns={conflictColumns} data={conflicts} keyField={(o) => o.id} loading={loading} />
            </Card>
          )
        )}

        {tab === 'status' && statusLoading ? (
          <div className="max-w-2xl">
            <Skeleton className="h-40" />
          </div>
        ) : tab === 'status' && (
          <div className="max-w-2xl space-y-4">
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-fg">Statut de la synchronisation Shopify</h3>
                <Button size="xs" variant="success" loading={syncing} onClick={handleTriggerSync}>
                  Synchroniser maintenant
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-fg-subtle">Dernière exécution</p>
                  <p className="text-sm font-medium text-fg">{status?.lastSyncTime ? formatDateTime(status.lastSyncTime) : '—'}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-fg-subtle">Commandes en conflit</p>
                  <p className="num text-sm font-medium text-fg">{status?.pendingOrders ?? 0}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-fg-subtle">État</p>
                  <p className="text-sm font-medium text-fg">{status?.isSyncing ? 'En cours' : 'Inactif'}</p>
                </div>
              </div>
            </Card>
            <p className="text-xs text-fg-subtle">
              La synchronisation automatique nécessite une connexion Shopify configurée dans{' '}
              <span className="font-medium text-fg-muted">Paramètres → Boutique en ligne → Shopify</span>. Sans domaine/jeton
              configurés, le déclenchement manuel n'a aucun effet.
            </p>
          </div>
        )}

        {tab === 'cities' && (
          unresolvedCities.length === 0 && !citiesLoading ? (
            <div className="surface-glass">
              <EmptyState icon={CheckCircle2} title="Toutes les villes sont rapprochées" description="Le catalogue OzonExpress est à jour." />
            </div>
          ) : (
            <Card padded={false} className="border-[color-mix(in_oklab,var(--caution)_25%,transparent)]">
              <div className="flex items-center justify-between border-b border-[color-mix(in_oklab,var(--caution)_25%,transparent)] bg-[var(--caution-soft)] px-4 py-3">
                <p className="num text-sm font-medium text-[var(--caution-ink)]">{unresolvedCities.length} orthographe(s) de ville non rapprochée(s)</p>
                <Button size="xs" variant="success" loading={bootstrapping} onClick={handleBootstrapCities}>
                  Relancer le rapprochement
                </Button>
              </div>
              <DataTable columns={cityColumns} data={unresolvedCities} keyField={(c) => c.rawCity} loading={citiesLoading} />
            </Card>
          )
        )}
      </div>
    </Page>
  )
}
