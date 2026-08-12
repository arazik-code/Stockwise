import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, Clock, LayoutDashboard, Package, RefreshCw,
  ShoppingCart, Users,
} from 'lucide-react'
import { onlineApi } from '../../api/online'
import { crmApi, type CrmAnalytics, type ClientSegment } from '../../api/clients'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { useSignalR } from '../../hooks/useSignalR'
import { WhatsAppConfirmMenu } from '../../components/shared/WhatsAppConfirmButton'
import {
  BarChart, BreakdownRow, Card, ChartFrame, DonutChart, Page, SkeletonCards,
  SkeletonStats, StatCard, StatusBadge,
} from '../../components/ui'
import type { OnlineDashboard } from '../../types/onlineOrder'

const CHANNEL_TONE_COLOR: Record<string, string> = {
  Manual: 'var(--neutral)',
  WhatsApp: 'var(--brand-whatsapp)',
  Shopify: 'var(--special)',
}

const SEGMENT_LABELS: Record<ClientSegment, string> = {
  Vip: 'VIP',
  Regular: 'Régulier',
  AtRisk: 'À risque',
  Lost: 'Perdu',
  New: 'Nouveau',
}

const SEGMENT_COLOR: Record<ClientSegment, string> = {
  Vip: 'var(--caution)',
  Regular: 'var(--neutral)',
  AtRisk: 'var(--negative)',
  Lost: 'var(--critical)',
  New: 'var(--progress)',
}

// Orders awaiting the customer's WhatsApp confirmation — the thing a shop owner actually needs to act on daily.
const NEEDS_CONFIRMATION_STATUSES = ['Pending', 'Processing']

const QUICK_NAV = [
  { label: 'Commandes', sub: 'Toutes les commandes', icon: ShoppingCart, to: '/online/orders' },
  { label: 'Produits', sub: 'Catalogue synchronisé', icon: Package, to: '/online/products' },
  { label: 'Clients', sub: 'Fiches clients', icon: Users, to: '/online/clients' },
  { label: 'CRM & Analytique', sub: 'Segments, démographie', icon: LayoutDashboard, to: '/online/crm' },
  { label: 'Synchronisation', sub: 'Conflits & état', icon: RefreshCw, to: '/online/sync' },
] as const

