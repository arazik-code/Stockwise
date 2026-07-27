import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/layout/Header'
import { onlineApi } from '../../api/online'
import { crmApi, type CrmAnalytics, type ClientSegment } from '../../api/clients'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { useSignalR } from '../../hooks/useSignalR'
import { WhatsAppConfirmMenu } from '../../components/shared/WhatsAppConfirmButton'
import type { OnlineDashboard } from '../../types/onlineOrder'

const CHANNEL_COLORS: Record<string, string> = {
  Manual: '#64748b',
  WhatsApp: '#14b8a6',
  Shopify: '#10b981',
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  Pending: { label: 'En attente', className: 'bg-amber-50 text-amber-700' },
  Processing: { label: 'En traitement', className: 'bg-sky-50 text-sky-700' },
  Confirmed: { label: 'Confirmée', className: 'bg-blue-50 text-blue-700' },
  Packing: { label: 'Emballage', className: 'bg-violet-50 text-violet-700' },
  ReadyToShip: { label: 'Prête', className: 'bg-cyan-50 text-cyan-700' },
  Shipped: { label: 'Expédiée', className: 'bg-indigo-50 text-indigo-700' },
  Delivered: { label: 'Livrée', className: 'bg-emerald-50 text-emerald-700' },
  Cancelled: { label: 'Annulée', className: 'bg-slate-100 text-slate-500' },
  Refunded: { label: 'Remboursée', className: 'bg-rose-50 text-rose-700' },
  InventoryConflict: { label: 'Conflit stock', className: 'bg-red-50 text-red-700' },
}

const SEGMENT_LABELS: Record<ClientSegment, string> = {
  Vip: 'VIP',
  Regular: 'Régulier',
  AtRisk: 'À risque',
  Lost: 'Perdu',
  New: 'Nouveau',
}

const SEGMENT_COLOR: Record<ClientSegment, string> = {
  Vip: 'bg-amber-500',
  Regular: 'bg-slate-400',
  AtRisk: 'bg-orange-500',
  Lost: 'bg-red-500',
  New: 'bg-cyan-500',
}

