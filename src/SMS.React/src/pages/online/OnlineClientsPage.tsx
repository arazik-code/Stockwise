import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, ImageOff, RefreshCw, Search, Sparkles, Users, Wallet, XCircle } from 'lucide-react'
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
import {
  Avatar, Badge, BreakdownRow, Button, Card, EmptyState, IconButton, Input, Modal, Page,
  Pagination, Select, Skeleton, Spinner, StatCard, StatusBadge, Tabs, Tooltip,
} from '../../components/ui'

const WhatsAppIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

type SegmentFilter = 'all' | ClientSegment
type SortKey = 'spent' | 'orders' | 'recent' | 'name'

const PAGE_SIZE = 25

interface Highlight { label: string; tone: 'special' | 'caution' | 'positive' | 'neutral' }

// Compact, at-a-glance insight chips derived from a client's numbers.
function clientHighlights(c: ClientCrmSummary): Highlight[] {
  const h: Highlight[] = []
  if (c.orderCount >= 4) h.push({ label: `🔁 ${c.orderCount} commandes`, tone: 'special' })
  else if (c.orderCount >= 2) h.push({ label: 'Fidèle', tone: 'special' })
  if (c.totalSpent >= 2500) h.push({ label: '💎 Gros acheteur', tone: 'caution' })
  if (c.daysSinceLastOrder != null && c.daysSinceLastOrder <= 30) h.push({ label: '🔥 Actif', tone: 'positive' })
  if (c.daysSinceLastOrder != null && c.daysSinceLastOrder > 180 && c.orderCount > 0) h.push({ label: '⏰ À relancer', tone: 'caution' })
  if (c.orderCount === 0) h.push({ label: 'Sans achat', tone: 'neutral' })
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
    <Page
      section="onlineClients"
      title="Clients — CRM en ligne"
      actions={
        <Button
          variant="outline"
          icon={<RefreshCw className="h-4 w-4" />}
          loading={importing}
          disabled={importing}
          onClick={handleImport}
        >
          {importing ? 'Import en cours…' : 'Importer les clients Shopify'}
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard label="Clients au total" numericValue={dashboard?.totalClients ?? 0} icon={Users} tone="info" loading={loading} />
          <StatCard label="Chiffre d'affaires cumulé" value={formatCurrency(dashboard?.totalRevenue ?? 0)} icon={Wallet} tone="positive" loading={loading} />
          <StatCard label="Clients VIP" numericValue={dashboard?.vipCount ?? 0} icon={Sparkles} tone="caution" loading={loading} />
          <StatCard label="À risque" numericValue={dashboard?.atRiskCount ?? 0} icon={AlertTriangle} tone="critical" loading={loading} />
          <StatCard label="Perdus" numericValue={dashboard?.lostCount ?? 0} icon={XCircle} tone="negative" loading={loading} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, téléphone ou email..."
            leading={<Search />}
            wrapperClassName="min-w-[220px] max-w-md flex-1"
          />
          <Tabs
            variant="segmented"
            layoutGroupId="online-clients-segment"
            value={segmentFilter}
            onChange={(v) => setSegmentFilter(v as SegmentFilter)}
            items={[
              { value: 'all', label: 'Tous' },
              { value: 'Vip', label: 'VIP' },
              { value: 'Regular', label: 'Régulier' },
              { value: 'AtRisk', label: 'À risque' },
              { value: 'Lost', label: 'Perdu' },
              { value: 'New', label: 'Nouveau' },
            ]}
          />
          <Select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            wrapperClassName="w-auto"
          >
            <option value="spent">Trier: Total dépensé</option>
            <option value="orders">Trier: Nombre de commandes</option>
            <option value="recent">Trier: Commande récente</option>
            <option value="name">Trier: Nom</option>
          </Select>
          <span className="num ml-auto text-xs text-fg-subtle">{filtered.length} client(s)</span>
        </div>

        {loading ? (
          <div className="space-y-2" role="status" aria-label="Chargement">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="surface-glass flex items-center gap-4 p-3">
                <Skeleton variant="circle" className="h-11 w-11" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton variant="text" width="30%" />
                  <Skeleton variant="text" width="50%" />
                </div>
                <Skeleton className="h-8" width="90px" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Aucun client" />
        ) : (
          <>
            <div className="space-y-2">
              {paged.map((c) => {
                const spentPct = Math.round((c.totalSpent / maxSpent) * 100)
                return (
                  <Card
                    key={c.id}
                    interactive
                    onClick={() => setSelectedId(c.id)}
                    className="flex items-center gap-4 p-3"
                  >
                    <Avatar name={c.name} size="md" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-fg">{c.name}</p>
                        <StatusBadge domain="rfmSegment" value={c.segment} size="xs" animate={false} showIcon={false} />
                        <Tooltip content="Catégorie de fidélité">
                          <span>
                            <StatusBadge domain="clientTier" value={c.loyaltyCategory} size="xs" animate={false} />
                          </span>
                        </Tooltip>
                        {c.isShopifyImported && (
                          <Badge tone="positive" size="xs">Shopify</Badge>
                        )}
                      </div>
                      <p className="text-xs text-fg-subtle">{c.phone}{c.city ? ` · ${c.city}` : ''}{c.email ? ` · ${c.email}` : ''}{c.favoriteCategory ? ` · Aime : ${c.favoriteCategory}` : ''}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {clientHighlights(c).map((h) => (
                          <span key={h.label} data-tone={h.tone} className="rounded-chip bg-[var(--tone-soft)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--tone-ink)]">{h.label}</span>
                        ))}
                      </div>
                      <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-chip bg-sunken">
                        <div className="h-full rounded-chip bg-[var(--accent)]" style={{ width: `${spentPct}%` }} />
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-6 text-right">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-fg-subtle">Total dépensé</p>
                        <p className="num text-sm font-semibold text-fg">{formatCurrency(c.totalSpent)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-fg-subtle">Commandes</p>
                        <p className="num text-sm font-medium text-fg-muted">{c.orderCount}</p>
                      </div>
                      <div className="hidden lg:block">
                        <p className="text-[10px] uppercase tracking-wide text-fg-subtle">Dernière commande</p>
                        <p className="text-sm text-fg-subtle">{c.lastOrderAt ? formatDateTime(c.lastOrderAt) : '—'}</p>
                      </div>
                      {hasWhatsApp(c.phone) && (
                        <IconButton
                          icon={<WhatsAppIcon className="h-4 w-4" />}
                          label="Contacter sur WhatsApp"
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-whatsapp-ink hover:bg-whatsapp-soft"
                          onClick={(e) => { e.stopPropagation(); openWhatsApp(c.phone, buildClientGreeting(c.name)) }}
                        />
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>

            {pageCount > 1 && (
              <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
            )}
          </>
        )}
      </div>

      {selectedId !== null && (
        <ClientDetailModal clientId={selectedId} onClose={closeDetail} />
      )}
    </Page>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="flex-shrink-0 text-[11px] uppercase tracking-wide text-fg-subtle">{label}</span>
      <span className="truncate text-right text-sm text-fg-muted">{value || '—'}</span>
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
    <Modal
      open
      onClose={onClose}
      size="2xl"
      bodyClassName="px-0 py-0"
      title={
        analytics && (
          <div className="flex flex-wrap items-center gap-2">
            <span>{analytics.summary.name}</span>
            <StatusBadge domain="rfmSegment" value={analytics.summary.segment} size="xs" animate={false} showIcon={false} />
            <Tooltip content="Catégorie de fidélité">
              <span>
                <StatusBadge domain="clientTier" value={analytics.summary.loyaltyCategory} size="xs" animate={false} />
              </span>
            </Tooltip>
            {clientHighlights(analytics.summary).map((h) => (
              <span key={h.label} data-tone={h.tone} className="rounded-chip bg-[var(--tone-soft)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--tone-ink)]">{h.label}</span>
            ))}
          </div>
        )
      }
      description={analytics ? `${analytics.summary.phone}${analytics.summary.email ? ` · ${analytics.summary.email}` : ''}` : undefined}
      footer={
        analytics && hasWhatsApp(analytics.summary.phone) ? (
          <Button
            variant="success"
            icon={<WhatsAppIcon className="h-4 w-4" />}
            onClick={() => openWhatsApp(analytics.summary.phone, buildClientGreeting(analytics.summary.name))}
          >
            WhatsApp
          </Button>
        ) : undefined
      }
    >
      {loading || !analytics ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-6 px-5 py-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-card bg-sunken p-3">
              <p className="text-[10px] uppercase tracking-wide text-fg-subtle">Total dépensé</p>
              <p className="num text-lg font-semibold text-fg">{formatCurrency(analytics.summary.totalSpent)}</p>
            </div>
            <div className="rounded-card bg-sunken p-3">
              <p className="text-[10px] uppercase tracking-wide text-fg-subtle">Commandes</p>
              <p className="num text-lg font-semibold text-fg">{analytics.summary.orderCount}</p>
            </div>
            <div className="rounded-card bg-sunken p-3">
              <p className="text-[10px] uppercase tracking-wide text-fg-subtle">Dernière commande</p>
              <p className="text-sm font-medium text-fg-muted">{analytics.summary.lastOrderAt ? formatDateTime(analytics.summary.lastOrderAt) : '—'}</p>
            </div>
          </div>

          {/* Contact & location details */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-card border border-border p-4 text-sm md:grid-cols-2">
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
                <p className="mb-1 text-[10px] uppercase tracking-wide text-fg-subtle">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {analytics.summary.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                    <Badge key={t} tone="special" size="sm">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {analytics.categoryBreakdown.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-fg">Catégories préférées</h4>
              <div className="space-y-3">
                {analytics.categoryBreakdown.slice(0, 6).map((cat) => (
                  <BreakdownRow
                    key={cat.categoryName}
                    label={cat.categoryName}
                    value={cat.amountSpent}
                    total={maxCategoryAmount}
                    format={formatCurrency}
                  />
                ))}
              </div>
            </div>
          )}

          {analytics.recommendations.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-fg">Produits recommandés</h4>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {analytics.recommendations.map((r) => (
                  <div key={r.productId} className="overflow-hidden rounded-card border border-border">
                    <div className="flex h-20 w-full items-center justify-center bg-sunken">
                      {r.imageUrl ? (
                        <img src={r.imageUrl} alt={r.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <ImageOff className="h-6 w-6 text-fg-subtle" aria-hidden="true" />
                      )}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs font-medium text-fg">{r.name}</p>
                      <p className="num text-xs text-fg-subtle">{formatCurrency(r.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-semibold text-fg">Historique d'achats</h4>
            {analytics.purchaseHistory.length === 0 ? (
              <EmptyState compact title="Aucun achat enregistré" />
            ) : (
              <div className="max-h-64 space-y-1.5 overflow-auto">
                {analytics.purchaseHistory.map((h, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-inset bg-sunken px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="truncate font-medium text-fg">{h.productName}</span>
                      {(h.colorName || h.sizeValue) && (
                        <span className="ml-2 text-xs text-fg-subtle">{[h.colorName, h.sizeValue].filter(Boolean).join(' / ')}</span>
                      )}
                      <div className="text-xs text-fg-subtle">{h.source} · {h.orderReference} · {formatDateTime(h.date)}</div>
                    </div>
                    <span className="num ml-3 flex-shrink-0 font-medium text-fg">{formatCurrency(h.lineTotal)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