export default function OnlineDashboardPage() {
  const navigate = useNavigate()
  useSignalR()

  const [data, setData] = useState<OnlineDashboard | null>(null)
  const [crm, setCrm] = useState<CrmAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, c] = await Promise.all([onlineApi.getDashboard(), crmApi.getCrmAnalytics()])
      setData(d)
      setCrm(c)
    } finally {
      setLoading(false)
    }
  }, [])

  const reloadSilently = useCallback(async () => {
    try { setData(await onlineApi.getDashboard()) } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])

  // Live refresh on new orders / status changes (SignalR-driven).
  useEffect(() => {
    const h = () => reloadSilently()
    window.addEventListener('sms:orders-updated', h)
    return () => window.removeEventListener('sms:orders-updated', h)
  }, [reloadSilently])

  const maxCityCount = useMemo(() => Math.max(1, ...(crm?.cities.slice(0, 5).map((c) => c.clientCount) ?? [1])), [crm])
  const totalSegmentClients = useMemo(() => (crm?.segments.reduce((s, x) => s + x.count, 0) ?? 0) || 1, [crm])

  const needsConfirmation = useMemo(
    () => (data?.recentOrders ?? []).filter((o) => NEEDS_CONFIRMATION_STATUSES.includes(o.status)),
    [data],
  )

  return (
    <Page section="onlineDash" title="Tableau de Bord — Boutique en ligne">
      <div className="space-y-6">
        {loading ? (
          <>
            <SkeletonStats count={5} />
            <SkeletonCards count={3} />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <StatCard label="Revenu aujourd'hui" value={formatCurrency(data?.todayRevenue ?? 0)} sub={`${data?.todayOrders ?? 0} commande(s)`} tone="positive" />
              <StatCard label="Revenu ce mois" value={formatCurrency(data?.monthRevenue ?? 0)} sub={`${data?.monthOrders ?? 0} commande(s)`} tone="progress" />
              <StatCard label="Clients au total" value={String(crm?.totalClients ?? 0)} sub={`${crm?.shopifyImportedCount ?? 0} via Shopify`} tone="special" />
              <StatCard label="Panier moyen" value={formatCurrency(crm?.avgOrderValue ?? 0)} sub={`${crm?.totalOrders ?? 0} commandes au total`} tone="caution" />
              <StatCard label="À confirmer" value={String(needsConfirmation.length)} sub="Nécessitent une action" tone="negative" />
            </div>

            <div className="space-y-2">
              {(data?.conflictCount ?? 0) > 0 && (
                <button
                  onClick={() => navigate('/online/sync')}
                  data-tone="negative"
                  className="flex w-full items-center gap-3 rounded-surface border border-[color-mix(in_oklab,var(--tone)_28%,transparent)] bg-[var(--tone-soft)] px-5 py-3 text-left transition-colors hover:brightness-95"
                >
                  <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--tone)]" />
                  <span className="text-sm font-medium text-[var(--tone-ink)]">
                    {data?.conflictCount} commande(s) en conflit de stock — cliquez pour résoudre
                  </span>
                </button>
              )}
              {needsConfirmation.length > 0 && (
                <button
                  onClick={() => navigate('/online/orders')}
                  data-tone="caution"
                  className="flex w-full items-center gap-3 rounded-surface border border-[color-mix(in_oklab,var(--tone)_28%,transparent)] bg-[var(--tone-soft)] px-5 py-3 text-left transition-colors hover:brightness-95"
                >
                  <Clock className="h-5 w-5 shrink-0 text-[var(--tone)]" />
                  <span className="text-sm font-medium text-[var(--tone-ink)]">
                    {needsConfirmation.length} commande(s) en attente de confirmation client — cliquez pour les traiter
                  </span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ChartFrame
                  title="Commandes des 7 derniers jours"
                  subtitle="Revenu par jour"
                  height={220}
                  empty={!data?.ordersTrend || data.ordersTrend.length === 0}
                >
                  {(w) => (
                    <BarChart
                      width={w}
                      height={220}
                      format={formatCurrency}
                      data={(data?.ordersTrend ?? []).map((d) => ({ label: d.date, value: d.revenue }))}
                    />
                  )}
                </ChartFrame>
              </div>

              <Card>
                <h3 className="mb-1 text-sm font-semibold text-fg">Répartition par canal</h3>
                <p className="mb-4 text-xs text-fg-subtle">Ce mois</p>
                {data?.channelBreakdown && data.channelBreakdown.length > 0 ? (
                  <DonutChart
                    size={140}
                    thickness={16}
                    data={data.channelBreakdown.map((c) => ({
                      value: c.count,
                      color: CHANNEL_TONE_COLOR[c.channel] ?? 'var(--neutral)',
                      label: c.channel,
                    }))}
                  />
                ) : (
                  <p className="py-4 text-center text-sm text-fg-subtle">Aucune donnée</p>
                )}
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <MiniCard title="Segments clients" onSeeAll={() => navigate('/online/crm')}>
                {crm && crm.segments.length > 0 ? (
                  <div className="space-y-2.5">
                    {crm.segments.map((s) => (
                      <BreakdownRow
                        key={s.segment}
                        label={SEGMENT_LABELS[s.segment]}
                        value={s.count}
                        total={totalSegmentClients}
                        color={SEGMENT_COLOR[s.segment]}
                      />
                    ))}
                  </div>
                ) : <EmptyMini />}
              </MiniCard>

              <MiniCard title={`Top villes (${crm?.distinctCities ?? 0})`} onSeeAll={() => navigate('/online/crm')}>
                {crm && crm.cities.length > 0 ? (
                  <div className="space-y-2">
                    {crm.cities.slice(0, 5).map((c) => (
                      <BreakdownRow
                        key={c.city}
                        label={c.city}
                        value={c.clientCount}
                        total={maxCityCount}
                        color="var(--special)"
                      />
                    ))}
                  </div>
                ) : <EmptyMini />}
              </MiniCard>

              <MiniCard title="Produits populaires" onSeeAll={() => navigate('/online/crm')}>
                {crm && crm.topProducts.length > 0 ? (
                  <div className="space-y-2">
                    {crm.topProducts.slice(0, 5).map((p, idx) => (
                      <div key={p.productId} className="flex items-center gap-2.5">
                        <span
                          data-tone={idx === 0 ? 'caution' : 'neutral'}
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-chip bg-[var(--tone)] text-[9px] font-bold text-white"
                        >
                          {idx + 1}
                        </span>
                        <span className="flex-1 truncate text-xs text-fg-muted">{p.name}</span>
                        <span className="num shrink-0 text-[11px] font-medium text-fg-subtle">{formatCurrency(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                ) : <EmptyMini />}
              </MiniCard>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {QUICK_NAV.map((item) => (
                <button
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className="group surface-glass border-l-2 border-l-[var(--accent)] p-4 text-left transition-shadow hover:shadow-e3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-[var(--accent-soft)] text-[var(--accent)] transition-transform group-hover:scale-110">
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-fg">{item.label}</p>
                      <p className="truncate text-[11px] text-fg-subtle">{item.sub}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <Card padded={false}>
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-fg">Commandes récentes</h3>
                  <p className="mt-0.5 text-xs text-fg-subtle">Toutes canaux confondus</p>
                </div>
                <button
                  onClick={() => navigate('/online/orders')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
                >
                  Voir tout
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="divide-y divide-border">
                {(data?.recentOrders ?? []).map((order) => (
                  <div key={order.id} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-surface-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        style={{ backgroundColor: CHANNEL_TONE_COLOR[order.channel] ?? 'var(--neutral)' }}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field text-[10px] font-bold text-white"
                      >
                        {order.channel.slice(0, 3).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">{order.orderNumber} — {order.customerName}</p>
                        <p className="text-[11px] text-fg-subtle">{formatDateTime(order.createdAt)}{order.city ? ` · ${order.city}` : ''}</p>
                      </div>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <p className="num text-sm font-semibold text-fg">{formatCurrency(order.totalAmount)}</p>
                        <StatusBadge domain="onlineOrder" value={order.status} animate={false} showIcon={false} size="xs" />
                      </div>
                      {NEEDS_CONFIRMATION_STATUSES.includes(order.status) && (
                        <WhatsAppConfirmMenu order={order} compact />
                      )}
                    </div>
                  </div>
                ))}
                {(!data?.recentOrders || data.recentOrders.length === 0) && (
                  <div className="px-5 py-8 text-center text-sm text-fg-subtle">Aucune commande récente</div>
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </Page>
  )
}

function MiniCard({ title, onSeeAll, children }: { title: string; onSeeAll: () => void; children: React.ReactNode }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        <button onClick={onSeeAll} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]">
          Voir tout
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      {children}
    </Card>
  )
}

function EmptyMini() {
  return <p className="py-6 text-center text-xs text-fg-subtle">Aucune donnée pour le moment</p>
}
