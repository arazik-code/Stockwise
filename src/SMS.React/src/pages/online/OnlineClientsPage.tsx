import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../../components/layout/Header'
import { showToast } from '../../components/shared/Toast'
import {
  crmApi,
  type ClientAnalytics,
  type ClientCrmSummary,
  type ClientSegment,
  type CrmDashboard,
} from '../../api/clients'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { openWhatsApp, hasWhatsApp, buildClientGreeting } from '../../utils/whatsapp'
import { CATEGORY_BADGE, CATEGORY_LABELS } from '../../utils/clientCategory'

const WhatsAppIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

type SegmentFilter = 'all' | ClientSegment
type SortKey = 'spent' | 'orders' | 'recent' | 'name'

const PAGE_SIZE = 25

const SEGMENT_LABELS: Record<ClientSegment, string> = {
  Vip: 'VIP',
  Regular: 'Régulier',
  AtRisk: 'À risque',
  Lost: 'Perdu',
  New: 'Nouveau',
}

const SEGMENT_BADGE: Record<ClientSegment, string> = {
  Vip: 'bg-amber-50 text-amber-700 border-amber-200',
  Regular: 'bg-slate-50 text-slate-600 border-slate-200',
  AtRisk: 'bg-orange-50 text-orange-700 border-orange-200',
  Lost: 'bg-red-50 text-red-700 border-red-200',
  New: 'bg-cyan-50 text-cyan-700 border-cyan-200',
}

interface Highlight { label: string; className: string }

// Compact, at-a-glance insight chips derived from a client's numbers.
function clientHighlights(c: ClientCrmSummary): Highlight[] {
  const h: Highlight[] = []
  if (c.orderCount >= 4) h.push({ label: `🔁 ${c.orderCount} commandes`, className: 'bg-violet-50 text-violet-700' })
  else if (c.orderCount >= 2) h.push({ label: 'Fidèle', className: 'bg-violet-50 text-violet-700' })
  if (c.totalSpent >= 2500) h.push({ label: '💎 Gros acheteur', className: 'bg-amber-50 text-amber-700' })
  if (c.daysSinceLastOrder != null && c.daysSinceLastOrder <= 30) h.push({ label: '🔥 Actif', className: 'bg-emerald-50 text-emerald-700' })
  if (c.daysSinceLastOrder != null && c.daysSinceLastOrder > 180 && c.orderCount > 0) h.push({ label: '⏰ À relancer', className: 'bg-orange-50 text-orange-700' })
  if (c.orderCount === 0) h.push({ label: 'Sans achat', className: 'bg-slate-100 text-slate-500' })
  return h
}

