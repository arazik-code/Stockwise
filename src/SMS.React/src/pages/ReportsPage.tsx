import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Boxes, DollarSign, Download, FileSpreadsheet, FileText, Grid3x3,
  LayoutGrid, Package, ShoppingCart, TrendingUp, Truck,
} from 'lucide-react'
import { reportsApi } from '../api/reports'
import { salesApi } from '../api/sales'
import { fournisseursApi } from '../api/fournisseurs'
import { formatCurrency } from '../utils/format'
import {
  Badge, BreakdownRow, Button, Card, DataTable, Input, Page, shouldVirtualize, SkeletonStats,
  SkeletonTable, StatCard, StatusBadge, Tabs, VirtualTable, type Column,
} from '../components/ui'
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

const CHANNEL_COLOR: Record<string, string> = {
  Local: 'var(--info)',
  Shopify: 'var(--special)',
}

const CHANNEL_LABEL: Record<string, string> = {
  Local: 'En magasin',
  Shopify: 'Shopify',
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

  // ─── Export buttons ─────────────────────────
  const ExportButtons = ({ types }: { types: { type: string; label: string; icon: 'pdf' | 'csv' }[] }) => (
    <div className="flex items-center gap-2">
      {types.map((ex) => (
        <Button
          key={ex.type}
          size="sm"
          variant="outline"
          disabled={exporting !== null}
          loading={exporting === ex.type}
          icon={ex.icon === 'pdf' ? <FileText className="h-4 w-4 text-[var(--negative)]" /> : <FileSpreadsheet className="h-4 w-4 text-[var(--positive)]" />}
          onClick={() => handleExport(ex.type, ex.label)}
        >
          {ex.label}
        </Button>
      ))}
    </div>
  )

  const tabs: { key: Tab; label: string; icon: typeof LayoutGrid }[] = [
    { key: 'overview', label: t('reports.overview'), icon: LayoutGrid },
    { key: 'sales', label: t('reports.sales'), icon: ShoppingCart },
    { key: 'inventory', label: t('reports.inventory'), icon: Boxes },
    { key: 'products', label: t('reports.products'), icon: Package },
    { key: 'fournisseurs', label: t('reports.fournisseurs'), icon: Truck },
  ]

  const inventoryColumns: Column<InventoryReportItem>[] = [
    { key: 'product', header: t('reports.product'), render: (i) => <span className="font-medium text-fg">{i.productName}</span> },
    { key: 'variant', header: `${t('products.color')} / ${t('products.size')}`, render: (i) => <span className="text-fg-muted">{i.colorName} / {i.sizeValue}</span> },
    { key: 'sku', header: t('reports.sku'), render: (i) => <span className="num text-fg-subtle">{i.sku}</span> },
    { key: 'category', header: t('reports.category'), render: (i) => <span className="text-fg-muted">{i.category}</span> },
    { key: 'onHand', header: t('reports.quantityOnHand'), numeric: true, render: (i) => <span className="font-medium text-fg">{i.quantityOnHand}</span> },
    { key: 'reserved', header: t('reports.quantityReserved'), numeric: true, render: (i) => <span className="text-fg-muted">{i.quantityReserved}</span> },
    { key: 'reorder', header: t('reports.reorderLevel'), numeric: true, render: (i) => <span className="text-fg-subtle">{i.reorderLevel}</span> },
    {
      key: 'status',
      header: 'État',
      align: 'center',
      render: (i) => (
        <StatusBadge
          domain="stockLevel"
          value={i.quantityOnHand === 0 ? 'out' : i.isLowStock ? 'low' : 'ok'}
          showIcon={false}
          animate={false}
        />
      ),
    },
  ]

  const topProductsColumns: Column<TopProductItem>[] = [
    { key: 'rank', header: '#', render: (_p, i) => <span className="text-fg-subtle">{i + 1}</span> },
    { key: 'product', header: t('reports.product'), render: (p) => <span className="font-medium text-fg">{p.productName}</span> },
    { key: 'qty', header: t('reports.quantitySold'), numeric: true, render: (p) => <span className="text-fg-muted">{p.quantitySold}</span> },
    { key: 'revenue', header: t('reports.revenue'), numeric: true, render: (p) => <span className="font-semibold text-fg">{formatCurrency(p.revenue)}</span> },
  ]

  const fournisseursColumns: Column<Fournisseur>[] = [
    { key: 'nom', header: 'Nom', render: (f) => <span className="font-medium text-fg">{f.nom}</span> },
    { key: 'contact', header: 'Contact', render: (f) => <span className="text-fg-muted">{f.contact || '—'}</span> },
    { key: 'email', header: 'Email', render: (f) => <span className="text-fg-muted">{f.email || '—'}</span> },
    { key: 'tel', header: 'Téléphone', render: (f) => <span className="num text-fg-muted">{f.telephone || '—'}</span> },
    { key: 'produits', header: 'Produits', align: 'center', render: (f) => <span className="num text-fg-muted">{f.produitsCount}</span> },
  ]

  return (
    <Page section="reports" title={t('reports.title')} className="local-reports">
      <div className="space-y-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <Tabs
            variant="segmented"
            layoutGroupId="reports-tab"
            value={activeTab}
            onChange={(v) => setActiveTab(v as Tab)}
            items={tabs.map((tb) => ({ value: tb.key, icon: <tb.icon className="h-4 w-4" />, label: tb.label }))}
          />
          <div className="flex items-center gap-2">
            <Input type="date" size="sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <span className="text-sm text-fg-subtle">→</span>
            <Input type="date" size="sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <Card className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-fg-subtle" />
            <span className="text-sm font-medium text-fg-muted">{t('reports.exportData')}</span>
          </div>
          {activeTab === 'overview' && <ExportButtons types={[{ type: 'pdf-dashboard', label: 'PDF', icon: 'pdf' }]} />}
          {activeTab === 'sales' && (
            <ExportButtons types={[{ type: 'pdf-sales', label: 'PDF', icon: 'pdf' }, { type: 'csv-sales', label: 'CSV', icon: 'csv' }]} />
          )}
          {activeTab === 'inventory' && (
            <ExportButtons types={[{ type: 'pdf-stock', label: 'PDF', icon: 'pdf' }, { type: 'csv-stock', label: 'CSV', icon: 'csv' }]} />
          )}
          {activeTab === 'products' && (
            <ExportButtons types={[{ type: 'pdf-products', label: 'PDF', icon: 'pdf' }, { type: 'csv-products', label: 'CSV', icon: 'csv' }]} />
          )}
          {activeTab === 'fournisseurs' && (
            <ExportButtons types={[{ type: 'pdf-fournisseurs', label: 'PDF', icon: 'pdf' }, { type: 'csv-fournisseurs', label: 'CSV', icon: 'csv' }]} />
          )}
        </Card>

        {loading ? (
          <div className="space-y-6">
            <SkeletonStats count={4} />
            <SkeletonTable rows={6} cols={5} />
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatCard label={t('reports.totalSales')} value={totalTransactions.toString()} icon={ShoppingCart} />
                  <StatCard label={t('reports.totalRevenue')} value={formatCurrency(totalRevenue)} icon={DollarSign} tone="positive" />
                  <StatCard label={t('reports.avgOrderValue')} value={formatCurrency(avgOrderValue)} icon={TrendingUp} tone="caution" />
                  <StatCard label={t('reports.lowStock')} value={lowStockItems.length.toString()} icon={Boxes} tone="negative" />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <Card>
                    <h3 className="mb-4 text-sm font-semibold text-fg">{t('reports.salesByChannel')}</h3>
                    {channelSales.length === 0 ? (
                      <p className="py-8 text-center text-sm text-fg-subtle">{t('reports.noData')}</p>
                    ) : (
                      <div className="space-y-4">
                        {channelSales.map((ch) => (
                          <BreakdownRow
                            key={ch.channel}
                            label={CHANNEL_LABEL[ch.channel] || ch.channel}
                            value={ch.totalRevenue}
                            total={totalRevenue}
                            format={formatCurrency}
                            meta={`· ${ch.totalSales} ventes`}
                            color={CHANNEL_COLOR[ch.channel] || 'var(--neutral)'}
                          />
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-fg">{t('reports.lowStockItems')}</h3>
                      <Badge tone="caution" size="sm">{lowStockItems.length}</Badge>
                    </div>
                    {lowStockItems.length === 0 ? (
                      <p className="py-8 text-center text-sm text-fg-subtle">{t('reports.noData')}</p>
                    ) : (
                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {lowStockItems.slice(0, 8).map((item) => (
                          <div key={item.productVariantId} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-fg">{item.productName}</p>
                              <p className="text-xs text-fg-subtle">{item.colorName} / {item.sizeValue} — {item.sku}</p>
                            </div>
                            <div className="ml-4 text-right">
                              <p className={`num text-sm font-bold ${item.quantityOnHand === 0 ? 'text-[var(--negative)]' : 'text-[var(--caution)]'}`}>
                                {item.quantityOnHand}
                              </p>
                              <p className="num text-xs text-fg-subtle">Seuil: {item.reorderLevel}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'sales' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatCard label={t('reports.totalSales')} value={(dailyReport?.totalSales ?? 0).toString()} />
                  <StatCard label={t('reports.totalRevenue')} value={formatCurrency(dailyReport?.totalRevenue ?? 0)} tone="positive" />
                  <StatCard label={t('reports.totalTax')} value={formatCurrency(dailyReport?.totalTax ?? 0)} />
                  <StatCard label={t('reports.avgOrderValue')} value={formatCurrency(avgOrderValue)} tone="caution" />
                </div>

                <Card>
                  <h3 className="mb-4 text-sm font-semibold text-fg">Ventes par mode de paiement</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {(
                      [
                        { label: t('reports.cashSales'), value: dailyReport?.cashSales ?? 0, color: 'var(--positive)' },
                        { label: t('reports.cardSales'), value: dailyReport?.cardSales ?? 0, color: 'var(--info)' },
                        { label: t('reports.onlineSales'), value: dailyReport?.onlineSales ?? 0, color: 'var(--special)' },
                      ] as const
                    ).map((pm) => {
                      const total = (dailyReport?.cashSales ?? 0) + (dailyReport?.cardSales ?? 0) + (dailyReport?.onlineSales ?? 0)
                      const pct = total > 0 ? (pm.value / total) * 100 : 0
                      return (
                        <div key={pm.label} className="rounded-field bg-sunken p-4 text-center">
                          <p className="mb-2 text-xs font-medium uppercase text-fg-subtle">{pm.label}</p>
                          <p className="num text-xl font-bold text-fg">{formatCurrency(pm.value)}</p>
                          <p className="num mt-1 text-xs text-fg-subtle">{pct.toFixed(1)}%</p>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-chip bg-surface-3">
                            <div className="h-full rounded-chip" style={{ width: `${pct}%`, background: pm.color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>

                <Card>
                  <h3 className="mb-4 text-sm font-semibold text-fg">{t('reports.salesByChannel')}</h3>
                  {channelSales.length === 0 ? (
                    <p className="py-8 text-center text-sm text-fg-subtle">{t('reports.noData')}</p>
                  ) : (
                    <div className="space-y-4">
                      {channelSales.map((ch) => {
                        const pct = totalRevenue > 0 ? (ch.totalRevenue / totalRevenue) * 100 : 0
                        return (
                          <div key={ch.channel} className="flex items-center gap-4">
                            <div className="w-24 shrink-0">
                              <span className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-chip" style={{ background: CHANNEL_COLOR[ch.channel] || 'var(--neutral)' }} />
                                <span className="text-sm font-medium text-fg-muted">{CHANNEL_LABEL[ch.channel] || ch.channel}</span>
                              </span>
                            </div>
                            <div className="relative h-6 flex-1 overflow-hidden rounded-field bg-sunken">
                              <div className="h-full rounded-field" style={{ width: `${pct}%`, background: CHANNEL_COLOR[ch.channel] || 'var(--neutral)' }} />
                              <span className="num absolute inset-0 flex items-center justify-center text-xs font-medium text-fg">
                                {formatCurrency(ch.totalRevenue)} ({pct.toFixed(1)}%)
                              </span>
                            </div>
                            <span className="num w-20 shrink-0 text-right text-sm text-fg-muted">{ch.totalSales} ventes</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {activeTab === 'inventory' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatCard label={t('reports.productsCount')} value={inventory.length.toString()} icon={Package} />
                  <StatCard label={t('reports.categoriesCount')} value={categoriesCount.toString()} icon={Grid3x3} />
                  <StatCard label={t('reports.stockValue')} value={`${totalStockValue} unités`} icon={Boxes} />
                  <StatCard label={t('reports.lowStockItems')} value={lowStockItems.length.toString()} tone="caution" />
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
                    <Card>
                      <h3 className="mb-4 text-sm font-semibold text-fg">{t('reports.stockByCategory')}</h3>
                      <div className="space-y-3">
                        {cats.map(([cat, catData]) => (
                          <div key={cat} className="flex items-center gap-4">
                            <div className="w-32 shrink-0">
                              <p className="truncate text-sm font-medium text-fg-muted">{cat}</p>
                              <p className="text-xs text-fg-subtle">{catData.products} produits</p>
                            </div>
                            <div className="relative h-5 flex-1 overflow-hidden rounded-field bg-sunken">
                              <div className="h-full rounded-field bg-[var(--accent)]" style={{ width: `${(catData.total / maxCat) * 100}%` }} />
                              <span className="num absolute inset-0 flex items-center justify-center text-xs font-medium text-fg">
                                {catData.total} unités
                              </span>
                            </div>
                            {catData.low > 0 && (
                              <Badge tone="caution" size="sm" className="shrink-0">{catData.low} faible</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )
                })()}

                <Card padded={false}>
                  <div className="border-b border-border px-5 py-3">
                    <h3 className="text-sm font-semibold text-fg">{t('reports.inventory')} complet</h3>
                  </div>
                  {shouldVirtualize(inventory.length) ? (
                    <VirtualTable columns={inventoryColumns} data={inventory} keyField={(i) => i.productVariantId} height={640} />
                  ) : (
                    <DataTable columns={inventoryColumns} data={inventory} keyField={(i) => i.productVariantId} sticky={false} />
                  )}
                </Card>
              </div>
            )}

            {activeTab === 'products' && (
              <div className="space-y-6">
                <Card padded={false}>
                  <div className="border-b border-border px-5 py-3">
                    <h3 className="text-sm font-semibold text-fg">{t('reports.topProducts')}</h3>
                  </div>
                  {topProducts.length === 0 ? (
                    <p className="py-12 text-center text-sm text-fg-subtle">{t('reports.noData')}</p>
                  ) : (
                    <>
                      <div className="space-y-3 p-5">
                        {topProducts.slice(0, 5).map((p, i) => {
                          const maxQty = topProducts[0]?.quantitySold || 1
                          const pct = (p.quantitySold / maxQty) * 100
                          const medals = ['🥇', '🥈', '🥉', '4.', '5.']
                          return (
                            <div key={p.productId} className="flex items-center gap-3">
                              <span className="w-6 text-center text-sm">{medals[i]}</span>
                              <div className="flex-1">
                                <div className="mb-1 flex items-center justify-between">
                                  <span className="text-sm font-medium text-fg-muted">{p.productName}</span>
                                  <span className="num text-sm font-semibold text-fg">{p.quantitySold} vendus · {formatCurrency(p.revenue)}</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-chip bg-sunken">
                                  <div className="h-full rounded-chip bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="border-t border-border">
                        <DataTable columns={topProductsColumns} data={topProducts} keyField={(p) => p.productId} sticky={false} />
                      </div>
                    </>
                  )}
                </Card>
              </div>
            )}

            {activeTab === 'fournisseurs' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatCard label="Total Fournisseurs" value={fournisseurs.length.toString()} icon={Truck} />
                  <StatCard label="Avec Produits" value={fournisseurs.filter((f) => f.produitsCount > 0).length.toString()} tone="positive" />
                </div>

                <Card padded={false}>
                  <div className="border-b border-border px-5 py-3">
                    <h3 className="text-sm font-semibold text-fg">Liste des Fournisseurs</h3>
                  </div>
                  <DataTable columns={fournisseursColumns} data={fournisseurs} keyField={(f) => f.id} sticky={false} emptyMessage={t('reports.noData')} />
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </Page>
  )
}
