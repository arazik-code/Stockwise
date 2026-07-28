import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/layout/Header'
import SaleDetail from '../components/sales/SaleDetail'
import { salesApi } from '../api/sales'
import { fournisseursApi } from '../api/fournisseurs'
import { formatCurrency, formatDate } from '../utils/format'
import { useTableSelection } from '../hooks/useTableSelection'
import { useCashOnHand } from '../hooks/useCashOnHand'
import { showToast } from '../components/shared/Toast'
import type { Sale, SalesReport } from '../types/sale'
import type { Fournisseur } from '../types/fournisseur'

type FilterPreset = 'today' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'custom'

function getDateRange(preset: FilterPreset, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (preset) {
    case 'today':
      return { from: startOfDay, to: new Date(startOfDay.getTime() + 86400000 - 1) }
    case 'thisWeek': {
      const day = startOfDay.getDay()
      const monday = new Date(startOfDay)
      monday.setDate(monday.getDate() - ((day + 6) % 7))
      const sunday = new Date(monday)
      sunday.setDate(sunday.getDate() + 7)
      return { from: monday, to: new Date(sunday.getTime() - 1) }
    }
    case 'thisMonth':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) }
    case 'thisYear':
      return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31, 23, 59, 59) }
    case 'custom': {
      const from = customFrom ? new Date(customFrom + 'T00:00:00') : startOfDay
      const to = customTo ? new Date(customTo + 'T23:59:59') : new Date(startOfDay.getTime() + 86400000 - 1)
      return { from, to }
    }
  }
}

const categoryColors: Record<string, string> = {
  VenteNormale: 'bg-blue-50 text-blue-700',
  VentePromotion: 'bg-amber-50 text-amber-700',
  Liquidation: 'bg-red-50 text-red-700',
  VenteEnGros: 'bg-green-50 text-green-700',
  VenteSpeciale: 'bg-purple-50 text-purple-700',
  Retour: 'bg-slate-100 text-slate-600',
  Echange: 'bg-cyan-50 text-cyan-700',
}