export default function OnlineClientsPage() {
  const [dashboard, setDashboard] = useState<CrmDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('spent')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await crmApi.getDashboard()
      setDashboard(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Deep-link support: /online/clients?client=123 (used by the order detail modal's "Voir la fiche client" link).
  useEffect(() => {
    const clientParam = searchParams.get('client')
    if (clientParam) setSelectedId(Number(clientParam))
  }, [searchParams])

  const closeDetail = () => {
    setSelectedId(null)
    if (searchParams.get('client')) {
      const next = new URLSearchParams(searchParams)
      next.delete('client')
      setSearchParams(next, { replace: true })
    }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const result = await crmApi.importFromShopify()
      if (!result.configured) {
        showToast('Shopify non configuré — enregistrez vos identifiants dans Paramètres', 'error')
      } else if (!result.approved) {
        showToast(result.message ?? "Shopify n'a pas encore approuvé l'accès aux données clients", 'error')
      } else {
        showToast(
          `Import terminé : ${result.created} nouveaux clients, ${result.updated} mis à jour, ${result.ordersImported} commandes importées`,
          'success',
        )
        load()
      }
    } catch {
      showToast("Erreur lors de l'import des clients Shopify", 'error')
    } finally {
      setImporting(false)
    }
  }

  const clients = dashboard?.clients ?? []

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let list = clients.filter((c) => {
      if (segmentFilter !== 'all' && c.segment !== segmentFilter) return false
      if (q && !(c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.email ?? '').toLowerCase().includes(q))) return false
      return true
    })

    list = [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name)
      if (sortKey === 'orders') return b.orderCount - a.orderCount
      if (sortKey === 'recent') return new Date(b.lastOrderAt ?? 0).getTime() - new Date(a.lastOrderAt ?? 0).getTime()
      return b.totalSpent - a.totalSpent
    })

    return list
  }, [clients, search, segmentFilter, sortKey])

  useEffect(() => { setPage(1) }, [search, segmentFilter, sortKey])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const maxSpent = useMemo(() => Math.max(1, ...clients.map((c) => c.totalSpent)), [clients])

  return (
    <div className="flex flex-col flex-1">
      <Header title="Clients — CRM en ligne" />

      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 px-6 py-6 mt-0">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-slate-300 uppercase tracking-wide">Vue d'ensemble clients</p>
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-3.5 py-2 text-sm font-medium text-white bg-white/10 border border-white/20 rounded-md hover:bg-white/20 disabled:opacity-50"
          >
            {importing ? 'Import en cours…' : '↻ Importer les clients Shopify'}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiTile label="Clients au total" value={String(dashboard?.totalClients ?? 0)} accent="cyan" />
          <KpiTile label="Chiffre d'affaires cumulé" value={formatCurrency(dashboard?.totalRevenue ?? 0)} accent="emerald" />
          <KpiTile label="Clients VIP" value={String(dashboard?.vipCount ?? 0)} accent="amber" />
          <KpiTile label="À risque" value={String(dashboard?.atRiskCount ?? 0)} accent="violet" />
          <KpiTile label="Perdus" value={String(dashboard?.lostCount ?? 0)} accent="rose" />
        </div>
      </div>

      <div className="p-6 flex-1 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[220px] max-w-md px-3.5 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
            {([
              { key: 'all', label: 'Tous' },
              { key: 'Vip', label: 'VIP' },
              { key: 'Regular', label: 'Régulier' },
              { key: 'AtRisk', label: 'À risque' },
              { key: 'Lost', label: 'Perdu' },
              { key: 'New', label: 'Nouveau' },
            ] as { key: SegmentFilter; label: string }[]).map((f) => (
              <button
                key={f.key}
                onClick={() => setSegmentFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  segmentFilter === f.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="spent">Trier: Total dépensé</option>
            <option value="orders">Trier: Nombre de commandes</option>
            <option value="recent">Trier: Commande récente</option>
            <option value="name">Trier: Nom</option>
          </select>
          <span className="text-xs text-slate-400 ml-auto">{filtered.length} client(s)</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-white border border-slate-200 rounded-lg">Aucun client</div>
        ) : (
          <>
            <div className="space-y-2">
              {paged.map((c) => {
                const spentPct = Math.round((c.totalSpent / maxSpent) * 100)
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className="group bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-4 cursor-pointer hover:border-emerald-300 hover:shadow-sm transition-all"
                  >
                    <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-500 flex-shrink-0">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0 ${SEGMENT_BADGE[c.segment]}`}>
                          {SEGMENT_LABELS[c.segment]}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0 ${CATEGORY_BADGE[c.loyaltyCategory]}`}
                          title="Catégorie de fidélité"
                        >
                          Fidélité : {CATEGORY_LABELS[c.loyaltyCategory]}
                        </span>
                        {c.isShopifyImported && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">Shopify</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{c.phone}{c.city ? ` · ${c.city}` : ''}{c.email ? ` · ${c.email}` : ''}{c.favoriteCategory ? ` · Aime : ${c.favoriteCategory}` : ''}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {clientHighlights(c).map((h) => (
                          <span key={h.label} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${h.className}`}>{h.label}</span>
                        ))}
                      </div>
                      <div className="mt-1.5 h-1.5 w-full max-w-xs bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" style={{ width: `${spentPct}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center gap-6 flex-shrink-0 text-right">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total dépensé</p>
                        <p className="text-sm font-semibold text-slate-900">{formatCurrency(c.totalSpent)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Commandes</p>
                        <p className="text-sm font-medium text-slate-700">{c.orderCount}</p>
                      </div>
                      <div className="hidden lg:block">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Dernière commande</p>
                        <p className="text-sm text-slate-500">{c.lastOrderAt ? formatDateTime(c.lastOrderAt) : '—'}</p>
                      </div>
                      {hasWhatsApp(c.phone) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openWhatsApp(c.phone, buildClientGreeting(c.name)) }}
                          title="Contacter sur WhatsApp"
                          className="w-9 h-9 flex items-center justify-center rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors flex-shrink-0"
                        >
                          <WhatsAppIcon />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {pageCount > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40">Précédent</button>
                <span className="text-sm text-slate-500 px-2">Page {currentPage} / {pageCount}</span>
                <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount} className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40">Suivant</button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedId !== null && (
        <ClientDetailModal clientId={selectedId} onClose={closeDetail} />
      )}
    </div>
  )
}

function KpiTile({ label, value, accent }: { label: string; value: string; accent: 'emerald' | 'cyan' | 'violet' | 'amber' | 'rose' }) {
  const ring = {
    emerald: 'from-emerald-400/20 to-emerald-400/0 ring-emerald-400/30',
    cyan: 'from-cyan-400/20 to-cyan-400/0 ring-cyan-400/30',
    violet: 'from-violet-400/20 to-violet-400/0 ring-violet-400/30',
    amber: 'from-amber-400/20 to-amber-400/0 ring-amber-400/30',
    rose: 'from-rose-400/20 to-rose-400/0 ring-rose-400/30',
  }[accent]

  return (
    <div className={`rounded-xl p-4 bg-gradient-to-br ${ring} ring-1 backdrop-blur-sm`}>
      <p className="text-[11px] font-medium text-slate-300 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-white mt-1 truncate">{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-[11px] text-slate-400 uppercase tracking-wide flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-700 text-right truncate">{value || '—'}</span>
    </div>
  )
}

function ClientDetailModal({ clientId, onClose }: { clientId: number; onClose: () => void }) {
  const [analytics, setAnalytics] = useState<ClientAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    crmApi.getAnalytics(clientId).then((data) => { if (!cancelled) setAnalytics(data) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [clientId])

  const maxCategoryAmount = useMemo(
    () => Math.max(1, ...(analytics?.categoryBreakdown.map((c) => c.amountSpent) ?? [])),
    [analytics],
  )

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[85vh] overflow-auto border border-slate-200">
        {loading || !analytics ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-start sticky top-0 bg-white z-10">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-slate-900">{analytics.summary.name}</h3>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${SEGMENT_BADGE[analytics.summary.segment]}`}>
                    {SEGMENT_LABELS[analytics.summary.segment]}
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${CATEGORY_BADGE[analytics.summary.loyaltyCategory]}`}>
                    Fidélité : {CATEGORY_LABELS[analytics.summary.loyaltyCategory]}
                  </span>
                  {clientHighlights(analytics.summary).map((h) => (
                    <span key={h.label} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${h.className}`}>{h.label}</span>
                  ))}
                </div>
                <p className="text-xs text-slate-500">{analytics.summary.phone}{analytics.summary.email ? ` · ${analytics.summary.email}` : ''}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {hasWhatsApp(analytics.summary.phone) && (
                  <button
                    onClick={() => openWhatsApp(analytics.summary.phone, buildClientGreeting(analytics.summary.name))}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-green-500 rounded-md hover:bg-green-600 transition-colors"
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                )}
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total dépensé</p>
                  <p className="text-lg font-semibold text-slate-900">{formatCurrency(analytics.summary.totalSpent)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Commandes</p>
                  <p className="text-lg font-semibold text-slate-900">{analytics.summary.orderCount}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Dernière commande</p>
                  <p className="text-sm font-medium text-slate-700">{analytics.summary.lastOrderAt ? formatDateTime(analytics.summary.lastOrderAt) : '—'}</p>
                </div>
              </div>

              {/* Contact & location details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm border border-slate-100 rounded-lg p-4">
                <InfoRow label="Téléphone" value={analytics.summary.phone} />
                <InfoRow label="Email" value={analytics.summary.email} />
                <InfoRow label="Ville" value={analytics.summary.city} />
                <InfoRow label="Adresse" value={analytics.summary.addressLine} />
                {analytics.summary.shopifyOrdersCount != null && (
                  <InfoRow label="Commandes Shopify (vie)" value={String(analytics.summary.shopifyOrdersCount)} />
                )}
                {analytics.summary.shopifyTotalSpent != null && (
                  <InfoRow label="Dépensé Shopify (vie)" value={formatCurrency(analytics.summary.shopifyTotalSpent)} />
                )}
                {analytics.summary.tags && (
                  <div className="md:col-span-2">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analytics.summary.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                        <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {analytics.categoryBreakdown.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">Catégories préférées</h4>
                  <div className="space-y-1.5">
                    {analytics.categoryBreakdown.slice(0, 6).map((cat) => (
                      <div key={cat.categoryName} className="flex items-center gap-3">
                        <span className="text-xs text-slate-600 w-32 truncate flex-shrink-0">{cat.categoryName}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" style={{ width: `${Math.round((cat.amountSpent / maxCategoryAmount) * 100)}%` }} />
                        </div>
                        <span className="text-xs font-medium text-slate-700 w-20 text-right flex-shrink-0">{formatCurrency(cat.amountSpent)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analytics.recommendations.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">Produits recommandés</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {analytics.recommendations.map((r) => (
                      <div key={r.productId} className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="w-full h-20 bg-slate-50 flex items-center justify-center">
                          {r.imageUrl ? (
                            <img src={r.imageUrl} alt={r.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-medium text-slate-900 truncate">{r.name}</p>
                          <p className="text-xs text-slate-500">{formatCurrency(r.price)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Historique d'achats</h4>
                <div className="space-y-1.5 max-h-64 overflow-auto">
                  {analytics.purchaseHistory.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-6">Aucun achat enregistré</p>
                  )}
                  {analytics.purchaseHistory.map((h, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm bg-slate-50 rounded px-3 py-2">
                      <div className="min-w-0">
                        <span className="font-medium text-slate-900 truncate">{h.productName}</span>
                        {(h.colorName || h.sizeValue) && (
                          <span className="text-slate-400 text-xs ml-2">{[h.colorName, h.sizeValue].filter(Boolean).join(' / ')}</span>
                        )}
                        <div className="text-xs text-slate-400">{h.source} · {h.orderReference} · {formatDateTime(h.date)}</div>
                      </div>
                      <span className="font-medium text-slate-900 flex-shrink-0 ml-3">{formatCurrency(h.lineTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
