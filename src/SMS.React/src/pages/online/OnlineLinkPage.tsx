import { useState, useEffect, useCallback } from 'react'
import Header from '../../components/layout/Header'
import { showToast } from '../../components/shared/Toast'
import {
  shopifyLinkApi,
  shopifySyncApi,
  type UnlinkedVariant,
  type ShopifyVariantCandidate,
  type BulkSyncProgress,
} from '../../api/shopifyLink'

export default function OnlineLinkPage() {
  const [unlinked, setUnlinked] = useState<UnlinkedVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<UnlinkedVariant | null>(null)
  const [candidates, setCandidates] = useState<ShopifyVariantCandidate[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [sync, setSync] = useState<BulkSyncProgress | null>(null)

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

  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Liaison Shopify"
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={doAutoLink}
              disabled={busy || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Liaison automatique
            </button>
            <button
              onClick={startSync}
              disabled={sync?.isRunning}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {sync?.isRunning ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Synchronisation...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Synchroniser vers Shopify
                </>
              )}
            </button>
          </div>
        }
      />

      <div className="p-6 flex-1 overflow-auto">
        {sync && (sync.isRunning || sync.finishedAt) && (
          <div className="mb-4 bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-900">
                Synchronisation du stock vers Shopify
              </p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                sync.isRunning ? 'bg-blue-50 text-blue-700'
                  : sync.failed > 0 ? 'bg-amber-50 text-amber-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}>
                {sync.phase}
              </span>
            </div>

            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${sync.totalLinked > 0 ? Math.min(100, (sync.compared / sync.totalLinked) * 100) : 0}%` }}
              />
            </div>

            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wide">Comparees</p>
                <p className="text-sm font-semibold text-slate-900 tabular-nums">{sync.compared}/{sync.totalLinked}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wide">Differentes</p>
                <p className="text-sm font-semibold text-amber-600 tabular-nums">{sync.differing}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wide">Mises a jour</p>
                <p className="text-sm font-semibold text-emerald-600 tabular-nums">{sync.pushed}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wide">Echecs</p>
                <p className="text-sm font-semibold text-red-600 tabular-nums">{sync.failed}</p>
              </div>
            </div>

            {sync.lastError && (
              <p className="mt-2 text-xs text-red-600">{sync.lastError}</p>
            )}

            {sync.recent.length > 0 && (
              <div className="mt-3 max-h-32 overflow-y-auto border-t border-slate-100 pt-2 space-y-0.5">
                {sync.recent.map((line, i) => (
                  <p key={i} className="text-[11px] text-slate-500 font-mono">{line}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          Seules les variantes liees a une variante Shopify voient leur stock synchronise avec la
          boutique. Les variantes ci-dessous sont vendues en magasin mais <strong>ne mettent pas a
          jour Shopify</strong> tant qu'elles ne sont pas liees.
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : unlinked.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto mb-3 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-slate-500">Toutes les variantes sont liees a Shopify.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Produit</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Taille</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">SKU</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Code-barres</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Stock</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {unlinked.map((v) => (
                  <tr key={v.productVariantId} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{v.productName}</td>
                    <td className="px-4 py-2.5 text-slate-600">{v.sizeValue ?? '-'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{v.sku}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{v.barcode ?? '-'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{v.quantityOnHand}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => openVariant(v)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                      >
                        Lier a Shopify
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-br from-slate-900 to-slate-700 text-white flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">Lier « {selected.productName} » {selected.sizeValue}</p>
                <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                  {selected.sku}{selected.barcode ? ` · ${selected.barcode}` : ''} · stock {selected.quantityOnHand}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-300 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-3 border-b border-slate-100 flex gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
                placeholder="Rechercher dans Shopify (nom, SKU, code-barres, ID)..."
                className="flex-1 px-3 py-2 text-sm border-2 border-slate-200 rounded-lg focus:outline-none focus:border-slate-400"
              />
              <button
                onClick={runSearch}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Rechercher
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {candidatesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-slate-700" />
                </div>
              ) : candidates.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-10">
                  Aucune correspondance. Utilisez la recherche ci-dessus.
                </p>
              ) : (
                <div className="space-y-2">
                  {candidates.map((c) => (
                    <div
                      key={c.shopifyVariantId}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 border border-slate-200 rounded-lg hover:border-slate-300"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {c.productTitle}{c.variantTitle ? ` — ${c.variantTitle}` : ''}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          ID {c.shopifyVariantId}
                          {c.sku ? ` · ${c.sku}` : ''}
                          {c.barcode ? ` · ${c.barcode}` : ''}
                          {c.inventoryQuantity != null ? ` · stock Shopify ${c.inventoryQuantity}` : ''}
                        </p>
                        {c.matchReason && (
                          <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                            {c.matchReason}
                          </span>
                        )}
                      </div>
                      {c.alreadyLinked ? (
                        <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded whitespace-nowrap">
                          Deja liee (#{c.linkedLocalVariantId})
                        </span>
                      ) : (
                        <button
                          onClick={() => doLink(c)}
                          disabled={busy}
                          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                        >
                          Lier
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
