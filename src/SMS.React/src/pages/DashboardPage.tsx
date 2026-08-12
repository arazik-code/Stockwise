import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle, ArrowRight, BarChart3, CalendarDays, CheckCircle2, FileText,
  Package, PackageSearch, RotateCcw, ShoppingBag, ShoppingCart, TrendingUp,
  Truck, Users, Wallet,
} from 'lucide-react'
import { reportsApi } from '../api/reports'
import { stockApi } from '../api/stock'
import { salesApi } from '../api/sales'
import { clientsApi } from '../api/clients'
import { fournisseursApi } from '../api/fournisseurs'
import { formatCurrency, formatDateTime } from '../utils/format'
import { useCashOnHand } from '../hooks/useCashOnHand'
import {
  BarChart, BreakdownRow, Button, Card, ChartFrame, DataTable, DonutChart,
  EmptyState, ErrorBanner, Page, ProgressBar, Skeleton, SkeletonCards,
  SkeletonStats, StatCard, StatusBadge, cn,
} from '../components/ui'
import { getStatus, type Tone } from '../design/status'
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

const paymentMeta: Record<string, { label: string; tone: Tone }> = {
  Cash: { label: 'Especes', tone: 'positive' },
  Card: { label: 'Carte', tone: 'special' },
  Online: { label: 'En ligne', tone: 'caution' },
}

