import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Link2, RefreshCw, Search, Trash2 } from 'lucide-react'
import { showToast } from '../../components/shared/Toast'
import {
  shopifyLinkApi,
  shopifySyncApi,
  type UnlinkedVariant,
  type ShopifyVariantCandidate,
  type BulkSyncProgress,
} from '../../api/shopifyLink'
import { productsApi, type DraftProduct, type DeleteDraftProductsResult } from '../../api/products'
import {
  Badge, Button, Card, DataTable, EmptyState, Input, Modal, Page,
  ProgressBar, Spinner, type Column,
} from '../../components/ui'

export default function OnlineLinkPage() {
  const [unlinked, setUnlinked] = useState<UnlinkedVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<UnlinkedVariant | null>(null)
  const [candidates, setCandidates] = useState<ShopifyVariantCandidate[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [sync, setSync] = useState<BulkSyncProgress | null>(null)

  const [draftsOpen, setDraftsOpen] = useState(false)
  const [drafts, setDrafts] = useState<DraftProduct[]>([])
  const [draftsLoading, setDraftsLoading] = useState(false)
  const [draftsBusy, setDraftsBusy] = useState(false)
  const [draftsResult, setDraftsResult] = useState<DeleteDraftProductsResult | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setUnlinked(await shopifyLinkApi.getUnlinked())
    } catch {
      showToast('Erreur lors du chargement des variantes non liees', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Poll while a reconciliation is running so the user sees it move rather than guessing.
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const s = await shopifySyncApi.status()
        if (alive) setSync(s)
      } catch { /* transient - keep the last known progress */ }
    }
    tick()
    const id = setInterval(tick, 2000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const startSync = async () => {
    try {
      const res = await shopifySyncApi.syncAll()
      setSync(res.progress)
      showToast(res.message, res.started ? 'success' : 'info')
    } catch {
      showToast('Impossible de lancer la synchronisation', 'error')
    }
  }

  const openVariant = async (v: UnlinkedVariant) => {
    setSelected(v)
    setSearch('')
    setCandidatesLoading(true)
    setCandidates([])
    try {
      setCandidates(await shopifyLinkApi.suggestions(v.productVariantId))
    } catch {
      showToast('Impossible de charger les suggestions Shopify', 'error')
    } finally {
      setCandidatesLoading(false)
    }
  }

  const runSearch = async () => {
    if (!search.trim()) return
    setCandidatesLoading(true)
    try {
      setCandidates(await shopifyLinkApi.search(search.trim()))
    } catch {
      showToast('Recherche Shopify impossible', 'error')
    } finally {
      setCandidatesLoading(false)
    }
  }

  const doLink = async (c: ShopifyVariantCandidate) => {
    if (!selected || busy) return
    setBusy(true)
    try {
      const res = await shopifyLinkApi.link(selected.productVariantId, c.shopifyVariantId)
      showToast(res.message, res.success ? 'success' : 'warning')
      if (res.success) {
        setSelected(null)
        await load()
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message ?? 'Echec de la liaison', 'error')
    } finally {
      setBusy(false)
    }
  }

  const doAutoLink = async () => {
    if (busy) return
    setBusy(true)
    try {
      const res = await shopifyLinkApi.autoLink()
      showToast(
        `${res.linked} liee(s), ${res.ambiguous} ambigue(s), ${res.noMatch} sans correspondance`,
        res.linked > 0 ? 'success' : 'info'
      )
      await load()
    } catch {
      showToast('Liaison automatique impossible', 'error')
    } finally {
      setBusy(false)
    }
  }

  const openDrafts = async () => {
    setDraftsOpen(true)
    setDraftsResult(null)
    setDraftsLoading(true)
    try {
      setDrafts(await productsApi.getDrafts())
    } catch {
      showToast('Impossible de charger les produits brouillon', 'error')
    } finally {
      setDraftsLoading(false)
    }
  }

  const confirmDeleteDrafts = async () => {
    if (draftsBusy) return
    setDraftsBusy(true)
    try {
      const res = await productsApi.deleteDrafts()
      setDraftsResult(res)
      setDrafts([])
      showToast(
        res.skipped.length > 0
          ? `${res.deleted} produit(s) supprime(s), ${res.skipped.length} conserve(s) (historique existant)`
          : `${res.deleted} produit(s) brouillon supprime(s)`,
        res.deleted > 0 ? 'success' : 'info'
      )
    } catch {
      showToast('Echec de la suppression des produits brouillon', 'error')
    } finally {
      setDraftsBusy(false)
    }
  }

  const columns: Column<UnlinkedVariant>[] = [
    { key: 'product', header: 'Produit', render: (v) => <span className="font-medium text-fg">{v.productName}</span> },
    { key: 'size', header: 'Taille', render: (v) => <span className="text-fg-muted">{v.sizeValue ?? '-'}</span> },
    { key: 'sku', header: 'SKU', render: (v) => <span className="num text-xs text-fg-subtle">{v.sku}</span> },
    { key: 'barcode', header: 'Code-barres', render: (v) => <span className="num text-xs text-fg-subtle">{v.barcode ?? '-'}</span> },
    { key: 'stock', header: 'Stock', numeric: true, render: (v) => <span className="text-fg-muted">{v.quantityOnHand}</span> },
    {
      key: 'link',
      header: '',
      align: 'right',
      render: (v) => (
        <Button size="xs" icon={<Link2 className="h-3.5 w-3.5" />} onClick={() => openVariant(v)}>
          Lier à Shopify
        </Button>
      ),
    },
  ]

  const syncTone = sync?.isRunning ? 'info' : sync && sync.failed > 0 ? 'caution' : 'positive'
  const syncPct = sync && sync.totalLinked > 0 ? Math.min(100, (sync.compared / sync.totalLinked) * 100) : 0

  return (
    <Page
      section="onlineLink"
      title="Liaison Shopify"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={openDrafts}>
            Produits brouillon
          </Button>
          <Button variant="outline" size="sm" disabled={busy || loading} onClick={doAutoLink}>
            Liaison automatique
          </Button>
          <Button
            size="sm"
            variant="success"
            disabled={sync?.isRunning}
            icon={sync?.isRunning ? undefined : <RefreshCw className="h-4 w-4" />}
            loading={sync?.isRunning}
            onClick={startSync}
          >
            {sync?.isRunning ? 'Synchronisation...' : 'Synchroniser vers Shopify'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {sync && (sync.isRunning || sync.finishedAt) && (
          <Card data-tone={syncTone}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-fg">Synchronisation du stock vers Shopify</p>
              <Badge tone={syncTone} size="sm">{sync.phase}</Badge>
            </div>

            <ProgressBar value={syncPct} tone="positive" className="mb-2" />

            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-fg-subtle">Comparées</p>
                <p className="num text-sm font-semibold text-fg">{sync.compared}/{sync.totalLinked}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-fg-subtle">Différentes</p>
                <p className="num text-sm font-semibold text-[var(--caution)]">{sync.differing}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-fg-subtle">Mises à jour</p>
                <p className="num text-sm font-semibold text-[var(--positive)]">{sync.pushed}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-fg-subtle">Échecs</p>
                <p className="num text-sm font-semibold text-[var(--negative)]">{sync.failed}</p>
              </div>
            </div>

            {sync.lastError && <p className="mt-2 text-xs text-[var(--negative)]">{sync.lastError}</p>}

            {sync.recent.length > 0 && (
              <div className="mt-3 max-h-32 space-y-0.5 overflow-y-auto border-t border-border pt-2">
                {sync.recent.map((line, i) => (
                  <p key={i} className="num font-mono text-[11px] text-fg-subtle">{line}</p>
                ))}
              </div>
            )}
          </Card>
        )}

        <div
          data-tone="info"
          className="rounded-card border border-[color-mix(in_oklab,var(--tone)_25%,transparent)] bg-[var(--tone-soft)] px-4 py-3 text-sm text-[var(--tone-ink)]"
        >
          Seules les variantes liées à une variante Shopify voient leur stock synchronisé avec la
          boutique. Les variantes ci-dessous sont vendues en magasin mais <strong>ne mettent pas à
          jour Shopify</strong> tant qu'elles ne sont pas liées.
        </div>

        {!loading && unlinked.length === 0 ? (
          <div className="surface-glass">
            <EmptyState icon={CheckCircle2} title="Toutes les variantes sont liées" description="Aucune action requise." />
          </div>
        ) : (
          <DataTable columns={columns} data={unlinked} keyField={(v) => v.productVariantId} loading={loading} />
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        size="2xl"
        title={selected ? `Lier « ${selected.productName} » ${selected.sizeValue ?? ''}` : undefined}
        description={
          selected
            ? `${selected.sku}${selected.barcode ? ` · ${selected.barcode}` : ''} · stock ${selected.quantityOnHand}`
            : undefined
        }
      >
        <div className="-mx-5 -mt-4 mb-4 flex gap-2 border-b border-border px-5 pb-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
            placeholder="Rechercher dans Shopify (nom, SKU, code-barres, ID)..."
            leading={<Search />}
            wrapperClassName="flex-1"
          />
          <Button variant="outline" onClick={runSearch}>Rechercher</Button>
        </div>

        {candidatesLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : candidates.length === 0 ? (
          <p className="py-10 text-center text-sm text-fg-subtle">
            Aucune correspondance. Utilisez la recherche ci-dessus.
          </p>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => (
              <div
                key={c.shopifyVariantId}
                className="flex items-center justify-between gap-3 rounded-field border border-border px-3 py-2.5 transition-colors hover:border-border-strong"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">
                    {c.productTitle}{c.variantTitle ? ` — ${c.variantTitle}` : ''}
                  </p>
                  <p className="num font-mono text-[11px] text-fg-subtle">
                    ID {c.shopifyVariantId}
                    {c.sku ? ` · ${c.sku}` : ''}
                    {c.barcode ? ` · ${c.barcode}` : ''}
                    {c.inventoryQuantity != null ? ` · stock Shopify ${c.inventoryQuantity}` : ''}
                  </p>
                  {c.matchReason && (
                    <Badge tone="positive" size="xs" className="mt-1">{c.matchReason}</Badge>
                  )}
                </div>
                {c.alreadyLinked ? (
                  <Badge tone="caution" size="sm" className="whitespace-nowrap">
                    Déjà liée (#{c.linkedLocalVariantId})
                  </Badge>
                ) : (
                  <Button size="xs" variant="success" loading={busy} onClick={() => doLink(c)} className="whitespace-nowrap">
                    Lier
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={draftsOpen}
        onClose={() => setDraftsOpen(false)}
        size="lg"
        title="Produits brouillon"
        description="Produits importes depuis Shopify dont le statut n'est plus actif (brouillon, archive). Leur suppression est definitive."
      >
        {draftsLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : draftsResult ? (
          <div className="space-y-3">
            <div
              data-tone={draftsResult.skipped.length > 0 ? 'caution' : 'positive'}
              className="rounded-card border border-[color-mix(in_oklab,var(--tone)_25%,transparent)] bg-[var(--tone-soft)] px-4 py-3 text-sm text-[var(--tone-ink)]"
            >
              {draftsResult.deleted} produit(s) supprime(s) sur {draftsResult.totalDrafts}.
              {draftsResult.skipped.length > 0 && ` ${draftsResult.skipped.length} conserve(s) car lie(s) a un historique.`}
            </div>
            {draftsResult.skipped.length > 0 && (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {draftsResult.skipped.map((s) => (
                  <div key={s.id} className="rounded-field border border-border px-3 py-2 text-xs">
                    <p className="font-medium text-fg">{s.name}</p>
                    <p className="text-fg-subtle">{s.reason}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setDraftsOpen(false)}>Fermer</Button>
            </div>
          </div>
        ) : drafts.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Aucun produit brouillon" description="Rien a nettoyer." />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-fg-muted">
              {drafts.length} produit(s) brouillon trouve(s). Les produits ayant deja des ventes, factures,
              commandes en ligne ou mouvements de stock seront automatiquement conserves.
            </p>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {drafts.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-field border border-border px-3 py-2 text-sm">
                  <span className="truncate text-fg">{d.name}</span>
                  <Badge tone="neutral" size="xs">{d.variantCount} variante(s)</Badge>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" size="sm" onClick={() => setDraftsOpen(false)}>Annuler</Button>
              <Button
                size="sm"
                variant="danger"
                loading={draftsBusy}
                icon={<Trash2 className="h-4 w-4" />}
                onClick={confirmDeleteDrafts}
              >
                Supprimer les {drafts.length} produit(s)
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