export default function SalesPage() {
  const { t } = useTranslation()
  const [report, setReport] = useState<SalesReport | null>(null)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('thisMonth')
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().split('T')[0])
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'daily'>('overview')
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [fournisseurId, setFournisseurId] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<string>('')
  const tableSelection = useTableSelection<Sale>()
  const cashOnHand = useCashOnHand()

  useEffect(() => {
    fournisseursApi.getAll().then(setFournisseurs).catch(() => {})
  }, [])

  const loadReport = async () => {
    setLoading(true)
    try {
      const { from, to } = getDateRange(filterPreset, customFrom, customTo)
      const data = await salesApi.getSalesReport(from.toISOString(), to.toISOString(), fournisseurId, categoryId || null)
      setReport(data)
    } catch (err) {
      console.error(err)
      showToast(t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadReport() }, [filterPreset, fournisseurId, categoryId])

  const filteredSales = useMemo(() => {
    if (!report) return []
    if (!search.trim()) return report.sales
    const q = search.toLowerCase()
    return report.sales.filter(
      (s) =>
        s.saleNumber.toLowerCase().includes(q) ||
        (s.clientName ?? '').toLowerCase().includes(q) ||
        (s.userName ?? '').toLowerCase().includes(q) ||
        s.channel.toLowerCase().includes(q)
    )
  }, [report, search])

  const handleBulkVoid = async () => {
    if (tableSelection.count === 0) return
    if (!window.confirm(t('sales.confirmBulkDelete', { count: tableSelection.count }))) return
    try {
      await salesApi.removeMany(Array.from(tableSelection.selected))
      await loadReport()
      showToast(t('sales.bulkDeleteSuccess', { count: tableSelection.count }), 'success')
      tableSelection.clear()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const tabs = [
    { key: 'overview', label: t('sales.summary.title') },
    { key: 'products', label: t('sales.products.title') },
    { key: 'daily', label: t('sales.daily.title') },
  ] as const

  return (
    <div className="flex flex-col flex-1 bg-slate-50">
      <Header title={t('sales.title')} />
      <div className="p-6 flex-1">
        {loading && !report ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* ── Filter Bar ───────────────────────────── */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                  {(['today', 'thisWeek', 'thisMonth', 'thisYear', 'custom'] as FilterPreset[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setFilterPreset(p)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        filterPreset === p ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t(`sales.filter.${p}`)}
                    </button>
                  ))}
                </div>

                {filterPreset === 'custom' && (
                  <div className="flex items-center gap-2 ml-2">
                    <label className="text-xs text-slate-500">{t('sales.filter.from')}</label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="px-2 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <label className="text-xs text-slate-500">{t('sales.filter.to')}</label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="px-2 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <button
                      onClick={loadReport}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      {t('sales.filter.apply')}
                    </button>
                  </div>
                )}

                <div className="ml-auto flex items-center gap-2">
                  <select
                    value={fournisseurId ?? ''}
                    onChange={(e) => setFournisseurId(e.target.value ? Number(e.target.value) : null)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Tous les fournisseurs</option>
                    {fournisseurs.map((f) => (
                      <option key={f.id} value={f.id}>{f.nom}</option>
                    ))}
                  </select>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Toutes les catégories</option>
                    <option value="VenteNormale">Vente Normale</option>
                    <option value="VentePromotion">Vente Promotion</option>
                    <option value="Liquidation">Liquidation</option>
                    <option value="VenteEnGros">Vente en Gros</option>
                    <option value="VenteSpeciale">Vente Spéciale</option>
                    <option value="Retour">Retour</option>
                    <option value="Echange">Échange</option>
                  </select>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('sales.searchPlaceholder')}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-md w-56 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {report && (
                <div className="mt-2 text-xs text-slate-400">
                  {formatDate(report.from)} — {formatDate(report.to)}
                </div>
              )}
            </div>

            {/* ── Summary Cards ────────────────────────── */}
            {report && (
              <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 ${cashOnHand.isAdmin ? 'lg:grid-cols-7' : 'lg:grid-cols-6'}`}>
                <StatCard label={t('sales.summary.totalRevenue')} value={formatCurrency(report.totalRevenue)} color="blue" />
                <StatCard label={t('sales.summary.totalSales')} value={report.totalSales.toString()} color="emerald" />
                <StatCard label={t('sales.summary.avgOrder')} value={formatCurrency(report.averageOrderValue)} color="violet" />
                <StatCard label={t('sales.summary.itemsSold')} value={report.totalItemsSold.toString()} color="amber" />
                <StatCard label={t('sales.summary.totalProfit')} value={formatCurrency(report.totalProfit)} color="green" />
                <StatCard label={t('sales.summary.totalDiscount')} value={formatCurrency(report.totalDiscount)} color="red" />
                {cashOnHand.isAdmin && (
                  <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-700 p-4 text-white">
                    <p className="text-xs font-medium text-slate-300 mb-1">Solde caisse</p>
                    {cashOnHand.loading ? (
                      <div className="h-5 w-16 bg-white/10 rounded animate-pulse" />
                    ) : (
                      <p className="text-lg font-bold tabular-nums">{formatCurrency(cashOnHand.balance ?? 0)}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Tabs ────────────────────────────────── */}
            {report && (
              <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 text-xs font-medium rounded-md transition-colors ${
                      activeTab === tab.key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {/* ── Tab: Overview (breakdowns) ───────────── */}
            {report && activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Payment Breakdown */}
                <div className="bg-white rounded-lg border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">{t('sales.breakdown.byPayment')}</h3>
                  <div className="space-y-3">
                    <BreakdownRow label={t('sales.breakdown.cash')} value={report.paymentBreakdown.cash} count={report.paymentBreakdown.cashCount} total={report.totalRevenue} color="bg-emerald-500" />
                    <BreakdownRow label={t('sales.breakdown.card')} value={report.paymentBreakdown.card} count={report.paymentBreakdown.cardCount} total={report.totalRevenue} color="bg-blue-500" />
                    <BreakdownRow label={t('sales.breakdown.online')} value={report.paymentBreakdown.online} count={report.paymentBreakdown.onlineCount} total={report.totalRevenue} color="bg-violet-500" />
                  </div>
                </div>

                {/* Channel Breakdown */}
                <div className="bg-white rounded-lg border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">{t('sales.breakdown.byChannel')}</h3>
                  <div className="space-y-3">
                    <BreakdownRow label={t('sales.breakdown.local')} value={report.channelBreakdown.local} count={report.channelBreakdown.localCount} total={report.totalRevenue} color="bg-blue-500" />
                    <BreakdownRow label={t('sales.breakdown.shopify')} value={report.channelBreakdown.shopify} count={report.channelBreakdown.shopifyCount} total={report.totalRevenue} color="bg-purple-500" />
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="bg-white rounded-lg border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">{t('sales.breakdown.byCategory')}</h3>
                  <div className="space-y-2">
                    {report.categoryBreakdown.map((cat) => (
                      <div key={cat.category} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded font-medium ${categoryColors[cat.category] || 'bg-slate-100 text-slate-600'}`}>
                            {t(`sales.categories.${cat.category.charAt(0).toLowerCase() + cat.category.slice(1)}`)}
                          </span>
                          <span className="text-slate-400">{cat.count}</span>
                        </div>
                        <span className="font-medium text-slate-700">{formatCurrency(cat.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Top Products ────────────────────── */}
            {report && activeTab === 'products' && (
              <div className="bg-white rounded-lg border border-slate-200 mb-6">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700">{t('sales.products.title')}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">#</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.products.product')}</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.products.sku')}</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.products.color')}</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.products.size')}</th>
                        <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.products.qtySold')}</th>
                        <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.products.revenue')}</th>
                        <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.products.cost')}</th>
                        <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.products.profit')}</th>
                        <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.products.avgPrice')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.topProducts.map((p, i) => (
                        <tr key={p.productVariantId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 text-xs text-slate-400">{i + 1}</td>
                          <td className="px-5 py-3 text-sm font-medium text-slate-900">{p.productName}</td>
                          <td className="px-5 py-3 text-xs font-mono text-slate-500">{p.sku}</td>
                          <td className="px-5 py-3 text-xs text-slate-600">{p.colorName}</td>
                          <td className="px-5 py-3 text-xs text-slate-600">{p.sizeValue}</td>
                          <td className="px-5 py-3 text-sm text-right font-medium text-slate-900">{p.quantitySold}</td>
                          <td className="px-5 py-3 text-sm text-right text-slate-700">{formatCurrency(p.revenue)}</td>
                          <td className="px-5 py-3 text-sm text-right text-slate-500">{formatCurrency(p.cost)}</td>
                          <td className={`px-5 py-3 text-sm text-right font-medium ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(p.profit)}
                          </td>
                          <td className="px-5 py-3 text-sm text-right text-slate-500">{formatCurrency(p.averageUnitPrice)}</td>
                        </tr>
                      ))}
                      {report.topProducts.length === 0 && (
                        <tr><td colSpan={10} className="px-5 py-8 text-center text-sm text-slate-400">{t('common.noData')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Tab: Daily Revenue ───────────────────── */}
            {report && activeTab === 'daily' && (
              <div className="bg-white rounded-lg border border-slate-200 mb-6">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700">{t('sales.daily.title')}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.daily.date')}</th>
                        <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.daily.salesCount')}</th>
                        <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.daily.revenue')}</th>
                        <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.daily.profit')}</th>
                        <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.daily.itemsSold')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.dailyRevenue.map((d) => (
                        <tr key={d.date} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 text-sm text-slate-700">{formatDate(d.date)}</td>
                          <td className="px-5 py-3 text-sm text-right text-slate-700">{d.salesCount}</td>
                          <td className="px-5 py-3 text-sm text-right font-medium text-slate-900">{formatCurrency(d.revenue)}</td>
                          <td className={`px-5 py-3 text-sm text-right font-medium ${d.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(d.profit)}
                          </td>
                          <td className="px-5 py-3 text-sm text-right text-slate-700">{d.itemsSold}</td>
                        </tr>
                      ))}
                      {report.dailyRevenue.length === 0 && (
                        <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">{t('common.noData')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Sales Table ──────────────────────────── */}
            {report && (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">
                    {t('sales.title')} ({filteredSales.length})
                  </h3>
                  {tableSelection.someSelected && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-blue-600 font-medium">{tableSelection.count} {t('sales.selected')}</span>
                      <button onClick={handleBulkVoid} className="text-xs font-medium text-amber-600 hover:text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 transition-colors">
                        {t('sales.void')}
                      </button>
                      <button onClick={tableSelection.clear} className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors">
                        {t('common.cancel')}
                      </button>
                    </div>
                  )}
                </div>

                {filteredSales.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-sm">
                    {search.trim() ? t('sales.noResults') : t('sales.noSales')}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="w-10 px-4 py-3">
                            <input
                              type="checkbox"
                              checked={tableSelection.allSelected(filteredSales)}
                              onChange={() => tableSelection.toggleAll(filteredSales)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.saleNumber')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.channel')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.category')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.payment')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.client')}</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.items')}</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.itemsSold')}</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('common.subtotal')}</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.summary.totalDiscount')}</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.summary.totalRevenue')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.cashier')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('sales.date')}</th>
                          <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSales.map((sale) => {
                          const totalQty = sale.items.reduce((sum, i) => sum + i.quantity, 0)
                          return (
                            <tr
                              key={sale.id}
                              className={`transition-colors ${
                                tableSelection.isSelected(sale.id) ? 'bg-blue-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={tableSelection.isSelected(sale.id)}
                                  onChange={() => tableSelection.toggle(sale.id)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm font-mono text-slate-600">{sale.saleNumber}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${sale.channel === 'Local' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                                  {sale.channel === 'Local' ? t('sales.channels.local') : t('sales.channels.shopify')}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${categoryColors[sale.category] || 'bg-slate-100 text-slate-600'}`}>
                                  {t(`sales.categories.${sale.category.charAt(0).toLowerCase() + sale.category.slice(1)}`)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600">
                                {t(`sales.payments.${sale.paymentMethod.toLowerCase()}`)}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600">{sale.clientName ?? '-'}</td>
                              <td className="px-4 py-3 text-xs text-right text-slate-600">{sale.items.length}</td>
                              <td className="px-4 py-3 text-sm text-right font-medium text-slate-900">{totalQty}</td>
                              <td className="px-4 py-3 text-xs text-right text-slate-600">{formatCurrency(sale.subTotal)}</td>
                              <td className="px-4 py-3 text-xs text-right text-slate-500">
                                {sale.discountAmount + sale.loyaltyDiscountAmount > 0
                                  ? `-${formatCurrency(sale.discountAmount + sale.loyaltyDiscountAmount)}`
                                  : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{formatCurrency(sale.totalAmount)}</td>
                              <td className="px-4 py-3 text-xs text-slate-600">{sale.userName ?? '-'}</td>
                              <td className="px-4 py-3 text-xs text-slate-400">{formatDate(sale.createdAt)}</td>
                              <td className="px-4 py-3 text-sm text-center">
                                <button
                                  onClick={() => setSelectedSale(sale)}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                >
                                  {t('sales.detail')}
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
          </>
        )}
      </div>

      {selectedSale && (
        <SaleDetail sale={selectedSale} onClose={() => setSelectedSale(null)} />
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    violet: 'bg-violet-50 border-violet-100 text-violet-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    green: 'bg-green-50 border-green-100 text-green-700',
    red: 'bg-red-50 border-red-100 text-red-700',
  }
  return (
    <div className={`rounded-lg border p-4 ${colorMap[color] || colorMap.blue}`}>
      <p className="text-xs font-medium opacity-75 mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}

function BreakdownRow({ label, value, count, total, color }: { label: string; value: number; count: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${color}`}></span>
          <span className="text-xs font-medium text-slate-700">{label}</span>
        </div>
        <span className="text-xs font-semibold text-slate-900">{formatCurrency(value)}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }}></div>
        </div>
        <span className="text-[10px] text-slate-400 w-16 text-right">{pct.toFixed(1)}% · {count}</span>
      </div>
    </div>
  )
}