/** Same three-way severity the page has always used for a low-stock row's colour - unchanged. */
function stockSeverityTone(quantityOnHand: number): Tone {
  if (quantityOnHand === 0) return 'critical'
  if (quantityOnHand <= 3) return 'negative'
  return 'caution'
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

  const totalCategoryRevenue = useMemo(
    () => data?.categoryBreakdown?.reduce((s, c) => s + c.revenue, 0) ?? 1,
    [data?.categoryBreakdown]
  )
  const totalPaymentCount = useMemo(
    () => data?.paymentBreakdown?.reduce((s, p) => s + p.count, 0) ?? 1,
    [data?.paymentBreakdown]
  )

  return (
    <Page
      section="dashboard"
      title={t('dashboard.title')}
      subtitle={now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      actions={
        <>
          <Button variant="outline" size="sm" icon={<BarChart3 className="h-4 w-4" />} onClick={() => navigate('/reports')}>
            {t('nav.reports')}
          </Button>
          <Button variant="solid" size="sm" icon={<ShoppingCart className="h-4 w-4" />} onClick={() => navigate('/pos')}>
            {t('dashboard.openPOS')}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {loading ? (
          <>
            <SkeletonStats count={cashOnHand.isAdmin ? 7 : 6} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Skeleton className="h-64 lg:col-span-2" />
              <Skeleton className="h-64" />
            </div>
            <SkeletonCards count={4} />
          </>
        ) : (
          <>
            {!data && (
              <ErrorBanner>
                Impossible de charger le résumé du tableau de bord. Les chiffres ci-dessous peuvent être incomplets.
              </ErrorBanner>
            )}

            {/* ── KPI GRID ── */}
            <div className={cn('grid grid-cols-2 gap-4 md:grid-cols-3', cashOnHand.isAdmin ? 'xl:grid-cols-7' : 'xl:grid-cols-6')}>
              {cashOnHand.isAdmin && (
                <StatCard
                  label="Solde caisse"
                  numericValue={cashOnHand.balance ?? 0}
                  format={formatCurrency}
                  loading={cashOnHand.loading}
                  sub="Especes en caisse"
                  icon={Wallet}
                  tone="special"
                />
              )}
              <StatCard
                label={t('dashboard.todaySales')}
                numericValue={data?.todaySales ?? 0}
                sub={`${data?.weekSales ?? 0} cette semaine`}
                icon={ShoppingCart}
              />
              <StatCard
                label={t('dashboard.todayRevenue')}
                numericValue={data?.todayRevenue ?? 0}
                format={formatCurrency}
                sub={`Panier: ${formatCurrency(data?.todayAvgOrderValue ?? 0)}`}
                icon={TrendingUp}
                tone="positive"
              />
              <StatCard
                label={t('dashboard.lowStock')}
                numericValue={data?.lowStockCount ?? 0}
                sub={`${data?.totalStockUnits ?? 0} unites en stock`}
                icon={AlertTriangle}
                tone={(data?.lowStockCount ?? 0) > 0 ? 'caution' : 'accent'}
              />
              <StatCard
                label="Ce mois"
                numericValue={data?.monthSales ?? 0}
                sub={formatCurrency(data?.monthRevenue ?? 0)}
                icon={CalendarDays}
                tone="special"
              />
              <StatCard label="Clients" numericValue={clientCount} sub="fiche(s)" icon={Users} tone="info" />
              <StatCard label="Fournisseurs" numericValue={fournisseurCount} sub="partenaire(s)" icon={Truck} tone="progress" />
            </div>

            {/* ── SALES TREND + PAYMENT BREAKDOWN ── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <ChartFrame
                className="lg:col-span-2"
                title="Ventes des 7 derniers jours"
                subtitle="Revenu par jour"
                empty={!data?.salesTrend || data.salesTrend.length === 0}
              >
                {(width) => (
                  <BarChart
                    width={width}
                    format={formatCurrency}
                    data={(data?.salesTrend ?? []).map((day) => ({
                      label: day.date,
                      value: day.revenue,
                      secondary: day.count,
                    }))}
                  />
                )}
              </ChartFrame>

              <ChartFrame
                title="Modes de paiement"
                subtitle="Repartition par methode"
                empty={!data?.paymentBreakdown || data.paymentBreakdown.length === 0}
              >
                {() => (
                  <DonutChart
                    size={140}
                    thickness={16}
                    centerValue={totalPaymentCount}
                    centerLabel="vente(s)"
                    data={(data?.paymentBreakdown ?? []).map((pm) => ({
                      label: paymentMeta[pm.method]?.label ?? pm.method,
                      value: pm.count,
                      color: `var(--${paymentMeta[pm.method]?.tone ?? 'neutral'})`,
                    }))}
                  />
                )}
              </ChartFrame>
            </div>

            {/* ── CATEGORY BREAKDOWN + TOP PRODUCTS ── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card>
                <h3 className="text-sm font-semibold text-fg">Ventes par categorie</h3>
                <p className="mb-4 text-xs text-fg-subtle">Revenu par type de vente</p>
                {(data?.categoryBreakdown?.length ?? 0) === 0 ? (
                  <p className="py-4 text-center text-sm text-fg-subtle">Aucune donnee</p>
                ) : (
                  <div className="space-y-3.5">
                    {(data?.categoryBreakdown ?? []).map((cat) => {
                      const status = getStatus('saleCategory', cat.category)
                      return (
                        <BreakdownRow
                          key={cat.category}
                          label={status.label}
                          value={cat.revenue}
                          total={totalCategoryRevenue}
                          format={formatCurrency}
                          color={`var(--${status.tone})`}
                          meta={`· ${cat.count}`}
                        />
                      )
                    })}
                  </div>
                )}
              </Card>

              <div className="space-y-3 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-fg">Produits les plus vendus</h3>
                    <p className="mt-0.5 text-xs text-fg-subtle">Top 8 par quantite</p>
                  </div>
                  <button
                    onClick={() => navigate('/reports')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
                  >
                    Voir tout
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                {topProducts.length === 0 ? (
                  <div className="surface-glass">
                    <EmptyState compact icon={PackageSearch} title="Aucun produit vendu" description="Les ventes apparaitront ici une fois enregistrees." />
                  </div>
                ) : (
                  <DataTable<TopProductItem>
                    columns={[
                      {
                        key: 'rank',
                        header: '#',
                        width: '3rem',
                        align: 'center',
                        render: (_r, i) => (
                          <span
                            data-tone={i === 0 ? 'caution' : i === 1 ? 'neutral' : i === 2 ? 'special' : undefined}
                            className={cn(
                              'inline-flex h-6 w-6 items-center justify-center rounded-chip text-[11px] font-bold',
                              i < 3 ? 'bg-[var(--tone-soft)] text-[var(--tone-ink)]' : 'bg-surface-2 text-fg-subtle'
                            )}
                          >
                            {i + 1}
                          </span>
                        ),
                      },
                      {
                        key: 'product',
                        header: 'Produit',
                        render: (r) => <span className="font-medium text-fg">{r.productName}</span>,
                      },
                      {
                        key: 'variant',
                        header: 'Couleur / Taille',
                        render: (r) => <span className="text-xs text-fg-subtle">{r.colorName} / {r.sizeValue}</span>,
                      },
                      {
                        key: 'qty',
                        header: 'Qte',
                        numeric: true,
                        width: '5rem',
                        render: (r) => <span className="num font-semibold text-fg">{r.quantitySold}</span>,
                      },
                      {
                        key: 'revenue',
                        header: 'Revenu',
                        numeric: true,
                        width: '8rem',
                        render: (r) => <span className="num font-medium text-fg-muted">{formatCurrency(r.revenue)}</span>,
                      },
                      {
                        key: 'bar',
                        header: 'Barre',
                        width: '7rem',
                        render: (r) => {
                          const maxQty = Math.max(...topProducts.map((x) => x.quantitySold), 1)
                          return <ProgressBar value={(r.quantitySold / maxQty) * 100} size="sm" />
                        },
                      },
                    ]}
                    data={topProducts}
                    keyField={(r) => r.productVariantId}
                    sticky={false}
                  />
                )}
              </div>
            </div>

            {/* ── RECENT SALES + LOW STOCK ── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card padded={false}>
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-fg">{t('dashboard.recentSales')}</h3>
                    <p className="mt-0.5 text-xs text-fg-subtle">Dernieres transactions</p>
                  </div>
                  <button
                    onClick={() => navigate('/sales')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
                  >
                    Voir tout
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {recentSales.slice(0, 6).map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-surface-2/60">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          data-tone={paymentMeta[sale.paymentMethod]?.tone ?? 'neutral'}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-[var(--tone)] text-[11px] font-bold text-white"
                        >
                          {sale.saleNumber.slice(-3)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-fg">{sale.saleNumber}</p>
                          <p className="text-[11px] text-fg-subtle">{formatDateTime(sale.createdAt)}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="num font-semibold text-fg">{formatCurrency(sale.totalAmount)}</p>
                        <div className="mt-0.5 flex items-center justify-end gap-1">
                          <StatusBadge domain="channel" value={sale.channel} showIcon={false} size="xs" animate={false} />
                          <span
                            data-tone={paymentMeta[sale.paymentMethod]?.tone ?? 'neutral'}
                            className="inline-flex h-5 items-center rounded-chip bg-[var(--tone-soft)] px-1.5 text-[10px] font-medium text-[var(--tone-ink)]"
                          >
                            {paymentMeta[sale.paymentMethod]?.label ?? sale.paymentMethod}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {recentSales.length === 0 && (
                    <div className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-fg-subtle">
                      <ShoppingCart className="h-4 w-4" />
                      Aucune vente recente
                    </div>
                  )}
                </div>
              </Card>

              <Card padded={false}>
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-fg">{t('dashboard.lowStockAlerts')}</h3>
                    <p className="mt-0.5 text-xs text-fg-subtle">Articles sous le seuil</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {lowStock.length > 0 && (
                      <span className="num inline-flex h-5 items-center rounded-chip bg-[var(--caution-soft)] px-2 text-[11px] font-bold text-[var(--caution-ink)]">
                        {lowStock.length}
                      </span>
                    )}
                    <button
                      onClick={() => navigate('/stock')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
                    >
                      Voir tout
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {lowStock.slice(0, 6).map((item) => {
                    const severity = stockSeverityTone(item.quantityOnHand)
                    const pct = Math.min((item.quantityOnHand / Math.max(item.reorderLevel, 1)) * 100, 100)
                    return (
                      <div key={item.productVariantId} className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-surface-2/60">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            data-tone={severity}
                            className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-[var(--tone-soft)] text-[11px] font-bold text-[var(--tone-ink)]"
                          >
                            {item.quantityOnHand}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-fg">{item.productName}</p>
                            <p className="truncate text-[11px] text-fg-subtle">{item.colorName} / {item.sizeValue}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <ProgressBar value={pct} tone={severity} size="sm" className="w-16" />
                          <span className="num text-[11px] font-semibold text-[var(--tone-ink)]" data-tone={severity}>
                            {item.quantityOnHand}/{item.reorderLevel}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                  {lowStock.length === 0 && (
                    <div className="px-5 py-8 text-center">
                      <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-[var(--positive)]" aria-hidden="true" />
                      <p className="text-sm font-medium text-fg-subtle">Tout est en stock</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* ── QUICK NAV CARDS ── */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Card interactive accent className="cursor-pointer" onClick={() => navigate('/products')}>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-[var(--accent-soft)] text-[var(--accent)]">
                    <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-fg">Produits</p>
                    <p className="text-[11px] text-fg-subtle">{data?.totalProducts ?? 0} produit(s)</p>
                  </div>
                </div>
              </Card>
              <Card interactive accent className="cursor-pointer" onClick={() => navigate('/stock')}>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Package className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-fg">Stock</p>
                    <p className="text-[11px] text-fg-subtle">{data?.totalVariants ?? 0} variante(s)</p>
                  </div>
                </div>
              </Card>
              <Card interactive accent className="cursor-pointer" onClick={() => navigate('/invoices')}>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-[var(--accent-soft)] text-[var(--accent)]">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-fg">Factures</p>
                    <p className="text-[11px] text-fg-subtle">Fournisseurs</p>
                  </div>
                </div>
              </Card>
              <Card interactive accent className="cursor-pointer" onClick={() => navigate('/refunds')}>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-[var(--accent-soft)] text-[var(--accent)]">
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-fg">Remboursements</p>
                    <p className="text-[11px] text-fg-subtle">Echanges</p>
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </Page>
  )
}