// Orders awaiting the customer's WhatsApp confirmation — the thing a shop owner actually needs to act on daily.
const NEEDS_CONFIRMATION_STATUSES = ['Pending', 'Processing']

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

  const maxTrendRevenue = Math.max(...(data?.ordersTrend?.map((x) => x.revenue) ?? [1]), 1)
  const maxCityCount = useMemo(() => Math.max(1, ...(crm?.cities.slice(0, 5).map((c) => c.clientCount) ?? [1])), [crm])
  const totalSegmentClients = useMemo(() => (crm?.segments.reduce((s, x) => s + x.count, 0) ?? 0) || 1, [crm])

  const needsConfirmation = useMemo(
    () => (data?.recentOrders ?? []).filter((o) => NEEDS_CONFIRMATION_STATUSES.includes(o.status)),
    [data],
  )

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <Header title="Tableau de Bord — Boutique en ligne" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Header title="Tableau de Bord — Boutique en ligne" />
      <div className="flex-1 overflow-y-auto">

        {/* Hero KPI band — matches the CRM/Clients/Produits pages' visual language */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 px-6 py-6">
          <p className="text-xs font-medium text-slate-300 uppercase tracking-wide mb-4">Vue d'ensemble en temps réel</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KpiTile label="Revenu aujourd'hui" value={formatCurrency(data?.todayRevenue ?? 0)} sub={`${data?.todayOrders ?? 0} commande(s)`} accent="emerald" />
            <KpiTile label="Revenu ce mois" value={formatCurrency(data?.monthRevenue ?? 0)} sub={`${data?.monthOrders ?? 0} commande(s)`} accent="cyan" />
            <KpiTile label="Clients au total" value={String(crm?.totalClients ?? 0)} sub={`${crm?.shopifyImportedCount ?? 0} via Shopify`} accent="violet" />
            <KpiTile label="Panier moyen" value={formatCurrency(crm?.avgOrderValue ?? 0)} sub={`${crm?.totalOrders ?? 0} commandes au total`} accent="amber" />
            <KpiTile label="À confirmer" value={String(needsConfirmation.length)} sub="Nécessitent une action" accent="rose" />
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Alerts */}
          <div className="space-y-2">
            {(data?.conflictCount ?? 0) > 0 && (
              <button
                onClick={() => navigate('/online/sync')}
                className="w-full flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-left hover:bg-red-100 transition-colors"
              >
                <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span className="text-sm font-medium text-red-700">{data?.conflictCount} commande(s) en conflit de stock — cliquez pour résoudre</span>
              </button>
            )}
            {needsConfirmation.length > 0 && (
              <button
                onClick={() => navigate('/online/orders')}
                className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-left hover:bg-amber-100 transition-colors"
              >
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                <span className="text-sm font-medium text-amber-700">{needsConfirmation.length} commande(s) en attente de confirmation client — cliquez pour les traiter</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trend */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Commandes des 7 derniers jours</h3>
              <p className="text-xs text-slate-400 mb-4">Revenu par jour</p>
              <div className="relative h-52">
                <div className="absolute inset-0 flex items-end gap-3 px-1">
                  {(data?.ordersTrend ?? []).map((day, i) => {
                    const h = maxTrendRevenue > 0 ? (day.revenue / maxTrendRevenue) * 100 : 0
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="absolute -top-10 hidden group-hover:block bg-slate-800 text-white text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap z-10 shadow-lg">
                          <span className="font-semibold">{day.count}</span> commandes
                          <span className="mx-1.5 text-slate-400">|</span>
                          <span className="font-semibold">{formatCurrency(day.revenue)}</span>
                        </div>
                        <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
                          <div
                            className="w-full max-w-[28px] bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md transition-all duration-500 hover:from-emerald-700 hover:to-emerald-500"
                            style={{ height: `${Math.max(h, 3)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1.5 font-medium">{day.date}</span>
                      </div>
                    )
                  })}
                  {(!data?.ordersTrend || data.ordersTrend.length === 0) && (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-400 h-full">Aucune donnée</div>
                  )}
                </div>
              </div>
            </div>

            {/* Channel donut */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Répartition par canal</h3>
              <p className="text-xs text-slate-400 mb-4">Ce mois</p>
              <div className="flex justify-center mb-5">
                <DonutChart
                  data={(data?.channelBreakdown ?? []).map((c) => ({
                    value: c.count,
                    color: CHANNEL_COLORS[c.channel] ?? '#94a3b8',
                    label: c.channel,
                  }))}
                  size={140}
                  thickness={16}
                />
              </div>
              <div className="space-y-3">
                {(data?.channelBreakdown ?? []).map((c) => (
                  <div key={c.channel} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHANNEL_COLORS[c.channel] ?? '#94a3b8' }} />
                      <span className="text-sm font-medium text-slate-700">{c.channel}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-slate-900">{c.count}</span>
                      <span className="text-[11px] text-slate-400 block">{formatCurrency(c.revenue)}</span>
                    </div>
                  </div>
                ))}
                {(!data?.channelBreakdown || data.channelBreakdown.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-4">Aucune donnée</p>
                )}
              </div>
            </div>
          </div>

          {/* CRM snapshot — segments, top cities, top products */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <MiniCard title="Segments clients" onSeeAll={() => navigate('/online/crm')}>
              {crm && crm.segments.length > 0 ? (
                <div className="space-y-2.5">
                  {crm.segments.map((s) => {
                    const pct = Math.round((s.count / totalSegmentClients) * 100)
                    return (
                      <div key={s.segment}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">{SEGMENT_LABELS[s.segment]}</span>
                          <span className="text-slate-500">{s.count}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${SEGMENT_COLOR[s.segment]} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : <EmptyMini />}
            </MiniCard>

            <MiniCard title={`Top villes (${crm?.distinctCities ?? 0})`} onSeeAll={() => navigate('/online/crm')}>
              {crm && crm.cities.length > 0 ? (
                <div className="space-y-2">
                  {crm.cities.slice(0, 5).map((c) => (
                    <div key={c.city} className="flex items-center gap-2.5">
                      <span className="text-xs text-slate-600 w-20 truncate flex-shrink-0">{c.city}</span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full" style={{ width: `${Math.round((c.clientCount / maxCityCount) * 100)}%` }} />
                      </div>
                      <span className="text-[11px] font-medium text-slate-700 flex-shrink-0">{c.clientCount}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyMini />}
            </MiniCard>

            <MiniCard title="Produits populaires" onSeeAll={() => navigate('/online/crm')}>
              {crm && crm.topProducts.length > 0 ? (
                <div className="space-y-2">
                  {crm.topProducts.slice(0, 5).map((p, idx) => (
                    <div key={p.productId} className="flex items-center gap-2.5">
                      <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0 text-white ${
                        idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-orange-700' : 'bg-slate-300'
                      }`}>{idx + 1}</span>
                      <span className="text-xs text-slate-700 truncate flex-1">{p.name}</span>
                      <span className="text-[11px] font-medium text-slate-500 flex-shrink-0">{formatCurrency(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyMini />}
            </MiniCard>
          </div>

          {/* Quick nav */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <QuickNavCard label="Commandes" sub="Toutes les commandes" color="emerald" onClick={() => navigate('/online/orders')} icon="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 11H4L5 9z" />
            <QuickNavCard label="Produits" sub="Catalogue synchronisé" color="blue" onClick={() => navigate('/online/products')} icon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            <QuickNavCard label="Clients" sub="Fiches clients" color="cyan" onClick={() => navigate('/online/clients')} icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            <QuickNavCard label="CRM & Analytique" sub="Segments, démographie" color="violet" onClick={() => navigate('/online/crm')} icon="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <QuickNavCard label="Synchronisation" sub="Conflits & état" color="rose" onClick={() => navigate('/online/sync')} icon="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </div>

          {/* Recent orders */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Commandes récentes</h3>
                <p className="text-xs text-slate-400 mt-0.5">Toutes canaux confondus</p>
              </div>
              <button onClick={() => navigate('/online/orders')} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium transition-colors">
                Voir tout &rarr;
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {(data?.recentOrders ?? []).map((order) => {
                const meta = STATUS_META[order.status] ?? { label: order.status, className: 'bg-slate-100 text-slate-500' }
                return (
                  <div key={order.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ backgroundColor: CHANNEL_COLORS[order.channel] ?? '#94a3b8' }}
                      >
                        {order.channel.slice(0, 3).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{order.orderNumber} — {order.customerName}</p>
                        <p className="text-[11px] text-slate-400">{formatDateTime(order.createdAt)}{order.city ? ` · ${order.city}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900 tabular-nums">{formatCurrency(order.totalAmount)}</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${meta.className}`}>{meta.label}</span>
                      </div>
                      {NEEDS_CONFIRMATION_STATUSES.includes(order.status) && (
                        <WhatsAppConfirmMenu order={order} compact />
                      )}
                    </div>
                  </div>
                )
              })}
              {(!data?.recentOrders || data.recentOrders.length === 0) && (
                <div className="px-5 py-8 text-center text-sm text-slate-400">Aucune commande récente</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiTile({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent: 'emerald' | 'cyan' | 'violet' | 'amber' | 'rose'
}) {
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
      {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

function MiniCard({ title, onSeeAll, children }: { title: string; onSeeAll: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <button onClick={onSeeAll} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium transition-colors">Voir tout &rarr;</button>
      </div>
      {children}
    </div>
  )
}

function EmptyMini() {
  return <p className="text-xs text-slate-400 text-center py-6">Aucune donnée pour le moment</p>
}

function DonutChart({ data, size = 120, thickness = 14 }: {
  data: { value: number; color: string; label: string }[]; size?: number; thickness?: number
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div style={{ width: size, height: size }} className="rounded-full bg-slate-100" />
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  let acc = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((d) => {
        const pct = d.value / total
        const dash = circ * pct
        const gap = circ - dash
        const offset = -acc * circ + circ * 0.25
        acc += pct
        return (
          <circle
            key={d.label}
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={d.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
            className="transition-all duration-700"
          />
        )
      })}
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-slate-900 text-base font-bold">
        {total}
      </text>
    </svg>
  )
}

function QuickNavCard({ label, sub, color, onClick, icon }: {
  label: string; sub: string; color: string; onClick: () => void; icon: string
}) {
  const border: Record<string, string> = {
    blue: 'border-l-blue-500',
    cyan: 'border-l-cyan-500',
    emerald: 'border-l-emerald-500',
    violet: 'border-l-violet-500',
    rose: 'border-l-rose-500',
  }
  const iconBg: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    rose: 'bg-rose-50 text-rose-600',
  }
  return (
    <button
      onClick={onClick}
      className={`bg-white border border-slate-200 border-l-4 ${border[color] ?? 'border-l-slate-500'} rounded-xl p-4 text-left hover:shadow-sm transition-all group`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg[color] ?? 'bg-slate-50 text-slate-600'} group-hover:scale-110 transition-transform`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} /></svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{label}</p>
          <p className="text-[11px] text-slate-400 truncate">{sub}</p>
        </div>
      </div>
    </button>
  )
}
