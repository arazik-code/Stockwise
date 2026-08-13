import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ImageOff, MapPin, Percent, Repeat, RefreshCw, Search, ShoppingBag, TrendingUp,
  Trophy, Users, Wallet,
} from 'lucide-react'
import { crmApi, type CrmAnalytics, type ClientSegment, type ClientCrmSummary } from '../../api/clients'
import { formatCurrency } from '../../utils/format'
import {
  BreakdownRow, Card, CardHeader, CardTitle, CardDescription, DataTable, EmptyState,
  Input, Page, Spinner, StatCard, StatusBadge, type Column,
} from '../../components/ui'

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

export default function OnlineCrmPage() {
  const [data, setData] = useState<CrmAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await crmApi.getCrmAnalytics())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalSegmentClients = useMemo(
    () => (data?.segments.reduce((sum, s) => sum + s.count, 0) ?? 0) || 1,
    [data],
  )
  const maxCityCount = useMemo(() => Math.max(1, ...(data?.cities.map((c) => c.clientCount) ?? [])), [data])
  const [citySearch, setCitySearch] = useState('')
  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase()
    const list = data?.cities ?? []
    return q ? list.filter((c) => c.city.toLowerCase().includes(q)) : list
  }, [data, citySearch])
  const maxProductRevenue = useMemo(() => Math.max(1, ...(data?.topProducts.map((p) => p.revenue) ?? [])), [data])
  const maxCategoryRevenue = useMemo(() => Math.max(1, ...(data?.topCategories.map((c) => c.revenue) ?? [])), [data])

  const topClientColumns: Column<ClientCrmSummary>[] = [
    { key: 'rank', header: '#', width: '2.5rem', render: (_c, i) => <span className="num text-fg-subtle">{i + 1}</span> },
    { key: 'name', header: 'Client', render: (c) => <span className="font-medium text-fg">{c.name}</span> },
    { key: 'city', header: 'Ville', render: (c) => <span className="text-fg-muted">{c.city || '—'}</span> },
    { key: 'segment', header: 'Segment', render: (c) => <StatusBadge domain="rfmSegment" value={c.segment} size="xs" animate={false} /> },
    { key: 'loyalty', header: 'Fidélité', render: (c) => <StatusBadge domain="clientTier" value={c.loyaltyCategory} size="xs" animate={false} /> },
    { key: 'orders', header: 'Commandes', align: 'center', render: (c) => <span className="num text-fg-muted">{c.orderCount}</span> },
    { key: 'total', header: 'Total', numeric: true, render: (c) => <span className="num font-semibold text-fg">{formatCurrency(c.totalSpent)}</span> },
  ]

  return (
    <Page section="onlineCrm" title="CRM — Analytique clients" subtitle="Intelligence client & démographie">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard label="Clients au total" numericValue={data?.totalClients ?? 0} icon={Users} tone="info" loading={loading} />
          <StatCard label="Clients acheteurs" numericValue={data?.clientsWithOrders ?? 0} icon={ShoppingBag} tone="positive" loading={loading} />
          <StatCard label="Chiffre d'affaires" value={formatCurrency(data?.totalRevenue ?? 0)} icon={Wallet} tone="special" loading={loading} />
          <StatCard label="Valeur moy./client" value={formatCurrency(data?.avgClientValue ?? 0)} icon={TrendingUp} tone="caution" loading={loading} />
          <StatCard label="Importés de Shopify" numericValue={data?.shopifyImportedCount ?? 0} icon={RefreshCw} tone="negative" loading={loading} />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard label="Commandes totales" numericValue={data?.totalOrders ?? 0} icon={ShoppingBag} tone="info" loading={loading} />
          <StatCard label="Panier moyen" value={formatCurrency(data?.avgOrderValue ?? 0)} icon={Wallet} tone="positive" loading={loading} />
          <StatCard label="Clients fidèles (2+)" numericValue={data?.repeatClients ?? 0} icon={Repeat} tone="special" loading={loading} />
          <StatCard label="Taux de réachat" value={`${data?.repeatRate ?? 0}%`} icon={Percent} tone="caution" loading={loading} />
          <StatCard label="Villes couvertes" numericValue={data?.distinctCities ?? 0} icon={MapPin} tone="negative" loading={loading} />
        </div>

        {loading || !data ? (
          <div className="flex items-center justify-center py-24">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Segment distribution */}
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Répartition par segment</CardTitle>
                    <CardDescription>Segmentation RFM (récence / fréquence / montant)</CardDescription>
                  </div>
                </CardHeader>
                <div className="space-y-3">
                  {data.segments.map((s) => {
                    const pct = Math.round((s.count / totalSegmentClients) * 100)
                    return (
                      <div key={s.segment}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium text-fg-muted">{SEGMENT_LABELS[s.segment]}</span>
                          <span className="num text-fg-subtle">{s.count} · {formatCurrency(s.revenue)}</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-chip bg-sunken">
                          <div className="h-full rounded-chip" style={{ width: `${pct}%`, background: SEGMENT_COLOR[s.segment] }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>

              {/* Demographics — full city scatter */}
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Démographie — {data.distinctCities} villes</CardTitle>
                    <CardDescription>{data.clientsWithCity} clients géolocalisés sur {data.totalClients}</CardDescription>
                  </div>
                </CardHeader>
                {data.cities.length === 0 ? (
                  <EmptyState compact icon={MapPin} title="Aucune donnée de ville" description="Importez les clients/commandes Shopify." />
                ) : (
                  <>
                    <Input
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                      placeholder="Filtrer une ville..."
                      leading={<Search />}
                      wrapperClassName="mb-3"
                    />
                    <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                      {filteredCities.map((c) => (
                        <BreakdownRow
                          key={c.city}
                          label={c.city}
                          value={c.clientCount}
                          total={maxCityCount}
                          meta={formatCurrency(c.revenue)}
                        />
                      ))}
                      {filteredCities.length === 0 && <p className="py-4 text-center text-sm text-fg-subtle">Aucune ville trouvée</p>}
                    </div>
                  </>
                )}
              </Card>

              {/* Top products */}
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Produits les plus vendus</CardTitle>
                    <CardDescription>Ce que les clients achètent le plus</CardDescription>
                  </div>
                </CardHeader>
                {data.topProducts.length === 0 ? (
                  <EmptyState compact title="Aucune vente enregistrée" />
                ) : (
                  <div className="space-y-2">
                    {data.topProducts.map((p, idx) => (
                      <div key={p.productId} className="flex items-center gap-3">
                        <span
                          data-tone={idx === 0 ? 'caution' : idx === 1 ? 'neutral' : idx === 2 ? 'special' : 'muted'}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-chip bg-[var(--tone)] text-[10px] font-bold text-white"
                        >
                          {idx + 1}
                        </span>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-inset border border-border bg-sunken">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                          ) : (
                            <ImageOff className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-fg">{p.name}</p>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-chip bg-sunken">
                            <div className="h-full rounded-chip bg-[var(--accent)]" style={{ width: `${Math.round((p.revenue / maxProductRevenue) * 100)}%` }} />
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="num text-sm font-semibold text-fg">{formatCurrency(p.revenue)}</p>
                          <p className="num text-[11px] text-fg-subtle">{p.unitsSold} vendus</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Top categories */}
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Catégories préférées</CardTitle>
                    <CardDescription>Par chiffre d'affaires et nombre d'acheteurs</CardDescription>
                  </div>
                </CardHeader>
                {data.topCategories.length === 0 ? (
                  <EmptyState compact title="Aucune donnée de catégorie" />
                ) : (
                  <div className="space-y-3">
                    {data.topCategories.map((c) => (
                      <BreakdownRow
                        key={c.categoryName}
                        label={c.categoryName}
                        value={c.revenue}
                        total={maxCategoryRevenue}
                        format={formatCurrency}
                        meta={`· ${c.buyerCount} 👤`}
                      />
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Top clients */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="inline-flex items-center gap-1.5"><Trophy className="h-4 w-4" /> Meilleurs clients</CardTitle>
                  <CardDescription>Classement par valeur totale</CardDescription>
                </div>
              </CardHeader>
              <DataTable
                columns={topClientColumns}
                data={data.topClients}
                keyField={(c) => c.id}
                emptyMessage="Aucun client"
              />
            </Card>
          </div>
        )}
      </div>
    </Page>
  )
}
