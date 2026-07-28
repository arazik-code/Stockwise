import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Header from '../components/layout/Header'
import { reportsApi } from '../api/reports'
import { stockApi } from '../api/stock'
import { salesApi } from '../api/sales'
import { clientsApi } from '../api/clients'
import { fournisseursApi } from '../api/fournisseurs'
import { formatCurrency, formatDateTime } from '../utils/format'
import { useCashOnHand } from '../hooks/useCashOnHand'
import type { DashboardData } from '../types/report'
import type { StockItem } from '../types/stock'
import type { Sale } from '../types/sale'
import type { TopProductItem } from '../types/report'

function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

const paymentMeta: Record<string, { label: string; color: string; icon: string }> = {
  Cash: { label: 'Especes', color: '#10b981', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  Card: { label: 'Carte', color: '#6366f1', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  Online: { label: 'En ligne', color: '#f59e0b', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9' },
}

const categoryMeta: Record<string, { label: string; color: string }> = {
  VenteNormale: { label: 'Vente Normale', color: '#3b82f6' },
  VentePromotion: { label: 'Promotion', color: '#8b5cf6' },
  Liquidation: { label: 'Liquidation', color: '#ef4444' },
  VenteEnGros: { label: 'En Gros', color: '#f59e0b' },
  VenteSpeciale: { label: 'Speciale', color: '#10b981' },
  Retour: { label: 'Retour', color: '#6b7280' },
  Echange: { label: 'Echange', color: '#06b6d4' },
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const now = useNow()

  const [data, setData] = useState<DashboardData | null>(null)
  const [lowStock, setLowStock] = useState<StockItem[]>([])
  const [recentSales, setRecentSales] = useState<Sale[]>([])
  const [topProducts, setTopProducts] = useState<TopProductItem[]>([])
  const [clientCount, setClientCount] = useState(0)
  const [fournisseurCount, setFournisseurCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const cashOnHand = useCashOnHand()

  useEffect(() => {
    Promise.all([
      reportsApi.getDashboard().catch(() => null),
      stockApi.getLowStock().catch(() => []),
      salesApi.getAll().catch(() => []),
      reportsApi.getTopProducts(undefined, undefined, 8).catch(() => []),
      clientsApi.getAll().catch(() => []),
      fournisseursApi.getAll().catch(() => []),
    ]).then(([d, ls, s, tp, cl, fr]) => {
      setData(d)
      setLowStock(ls)
      setRecentSales(s.slice(0, 8))
      setTopProducts(tp)
      setClientCount(Array.isArray(cl) ? cl.length : 0)
      setFournisseurCount(Array.isArray(fr) ? fr.length : 0)
    }).finally(() => setLoading(false))
  }, [])

  const maxTrendRevenue = useMemo(
    () => Math.max(...(data?.salesTrend?.map((x) => x.revenue) ?? [1]), 1),
    [data?.salesTrend]
  )
  const totalCategoryRevenue = useMemo(
    () => data?.categoryBreakdown?.reduce((s, c) => s + c.revenue, 0) ?? 1,
    [data?.categoryBreakdown]
  )
  const totalPaymentCount = useMemo(
    () => data?.paymentBreakdown?.reduce((s, p) => s + p.count, 0) ?? 1,
    [data?.paymentBreakdown]
  )

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <Header title={t('dashboard.title')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500 mt-4">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <Header title={t('dashboard.title')} />
      <div className="flex-1 overflow-auto">

        {/* ── HERO STRIP ── */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                {t('dashboard.title')}
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigate('/pos')} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                {t('dashboard.openPOS')}
              </button>
              <button onClick={() => navigate('/reports')} className="px-4 py-2 text-sm font-medium text-slate-300 bg-white/10 rounded-lg hover:bg-white/15 transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                {t('nav.reports')}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-[1400px] mx-auto p-6 space-y-6">

          {/* ── KPI GRID ── */}
          <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 ${cashOnHand.isAdmin ? 'xl:grid-cols-7' : 'xl:grid-cols-6'}`}>
            {cashOnHand.isAdmin && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-700 rounded-xl p-4 text-white hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-8a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">Solde caisse</p>
                {cashOnHand.loading ? (
                  <div className="h-6 w-20 bg-white/10 rounded animate-pulse mt-1.5" />
                ) : (
                  <p className="text-xl font-bold mt-1 tabular-nums">{formatCurrency(cashOnHand.balance ?? 0)}</p>
                )}
                <p className="text-[11px] text-slate-400 mt-1 truncate">Especes en caisse</p>
              </div>
            )}
            <KPICard
              label={t('dashboard.todaySales')}
              value={`${data?.todaySales ?? 0}`}
              sub={`${data?.weekSales ?? 0} cette semaine`}
              color="blue"
              icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
            <KPICard
              label={t('dashboard.todayRevenue')}
              value={formatCurrency(data?.todayRevenue ?? 0)}
              sub={`Panier: ${formatCurrency(data?.todayAvgOrderValue ?? 0)}`}
              color="emerald"
              icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
            <KPICard
              label={t('dashboard.lowStock')}
              value={`${data?.lowStockCount ?? 0}`}
              sub={`${data?.totalStockUnits ?? 0} unites en stock`}
              color="amber"
              icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
            <KPICard
              label="Ce mois"
              value={`${data?.monthSales ?? 0}`}
              sub={formatCurrency(data?.monthRevenue ?? 0)}
              color="violet"
              icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
            <KPICard
              label="Clients"
              value={`${clientCount}`}
              sub="fiche(s)"
              color="cyan"
              icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <KPICard
              label="Fournisseurs"
              value={`${fournisseurCount}`}
              sub="partenaire(s)"
              color="rose"
              icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </div>

          {/* ── SALES TREND + PAYMENT BREAKDOWN ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Trend */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Ventes des 7 derniers jours</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Revenu par jour</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Revenu</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-200" /> Ventes</span>
                </div>
              </div>
              <div className="relative h-52">
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="border-b border-slate-100 w-full" />
                  ))}
                </div>
                {/* Bars */}
                <div className="absolute inset-0 flex items-end gap-3 px-1">
                  {(data?.salesTrend ?? []).map((day, i) => {
                    const h = maxTrendRevenue > 0 ? (day.revenue / maxTrendRevenue) * 100 : 0
                    const barCount = day.count
                    const maxCount = Math.max(...(data?.salesTrend?.map((d) => d.count) ?? [1]), 1)
                    const countH = (barCount / maxCount) * 100
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="absolute -top-10 hidden group-hover:block bg-slate-800 text-white text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap z-10 shadow-lg">
                          <span className="font-semibold">{day.count}</span> ventes
                          <span className="mx-1.5 text-slate-400">|</span>
                          <span className="font-semibold">{formatCurrency(day.revenue)}</span>
                        </div>
                        <div className="w-full flex items-end justify-center gap-1" style={{ height: '100%' }}>
                          <div
                            className="w-full max-w-[28px] bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md transition-all duration-500 hover:from-blue-700 hover:to-blue-500"
                            style={{ height: `${Math.max(h, 3)}%` }}
                          />
                          <div
                            className="w-full max-w-[28px] bg-blue-200 rounded-t-md transition-all duration-500 hover:bg-blue-300"
                            style={{ height: `${Math.max(countH, 3)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1.5 font-medium">{day.date}</span>
                      </div>
                    )
                  })}
                  {(!data?.salesTrend || data.salesTrend.length === 0) && (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-400 h-full">Aucune donnee</div>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Donut */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Modes de paiement</h3>
              <p className="text-xs text-slate-400 mb-4">Repartition par methode</p>
              <div className="flex justify-center mb-5">
                <DonutChart
                  data={(data?.paymentBreakdown ?? []).map((p) => ({
                    value: p.count,
                    color: paymentMeta[p.method]?.color ?? '#94a3b8',
                    label: p.method,
                  }))}
                  size={140}
                  thickness={16}
                />
              </div>
              <div className="space-y-3">
                {(data?.paymentBreakdown ?? []).map((pm) => {
                  const pct = totalPaymentCount > 0 ? (pm.count / totalPaymentCount) * 100 : 0
                  const meta = paymentMeta[pm.method]
                  return (
                    <div key={pm.method} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: meta?.color ?? '#94a3b8' }} />
                        <div>
                          <span className="text-sm font-medium text-slate-700">{meta?.label ?? pm.method}</span>
                          <span className="text-xs text-slate-400 ml-1.5">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-slate-900">{pm.count}</span>
                        <span className="text-[11px] text-slate-400 block">{formatCurrency(pm.revenue)}</span>
                      </div>
                    </div>
                  )
                })}
                {(!data?.paymentBreakdown || data.paymentBreakdown.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-4">Aucune donnee</p>
                )}
              </div>
            </div>
          </div>

          {/* ── CATEGORY BREAKDOWN + TOP PRODUCTS ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Categories */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Ventes par categorie</h3>
              <p className="text-xs text-slate-400 mb-4">Revenu par type de vente</p>
              <div className="space-y-3.5">
                {(data?.categoryBreakdown ?? []).map((cat) => {
                  const pct = totalCategoryRevenue > 0 ? (cat.revenue / totalCategoryRevenue) * 100 : 0
                  const meta = categoryMeta[cat.category]
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta?.color ?? '#94a3b8' }} />
                          <span className="text-sm text-slate-700 font-medium">{meta?.label ?? cat.category}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: meta?.color ?? '#94a3b8' }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[11px] text-slate-400">{cat.count} vente(s)</span>
                        <span className="text-[11px] text-slate-500 font-medium">{formatCurrency(cat.revenue)}</span>
                      </div>
                    </div>
                  )
                })}
                {(!data?.categoryBreakdown || data.categoryBreakdown.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-4">Aucune donnee</p>
                )}
              </div>
            </div>

            {/* Top Products */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Produits les plus vendus</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Top 8 par quantite</p>
                </div>
                <button onClick={() => navigate('/reports')} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                  Voir tout &rarr;
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                      <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Produit</th>
                      <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Couleur / Taille</th>
                      <th className="text-right px-5 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Qte</th>
                      <th className="text-right px-5 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Revenu</th>
                      <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-28">Barre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {topProducts.map((p, i) => {
                      const maxQty = Math.max(...topProducts.map((x) => x.quantitySold), 1)
                      const pct = (p.quantitySold / maxQty) * 100
                      return (
                        <tr key={p.productVariantId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                              i === 0 ? 'bg-amber-100 text-amber-700' :
                              i === 1 ? 'bg-slate-200 text-slate-600' :
                              i === 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-50 text-slate-400'
                            }`}>
                              {i + 1}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-medium text-slate-900">{p.productName}</td>
                          <td className="px-5 py-3 text-slate-500 text-xs">{p.colorName} / {p.sizeValue}</td>
                          <td className="px-5 py-3 text-right font-semibold text-slate-900 tabular-nums">{p.quantitySold}</td>
                          <td className="px-5 py-3 text-right font-medium text-slate-700 tabular-nums">{formatCurrency(p.revenue)}</td>
                          <td className="px-5 py-3">
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {topProducts.length === 0 && (
                      <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">Aucun produit vendu</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── RECENT SALES + LOW STOCK ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Sales */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{t('dashboard.recentSales')}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Dernieres transactions</p>
                </div>
                <button onClick={() => navigate('/sales')} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                  Voir tout &rarr;
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {recentSales.slice(0, 6).map((sale) => (
                  <div key={sale.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 ${
                        sale.paymentMethod === 'Cash' ? 'bg-emerald-500' :
                        sale.paymentMethod === 'Card' ? 'bg-indigo-500' : 'bg-amber-500'
                      }`}>
                        {sale.saleNumber.slice(-3)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{sale.saleNumber}</p>
                        <p className="text-[11px] text-slate-400">{formatDateTime(sale.createdAt)}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-sm font-semibold text-slate-900 tabular-nums">{formatCurrency(sale.totalAmount)}</p>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          sale.channel === 'Local' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                        }`}>
                          {sale.channel}
                        </span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          sale.paymentMethod === 'Cash' ? 'bg-emerald-50 text-emerald-700' :
                          sale.paymentMethod === 'Card' ? 'bg-indigo-50 text-indigo-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {paymentMeta[sale.paymentMethod]?.label ?? sale.paymentMethod}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {recentSales.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-slate-400">Aucune vente recente</div>
                )}
              </div>
            </div>

            {/* Low Stock */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{t('dashboard.lowStockAlerts')}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Articles sous le seuil</p>
                </div>
                <div className="flex items-center gap-2">
                  {lowStock.length > 0 && (
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{lowStock.length}</span>
                  )}
                  <button onClick={() => navigate('/stock')} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                    Voir tout &rarr;
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {lowStock.slice(0, 6).map((item) => (
                  <div key={item.productVariantId} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                        item.quantityOnHand === 0 ? 'bg-red-100 text-red-700' :
                        item.quantityOnHand <= 3 ? 'bg-red-50 text-red-600' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {item.quantityOnHand}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{item.productName}</p>
                        <p className="text-[11px] text-slate-400 truncate">{item.colorName} / {item.sizeValue}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.quantityOnHand === 0 ? 'bg-red-500' :
                              item.quantityOnHand <= 3 ? 'bg-red-400' : 'bg-amber-400'
                            }`}
                            style={{ width: `${Math.min((item.quantityOnHand / Math.max(item.reorderLevel, 1)) * 100, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-semibold tabular-nums ${
                          item.quantityOnHand === 0 ? 'text-red-600' :
                          item.quantityOnHand <= 3 ? 'text-red-500' : 'text-amber-600'
                        }`}>
                          {item.quantityOnHand}/{item.reorderLevel}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {lowStock.length === 0 && (
                  <div className="px-5 py-8 text-center">
                    <svg className="w-8 h-8 text-emerald-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <p className="text-sm text-slate-500 font-medium">Tout est en stock</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── QUICK NAV CARDS ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickNavCard label="Produits" sub={`${data?.totalProducts ?? 0} produit(s)`} color="blue" onClick={() => navigate('/products')}
              icon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            <QuickNavCard label="Stock" sub={`${data?.totalVariants ?? 0} variante(s)`} color="amber" onClick={() => navigate('/stock')}
              icon="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            <QuickNavCard label="Factures" sub="Fournisseurs" color="violet" onClick={() => navigate('/invoices')}
              icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            <QuickNavCard label="Remboursements" sub="Echanges" color="rose" onClick={() => navigate('/refunds')}
              icon="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
          </div>

        </div>
      </div>
    </div>
  )
}

/* ═══════════ SUB-COMPONENTS ═══════════ */

function KPICard({ label, value, sub, color, icon }: {
  label: string; value: string; sub: string; color: string; icon: string
}) {
  const bg: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    rose: 'bg-rose-50 text-rose-600',
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg[color] ?? 'bg-slate-50 text-slate-600'}`}>
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} /></svg>
        </div>
      </div>
      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
      <p className="text-[11px] text-slate-400 mt-1 truncate">{sub}</p>
    </div>
  )
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
    amber: 'border-l-amber-500',
    violet: 'border-l-violet-500',
    rose: 'border-l-rose-500',
  }
  const iconBg: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
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
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="text-[11px] text-slate-400">{sub}</p>
        </div>
      </div>
    </button>
  )
}
