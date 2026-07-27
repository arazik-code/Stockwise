import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/layout/Header'
import { reportsApi } from '../api/reports'
import { salesApi } from '../api/sales'
import { fournisseursApi } from '../api/fournisseurs'
import { formatCurrency } from '../utils/format'
import type { InventoryReportItem, SalesByChannelItem, TopProductItem } from '../types/report'
import type { DailySalesReport } from '../types/sale'
import type { Fournisseur } from '../types/fournisseur'

type Tab = 'overview' | 'sales' | 'inventory' | 'products' | 'fournisseurs'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)

  const [dailyReport, setDailyReport] = useState<DailySalesReport | null>(null)
  const [inventory, setInventory] = useState<InventoryReportItem[]>([])
  const [channelSales, setChannelSales] = useState<SalesByChannelItem[]>([])
  const [topProducts, setTopProducts] = useState<TopProductItem[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])

  const today = new Date().toISOString().split('T')[0]
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [daily, inv, channel, top, fourn] = await Promise.all([
        salesApi.getDailyReport(dateFrom),
        reportsApi.getInventory(),
        reportsApi.getSalesByChannel(dateFrom, dateTo),
        reportsApi.getTopProducts(dateFrom, dateTo, 10),
        fournisseursApi.getAll(),
      ])
      setDailyReport(daily)
      setInventory(inv)
      setChannelSales(channel)
      setTopProducts(top)
      setFournisseurs(fourn)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const handleExport = async (type: string, _label: string) => {
    setExporting(type)
    try {
      let res
      let filename = ''
      const dateStr = new Date().toISOString().split('T')[0]
      switch (type) {
        case 'pdf-stock':
          res = await reportsApi.downloadStockPdf(dateFrom, dateTo)
          filename = `rapport-stock-${dateStr}.pdf`
          break
        case 'csv-stock':
          res = await reportsApi.downloadStockCsv()
          filename = `inventaire-${dateStr}.csv`
          break
        case 'pdf-sales':
          res = await reportsApi.downloadSalesPdf(dateFrom, dateTo)
          filename = `rapport-ventes-${dateStr}.pdf`
          break
        case 'csv-sales':
          res = await reportsApi.downloadSalesCsv(dateFrom, dateTo)
          filename = `ventes-${dateStr}.csv`
          break
        case 'pdf-fournisseurs':
          res = await reportsApi.downloadFournisseursPdf()
          filename = `rapport-fournisseurs-${dateStr}.pdf`
          break
        case 'csv-fournisseurs':
          res = await reportsApi.downloadFournisseursCsv()
          filename = `fournisseurs-${dateStr}.csv`
          break
        case 'pdf-products':
          res = await reportsApi.downloadProductsPdf(dateFrom, dateTo)
          filename = `rapport-produits-${dateStr}.pdf`
          break
        case 'csv-products':
          res = await reportsApi.downloadProductsCsv()
          filename = `produits-${dateStr}.csv`
          break
        case 'pdf-dashboard':
          res = await reportsApi.downloadDashboardPdf(dateFrom, dateTo)
          filename = `rapport-dashboard-${dateStr}.pdf`
          break
        default:
          return
      }
      if (res?.data) downloadBlob(res.data, filename)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(null)
    }
  }

  const totalRevenue = useMemo(() => channelSales.reduce((s, c) => s + c.totalRevenue, 0), [channelSales])
  const totalTransactions = useMemo(() => channelSales.reduce((s, c) => s + c.totalSales, 0), [channelSales])
  const lowStockItems = useMemo(() => inventory.filter((i) => i.isLowStock), [inventory])
  const totalStockValue = useMemo(() => inventory.reduce((s, i) => s + i.quantityOnHand, 0), [inventory])
  const categoriesCount = useMemo(() => new Set(inventory.map((i) => i.category)).size, [inventory])

  const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

  const channelColors: Record<string, string> = {
    Local: 'bg-blue-500',
    Shopify: 'bg-purple-500',
  }

  const channelLabels: Record<string, string> = {
    Local: 'En magasin',
    Shopify: 'Shopify',
  }

  const maxRevenue = Math.max(...channelSales.map((c) => c.totalRevenue), 1)

  // ─── Export buttons component ─────────────────────────
  const ExportButtons = ({ types }: { types: { type: string; label: string; icon: string }[] }) => (
    <div className="flex items-center gap-2">
      {types.map((ex) => (
        <button
          key={ex.type}
          onClick={() => handleExport(ex.type, ex.label)}
          disabled={exporting !== null}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors"
        >
          {exporting === ex.type ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <span>{ex.icon === 'pdf' ? (
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}</span>
          )}
          {ex.label}
        </button>
      ))}
    </div>
  )

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'overview',
      label: t('reports.overview'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      key: 'sales',
      label: t('reports.sales'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      key: 'inventory',
      label: t('reports.inventory'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
    },
    {
      key: 'products',
      label: t('reports.products'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      key: 'fournisseurs',
      label: t('reports.fournisseurs'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
  ]

  return (
    <div className="flex flex-col flex-1">
      <Header title={t('reports.title')} />
      <div className="p-6 flex-1 space-y-6">

        {/* Tabs + Date Range + Export */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-400 text-sm">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Export bar per tab */}
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-5 py-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-slate-700">{t('reports.exportData')}</span>
          </div>
          {activeTab === 'overview' && (
            <ExportButtons types={[{ type: 'pdf-dashboard', label: 'PDF', icon: 'pdf' }]} />
          )}
          {activeTab === 'sales' && (
            <ExportButtons types={[
              { type: 'pdf-sales', label: 'PDF', icon: 'pdf' },
              { type: 'csv-sales', label: 'CSV', icon: 'csv' },
            ]} />
          )}
          {activeTab === 'inventory' && (
            <ExportButtons types={[
              { type: 'pdf-stock', label: 'PDF', icon: 'pdf' },
              { type: 'csv-stock', label: 'CSV', icon: 'csv' },
            ]} />
          )}
          {activeTab === 'products' && (
            <ExportButtons types={[
              { type: 'pdf-products', label: 'PDF', icon: 'pdf' },
              { type: 'csv-products', label: 'CSV', icon: 'csv' },
            ]} />
          )}
          {activeTab === 'fournisseurs' && (
            <ExportButtons types={[
              { type: 'pdf-fournisseurs', label: 'PDF', icon: 'pdf' },
              { type: 'csv-fournisseurs', label: 'CSV', icon: 'csv' },
            ]} />
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
            <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {t('common.loading')}
          </div>
        ) : (
          <>
            {/* ═══ OVERVIEW TAB ═══ */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-lg p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-400 uppercase">{t('reports.totalSales')}</p>
                        <p className="text-2xl font-bold text-slate-900">{totalTransactions}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-400 uppercase">{t('reports.totalRevenue')}</p>
                        <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-400 uppercase">{t('reports.avgOrderValue')}</p>
                        <p className="text-2xl font-bold text-slate-900">{formatCurrency(avgOrderValue)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
                        <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-400 uppercase">{t('reports.lowStock')}</p>
                        <p className="text-2xl font-bold text-slate-900">{lowStockItems.length}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Channel breakdown + Low stock */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-slate-200 rounded-lg p-5">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">{t('reports.salesByChannel')}</h3>
                    {channelSales.length === 0 ? (
                      <p className="text-sm text-slate-400 py-8 text-center">{t('reports.noData')}</p>
                    ) : (
                      <div className="space-y-4">
                        {channelSales.map((ch) => {
                          const pct = totalRevenue > 0 ? (ch.totalRevenue / totalRevenue * 100).toFixed(1) : '0'
                          return (
                            <div key={ch.channel}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2.5 h-2.5 rounded-full ${channelColors[ch.channel] || 'bg-slate-400'}`} />
                                  <span className="text-sm font-medium text-slate-700">{channelLabels[ch.channel] || ch.channel}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(ch.totalRevenue)}</span>
                                  <span className="text-xs text-slate-400 ml-2">{pct}%</span>
                                </div>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${channelColors[ch.channel] || 'bg-slate-400'}`}
                                  style={{ width: `${(ch.totalRevenue / maxRevenue) * 100}%` }}
                                />
                              </div>
                              <p className="text-xs text-slate-400 mt-1">{ch.totalSales} ventes</p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-slate-900">{t('reports.lowStockItems')}</h3>
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{lowStockItems.length}</span>
                    </div>
                    {lowStockItems.length === 0 ? (
                      <p className="text-sm text-slate-400 py-8 text-center">{t('reports.noData')}</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {lowStockItems.slice(0, 8).map((item) => (
                          <div key={item.productVariantId} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{item.productName}</p>
                              <p className="text-xs text-slate-400">{item.colorName} / {item.sizeValue} — {item.sku}</p>
                            </div>
                            <div className="text-right ml-4">
                              <p className={`text-sm font-bold ${item.quantityOnHand === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                                {item.quantityOnHand}
                              </p>
                              <p className="text-xs text-slate-400">Seuil: {item.reorderLevel}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ SALES TAB ═══ */}
            {activeTab === 'sales' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-lg p-4 border-l-4 border-l-blue-500">
                    <p className="text-xs font-medium text-slate-400 uppercase">{t('reports.totalSales')}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{dailyReport?.totalSales ?? 0}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 border-l-4 border-l-emerald-500">
                    <p className="text-xs font-medium text-slate-400 uppercase">{t('reports.totalRevenue')}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(dailyReport?.totalRevenue ?? 0)}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 border-l-4 border-l-slate-400">
                    <p className="text-xs font-medium text-slate-400 uppercase">{t('reports.totalTax')}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(dailyReport?.totalTax ?? 0)}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 border-l-4 border-l-amber-500">
                    <p className="text-xs font-medium text-slate-400 uppercase">{t('reports.avgOrderValue')}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(avgOrderValue)}</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">Ventes par mode de paiement</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: t('reports.cashSales'), value: dailyReport?.cashSales ?? 0, color: 'emerald' },
                      { label: t('reports.cardSales'), value: dailyReport?.cardSales ?? 0, color: 'blue' },
                      { label: t('reports.onlineSales'), value: dailyReport?.onlineSales ?? 0, color: 'purple' },
                    ].map((pm) => {
                      const total = (dailyReport?.cashSales ?? 0) + (dailyReport?.cardSales ?? 0) + (dailyReport?.onlineSales ?? 0)
                      const pct = total > 0 ? (pm.value / total * 100).toFixed(1) : '0'
                      return (
                        <div key={pm.label} className="text-center p-4 bg-slate-50 rounded-lg">
                          <p className="text-xs font-medium text-slate-500 uppercase mb-2">{pm.label}</p>
                          <p className="text-xl font-bold text-slate-900">{formatCurrency(pm.value)}</p>
                          <p className="text-xs text-slate-400 mt-1">{pct}%</p>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full mt-3 overflow-hidden">
                            <div className={`h-full rounded-full bg-${pm.color}-500`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">{t('reports.salesByChannel')}</h3>
                  {channelSales.length === 0 ? (
                    <p className="text-sm text-slate-400 py-8 text-center">{t('reports.noData')}</p>
                  ) : (
                    <div className="space-y-4">
                      {channelSales.map((ch) => {
                        const pct = totalRevenue > 0 ? (ch.totalRevenue / totalRevenue * 100).toFixed(1) : '0'
                        return (
                          <div key={ch.channel} className="flex items-center gap-4">
                            <div className="w-24 shrink-0">
                              <span className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${channelColors[ch.channel] || 'bg-slate-400'}`} />
                                <span className="text-sm font-medium text-slate-700">{channelLabels[ch.channel] || ch.channel}</span>
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="w-full h-6 bg-slate-100 rounded-md overflow-hidden relative">
                                <div
                                  className={`h-full rounded-md transition-all ${channelColors[ch.channel] || 'bg-slate-400'}`}
                                  style={{ width: `${pct}%` }}
                                />
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-slate-700">
                                  {formatCurrency(ch.totalRevenue)} ({pct}%)
                                </span>
                              </div>
                            </div>
                            <span className="text-sm text-slate-500 w-20 text-right">{ch.totalSales} ventes</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ INVENTORY TAB ═══ */}
            {activeTab === 'inventory' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <p className="text-xs font-medium text-slate-400 uppercase">{t('reports.productsCount')}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{inventory.length}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <p className="text-xs font-medium text-slate-400 uppercase">{t('reports.categoriesCount')}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{categoriesCount}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <p className="text-xs font-medium text-slate-400 uppercase">{t('reports.stockValue')}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{totalStockValue} unités</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <p className="text-xs font-medium text-slate-400 uppercase">{t('reports.lowStockItems')}</p>
                    <p className="text-2xl font-bold text-amber-600 mt-1">{lowStockItems.length}</p>
                  </div>
                </div>

                {(() => {
                  const byCategory = inventory.reduce<Record<string, { total: number; low: number; products: number }>>((acc, item) => {
                    if (!acc[item.category]) acc[item.category] = { total: 0, low: 0, products: 0 }
                    acc[item.category].total += item.quantityOnHand
                    acc[item.category].products++
                    if (item.isLowStock) acc[item.category].low++
                    return acc
                  }, {})
                  const cats = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total)
                  const maxCat = Math.max(...cats.map(([, v]) => v.total), 1)

                  return (
                    <div className="bg-white border border-slate-200 rounded-lg p-5">
                      <h3 className="text-sm font-semibold text-slate-900 mb-4">{t('reports.stockByCategory')}</h3>
                      <div className="space-y-3">
                        {cats.map(([cat, data]) => (
                          <div key={cat} className="flex items-center gap-4">
                            <div className="w-32 shrink-0">
                              <p className="text-sm font-medium text-slate-700 truncate">{cat}</p>
                              <p className="text-xs text-slate-400">{data.products} produits</p>
                            </div>
                            <div className="flex-1">
                              <div className="w-full h-5 bg-slate-100 rounded-md overflow-hidden relative">
                                <div
                                  className="h-full bg-blue-500 rounded-md transition-all"
                                  style={{ width: `${(data.total / maxCat) * 100}%` }}
                                />
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-slate-700">
                                  {data.total} unités
                                </span>
                              </div>
                            </div>
                            {data.low > 0 && (
                              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                                {data.low} faible
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900">{t('reports.inventory')} complet</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('reports.product')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('products.color')} / {t('products.size')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('reports.sku')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('reports.category')}</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('reports.quantityOnHand')}</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('reports.quantityReserved')}</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('reports.reorderLevel')}</th>
                          <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">État</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inventory.map((item) => (
                          <tr key={item.productVariantId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.productName}</td>
                            <td className="px-4 py-3 text-sm text-slate-500">{item.colorName} / {item.sizeValue}</td>
                            <td className="px-4 py-3 text-sm text-slate-500">{item.sku}</td>
                            <td className="px-4 py-3 text-sm text-slate-500">{item.category}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-slate-900">{item.quantityOnHand}</td>
                            <td className="px-4 py-3 text-sm text-right text-slate-500">{item.quantityReserved}</td>
                            <td className="px-4 py-3 text-sm text-right text-slate-500">{item.reorderLevel}</td>
                            <td className="px-4 py-3 text-center">
                              {item.quantityOnHand === 0 ? (
                                <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Rupture</span>
                              ) : item.isLowStock ? (
                                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{t('reports.lowStock')}</span>
                              ) : (
                                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">En stock</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ PRODUCTS TAB ═══ */}
            {activeTab === 'products' && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900">{t('reports.topProducts')}</h3>
                  </div>
                  {topProducts.length === 0 ? (
                    <p className="text-sm text-slate-400 py-12 text-center">{t('reports.noData')}</p>
                  ) : (
                    <>
                      <div className="p-5 space-y-3">
                        {topProducts.slice(0, 5).map((p, i) => {
                          const maxQty = topProducts[0]?.quantitySold || 1
                          const pct = (p.quantitySold / maxQty) * 100
                          const medals = ['🥇', '🥈', '🥉', '4.', '5.']
                          return (
                            <div key={p.productVariantId} className="flex items-center gap-3">
                              <span className="w-6 text-center text-sm">{medals[i]}</span>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-slate-700">{p.productName}</span>
                                  <span className="text-sm font-semibold text-slate-900">{p.quantitySold} vendus · {formatCurrency(p.revenue)}</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="overflow-x-auto border-t border-slate-100">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">#</th>
                              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('reports.product')}</th>
                              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('reports.quantitySold')}</th>
                              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">{t('reports.revenue')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {topProducts.map((p, i) => (
                              <tr key={p.productVariantId} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-sm text-slate-400 font-medium">{i + 1}</td>
                                <td className="px-4 py-3 text-sm font-medium text-slate-900">{p.productName}</td>
                                <td className="px-4 py-3 text-sm text-right text-slate-600">{p.quantitySold}</td>
                                <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{formatCurrency(p.revenue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ═══ FOURNISSEURS TAB ═══ */}
            {activeTab === 'fournisseurs' && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-lg p-4 border-l-4 border-l-blue-500">
                    <p className="text-xs font-medium text-slate-400 uppercase">Total Fournisseurs</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{fournisseurs.length}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 border-l-4 border-l-emerald-500">
                    <p className="text-xs font-medium text-slate-400 uppercase">Avec Produits</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{fournisseurs.filter(f => f.produitsCount > 0).length}</p>
                  </div>
                </div>

                {/* Fournisseurs Table */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900">Liste des Fournisseurs</h3>
                  </div>
                  {fournisseurs.length === 0 ? (
                    <p className="text-sm text-slate-400 py-12 text-center">{t('reports.noData')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Nom</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Contact</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Email</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Téléphone</th>
                            <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Produits</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {fournisseurs.map((f) => (
                            <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-sm font-medium text-slate-900">{f.nom}</td>
                              <td className="px-4 py-3 text-sm text-slate-500">{f.contact || '—'}</td>
                              <td className="px-4 py-3 text-sm text-slate-500">{f.email || '—'}</td>
                              <td className="px-4 py-3 text-sm text-slate-500">{f.telephone || '—'}</td>
                              <td className="px-4 py-3 text-sm text-center text-slate-600">{f.produitsCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
