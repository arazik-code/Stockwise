import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, Search } from 'lucide-react'
import SaleDetail from '../components/sales/SaleDetail'
import { salesApi } from '../api/sales'
import { fournisseursApi } from '../api/fournisseurs'
import { formatCurrency, formatDate } from '../utils/format'
import { useTableSelection } from '../hooks/useTableSelection'
import { useCashOnHand } from '../hooks/useCashOnHand'
import { showToast } from '../components/shared/Toast'
import {
  Badge, BreakdownRow, Button, Card, DataTable, IconButton, Input, Page,
  Select, shouldVirtualize, Skeleton, SkeletonStats, StatCard, StatusBadge,
  Tabs, Toolbar, VirtualTable, type Column,
} from '../components/ui'
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

  const salesColumns: Column<Sale>[] = [
    { key: 'saleNumber', header: t('sales.saleNumber'), render: (s) => <span className="num text-fg-muted">{s.saleNumber}</span> },
    { key: 'channel', header: t('sales.channel'), render: (s) => <StatusBadge domain="channel" value={s.channel} animate={false} showIcon={false} size="xs" /> },
    { key: 'category', header: t('sales.category'), render: (s) => <StatusBadge domain="saleCategory" value={s.category} animate={false} showIcon={false} size="xs" /> },
    { key: 'payment', header: t('sales.payment'), render: (s) => <span className="text-xs text-fg-muted">{t(`sales.payments.${s.paymentMethod.toLowerCase()}`)}</span> },
    { key: 'client', header: t('sales.client'), render: (s) => <span className="text-xs text-fg-muted">{s.clientName ?? '-'}</span> },
    { key: 'lines', header: t('sales.items'), numeric: true, render: (s) => <span className="text-xs text-fg-muted">{s.items.length}</span> },
    {
      key: 'qty',
      header: t('sales.itemsSold'),
      numeric: true,
      render: (s) => <span className="font-medium text-fg">{s.items.reduce((sum, i) => sum + i.quantity, 0)}</span>,
    },
    { key: 'subtotal', header: t('common.subtotal'), numeric: true, render: (s) => <span className="text-xs text-fg-muted">{formatCurrency(s.subTotal)}</span> },
    {
      key: 'discount',
      header: t('sales.summary.totalDiscount'),
      numeric: true,
      render: (s) => (
        <span className="text-xs text-fg-subtle">
          {s.discountAmount + s.loyaltyDiscountAmount > 0 ? `-${formatCurrency(s.discountAmount + s.loyaltyDiscountAmount)}` : '-'}
        </span>
      ),
    },
    { key: 'total', header: t('sales.summary.totalRevenue'), numeric: true, render: (s) => <span className="font-semibold text-fg">{formatCurrency(s.totalAmount)}</span> },
    { key: 'cashier', header: t('sales.cashier'), render: (s) => <span className="text-xs text-fg-muted">{s.userName ?? '-'}</span> },
    { key: 'date', header: t('sales.date'), render: (s) => <span className="text-xs text-fg-subtle">{formatDate(s.createdAt)}</span> },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'center',
      render: (s) => (
        <IconButton icon={<Eye className="h-3.5 w-3.5" />} label={t('sales.detail')} size="xs" onClick={() => setSelectedSale(s)} />
      ),
    },
  ]

  return (
    <Page section="sales" title={t('sales.title')}>
      {loading && !report ? (
        <div className="space-y-6">
          <SkeletonStats count={6} />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filter bar */}
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <Tabs
                variant="segmented"
                size="sm"
                layoutGroupId="sales-preset"
                value={filterPreset}
                onChange={(v) => setFilterPreset(v as FilterPreset)}
                items={(['today', 'thisWeek', 'thisMonth', 'thisYear', 'custom'] as FilterPreset[]).map((p) => ({
                  value: p,
                  label: t(`sales.filter.${p}`),
                }))}
              />

              {filterPreset === 'custom' && (
                <div className="ml-2 flex items-center gap-2">
                  <label className="text-xs text-fg-subtle">{t('sales.filter.from')}</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded-field border border-border bg-surface px-2 py-1.5 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
                  />
                  <label className="text-xs text-fg-subtle">{t('sales.filter.to')}</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="rounded-field border border-border bg-surface px-2 py-1.5 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
                  />
                  <Button size="xs" onClick={loadReport}>{t('sales.filter.apply')}</Button>
                </div>
              )}

              <div className="ml-auto flex items-center gap-2">
                <Select
                  size="sm"
                  value={fournisseurId ?? ''}
                  onChange={(e) => setFournisseurId(e.target.value ? Number(e.target.value) : null)}
                  wrapperClassName="w-44"
                >
                  <option value="">Tous les fournisseurs</option>
                  {fournisseurs.map((f) => (
                    <option key={f.id} value={f.id}>{f.nom}</option>
                  ))}
                </Select>
                <Select size="sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} wrapperClassName="w-44">
                  <option value="">Toutes les catégories</option>
                  <option value="VenteNormale">Vente Normale</option>
                  <option value="VentePromotion">Vente Promotion</option>
                  <option value="Liquidation">Liquidation</option>
                  <option value="VenteEnGros">Vente en Gros</option>
                  <option value="VenteSpeciale">Vente Spéciale</option>
                  <option value="Retour">Retour</option>
                  <option value="Echange">Échange</option>
                </Select>
                <Input
                  size="sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('sales.searchPlaceholder')}
                  leading={<Search />}
                  wrapperClassName="w-56"
                />
              </div>
            </div>

            {report && (
              <p className="mt-2 text-xs text-fg-subtle">
                {formatDate(report.from)} — {formatDate(report.to)}
              </p>
            )}
          </Card>

          {report && (
            <>
              {/* Summary cards */}
              <div className={`grid grid-cols-2 gap-4 md:grid-cols-3 ${cashOnHand.isAdmin ? 'xl:grid-cols-7' : 'xl:grid-cols-6'}`}>
                <StatCard label={t('sales.summary.totalRevenue')} value={formatCurrency(report.totalRevenue)} />
                <StatCard label={t('sales.summary.totalSales')} value={report.totalSales.toString()} tone="positive" />
                <StatCard label={t('sales.summary.avgOrder')} value={formatCurrency(report.averageOrderValue)} tone="special" />
                <StatCard label={t('sales.summary.itemsSold')} value={report.totalItemsSold.toString()} tone="caution" />
                <StatCard label={t('sales.summary.totalProfit')} value={formatCurrency(report.totalProfit)} tone="positive" />
                <StatCard label={t('sales.summary.totalDiscount')} value={formatCurrency(report.totalDiscount)} tone="negative" />
                {cashOnHand.isAdmin && (
                  <Card className="bg-[var(--ink-950)]">
                    <p className="mb-1 text-xs font-medium text-white/70">Solde caisse</p>
                    {cashOnHand.loading ? (
                      <Skeleton className="h-5" width="60%" />
                    ) : (
                      <p className="num text-lg font-bold text-white">{formatCurrency(cashOnHand.balance ?? 0)}</p>
                    )}
                  </Card>
                )}
              </div>

              <Tabs
                variant="pill"
                layoutGroupId="sales-tab"
                value={activeTab}
                onChange={(v) => setActiveTab(v as typeof activeTab)}
                items={tabs.map((tb) => ({ value: tb.key, label: tb.label }))}
              />

              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <Card>
                    <h3 className="mb-4 text-sm font-semibold text-fg">{t('sales.breakdown.byPayment')}</h3>
                    <div className="space-y-3">
                      <BreakdownRow label={t('sales.breakdown.cash')} value={report.paymentBreakdown.cash} total={report.totalRevenue} format={formatCurrency} meta={`· ${report.paymentBreakdown.cashCount}`} color="var(--positive)" />
                      <BreakdownRow label={t('sales.breakdown.card')} value={report.paymentBreakdown.card} total={report.totalRevenue} format={formatCurrency} meta={`· ${report.paymentBreakdown.cardCount}`} color="var(--info)" />
                      <BreakdownRow label={t('sales.breakdown.online')} value={report.paymentBreakdown.online} total={report.totalRevenue} format={formatCurrency} meta={`· ${report.paymentBreakdown.onlineCount}`} color="var(--special)" />
                    </div>
                  </Card>

                  <Card>
                    <h3 className="mb-4 text-sm font-semibold text-fg">{t('sales.breakdown.byChannel')}</h3>
                    <div className="space-y-3">
                      <BreakdownRow label={t('sales.breakdown.local')} value={report.channelBreakdown.local} total={report.totalRevenue} format={formatCurrency} meta={`· ${report.channelBreakdown.localCount}`} color="var(--info)" />
                      <BreakdownRow label={t('sales.breakdown.shopify')} value={report.channelBreakdown.shopify} total={report.totalRevenue} format={formatCurrency} meta={`· ${report.channelBreakdown.shopifyCount}`} color="var(--special)" />
                    </div>
                  </Card>

                  <Card>
                    <h3 className="mb-4 text-sm font-semibold text-fg">{t('sales.breakdown.byCategory')}</h3>
                    <div className="space-y-2">
                      {report.categoryBreakdown.map((cat) => (
                        <div key={cat.category} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <StatusBadge domain="saleCategory" value={cat.category} animate={false} showIcon={false} size="xs" />
                            <span className="text-fg-subtle">{cat.count}</span>
                          </div>
                          <span className="num font-medium text-fg-muted">{formatCurrency(cat.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === 'products' && (
                <Card padded={false}>
                  <div className="border-b border-border px-5 py-4">
                    <h3 className="text-sm font-semibold text-fg">{t('sales.products.title')}</h3>
                  </div>
                  <DataTable
                    sticky={false}
                    columns={[
                      { key: 'i', header: '#', render: (_p: (typeof report.topProducts)[number], i: number) => <span className="text-fg-subtle">{i + 1}</span> },
                      { key: 'name', header: t('sales.products.product'), render: (p) => <span className="font-medium text-fg">{p.productName}</span> },
                      { key: 'sku', header: t('sales.products.sku'), render: (p) => <span className="num text-xs text-fg-subtle">{p.sku}</span> },
                      { key: 'color', header: t('sales.products.color'), render: (p) => <span className="text-fg-muted">{p.colorName}</span> },
                      { key: 'size', header: t('sales.products.size'), render: (p) => <span className="text-fg-muted">{p.sizeValue}</span> },
                      { key: 'qty', header: t('sales.products.qtySold'), numeric: true, render: (p) => <span className="font-medium text-fg">{p.quantitySold}</span> },
                      { key: 'revenue', header: t('sales.products.revenue'), numeric: true, render: (p) => <span className="text-fg-muted">{formatCurrency(p.revenue)}</span> },
                      { key: 'cost', header: t('sales.products.cost'), numeric: true, render: (p) => <span className="text-fg-subtle">{formatCurrency(p.cost)}</span> },
                      {
                        key: 'profit',
                        header: t('sales.products.profit'),
                        numeric: true,
                        render: (p) => <span className={p.profit >= 0 ? 'font-medium text-[var(--positive)]' : 'font-medium text-[var(--negative)]'}>{formatCurrency(p.profit)}</span>,
                      },
                      { key: 'avg', header: t('sales.products.avgPrice'), numeric: true, render: (p) => <span className="text-fg-subtle">{formatCurrency(p.averageUnitPrice)}</span> },
                    ]}
                    data={report.topProducts}
                    keyField={(p) => p.productVariantId}
                    emptyMessage={t('common.noData')}
                  />
                </Card>
              )}

              {activeTab === 'daily' && (
                <Card padded={false}>
                  <div className="border-b border-border px-5 py-4">
                    <h3 className="text-sm font-semibold text-fg">{t('sales.daily.title')}</h3>
                  </div>
                  <DataTable
                    sticky={false}
                    columns={[
                      { key: 'date', header: t('sales.daily.date'), render: (d) => <span className="text-fg">{formatDate(d.date)}</span> },
                      { key: 'count', header: t('sales.daily.salesCount'), numeric: true, render: (d) => <span className="text-fg-muted">{d.salesCount}</span> },
                      { key: 'revenue', header: t('sales.daily.revenue'), numeric: true, render: (d) => <span className="font-medium text-fg">{formatCurrency(d.revenue)}</span> },
                      {
                        key: 'profit',
                        header: t('sales.daily.profit'),
                        numeric: true,
                        render: (d) => <span className={d.profit >= 0 ? 'font-medium text-[var(--positive)]' : 'font-medium text-[var(--negative)]'}>{formatCurrency(d.profit)}</span>,
                      },
                      { key: 'items', header: t('sales.daily.itemsSold'), numeric: true, render: (d) => <span className="text-fg-muted">{d.itemsSold}</span> },
                    ]}
                    data={report.dailyRevenue}
                    keyField={(d) => d.date}
                    emptyMessage={t('common.noData')}
                  />
                </Card>
              )}

              {/* Sales table */}
              <Card padded={false}>
                <Toolbar className="border-b border-border px-5 py-3">
                  <h3 className="text-sm font-semibold text-fg">
                    {t('sales.title')} (<span className="num">{filteredSales.length}</span>)
                  </h3>
                  {tableSelection.someSelected && (
                    <div className="ml-auto flex items-center gap-3">
                      <Badge tone="info" size="sm">
                        <span className="num">{tableSelection.count}</span> {t('sales.selected')}
                      </Badge>
                      <Button size="xs" variant="soft" onClick={handleBulkVoid}>{t('sales.void')}</Button>
                      <Button size="xs" variant="ghost" onClick={tableSelection.clear}>{t('common.cancel')}</Button>
                    </div>
                  )}
                </Toolbar>

                {shouldVirtualize(filteredSales.length) ? (
                  <VirtualTable<Sale>
                    columns={salesColumns}
                    data={filteredSales}
                    keyField={(s) => s.id}
                    emptyMessage={search.trim() ? t('sales.noResults') : t('sales.noSales')}
                    height={640}
                    selection={{
                      selected: tableSelection.selected as Set<string | number>,
                      onToggle: (key) => tableSelection.toggle(Number(key)),
                      onToggleAll: () => tableSelection.toggleAll(filteredSales),
                      allSelected: tableSelection.allSelected(filteredSales),
                      someSelected: tableSelection.someSelected,
                    }}
                  />
                ) : (
                  <DataTable<Sale>
                    columns={salesColumns}
                    data={filteredSales}
                    keyField={(s) => s.id}
                    emptyMessage={search.trim() ? t('sales.noResults') : t('sales.noSales')}
                    selection={{
                      selected: tableSelection.selected as Set<string | number>,
                      onToggle: (key) => tableSelection.toggle(Number(key)),
                      onToggleAll: () => tableSelection.toggleAll(filteredSales),
                      allSelected: tableSelection.allSelected(filteredSales),
                      someSelected: tableSelection.someSelected,
                    }}
                  />
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {selectedSale && (
        <SaleDetail sale={selectedSale} onClose={() => setSelectedSale(null)} />
      )}
    </Page>
  )
}
