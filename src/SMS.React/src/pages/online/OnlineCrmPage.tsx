import { useState, useEffect, useCallback, useMemo } from 'react'
import Header from '../../components/layout/Header'
import { crmApi, type CrmAnalytics, type ClientSegment } from '../../api/clients'
import { formatCurrency } from '../../utils/format'

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

  return (
    <div className="flex flex-col flex-1">
      <Header title="CRM — Analytique clients" />

      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-violet-900 px-6 py-6">
        <p className="text-xs font-medium text-slate-300 uppercase tracking-wide mb-4">Intelligence client &amp; démographie</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiTile label="Clients au total" value={String(data?.totalClients ?? 0)} accent="cyan" />
          <KpiTile label="Clients acheteurs" value={String(data?.clientsWithOrders ?? 0)} accent="emerald" />
          <KpiTile label="Chiffre d'affaires" value={formatCurrency(data?.totalRevenue ?? 0)} accent="violet" />
          <KpiTile label="Valeur moy./client" value={formatCurrency(data?.avgClientValue ?? 0)} accent="amber" />
          <KpiTile label="Importés de Shopify" value={String(data?.shopifyImportedCount ?? 0)} accent="rose" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
          <KpiTile label="Commandes totales" value={String(data?.totalOrders ?? 0)} accent="cyan" />
          <KpiTile label="Panier moyen" value={formatCurrency(data?.avgOrderValue ?? 0)} accent="emerald" />
          <KpiTile label="Clients fidèles (2+)" value={String(data?.repeatClients ?? 0)} accent="violet" />
          <KpiTile label="Taux de réachat" value={`${data?.repeatRate ?? 0}%`} accent="amber" />
          <KpiTile label="Villes couvertes" value={String(data?.distinctCities ?? 0)} accent="rose" />
        </div>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      ) : (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Segment distribution */}
            <Card title="Répartition par segment" subtitle="Segmentation RFM (récence / fréquence / montant)">
              <div className="space-y-3">
                {data.segments.map((s) => {
                  const pct = Math.round((s.count / totalSegmentClients) * 100)
                  return (
                    <div key={s.segment}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-slate-700">{SEGMENT_LABELS[s.segment]}</span>
                        <span className="text-slate-500">{s.count} · {formatCurrency(s.revenue)}</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${SEGMENT_COLOR[s.segment]} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Demographics — full city scatter */}
            <Card
              title={`Démographie — ${data.distinctCities} villes`}
              subtitle={`${data.clientsWithCity} clients géolocalisés sur ${data.totalClients}`}
            >
              {data.cities.length === 0 ? (
                <Empty text="Aucune donnée de ville. Importez les clients/commandes Shopify." />
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Filtrer une ville..."
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    className="w-full mb-3 px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {filteredCities.map((c) => (
                      <div key={c.city} className="flex items-center gap-3">
                        <span className="text-sm text-slate-600 w-28 truncate flex-shrink-0" title={c.city}>{c.city}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full" style={{ width: `${Math.round((c.clientCount / maxCityCount) * 100)}%` }} />
                        </div>
                        <span className="text-xs font-medium text-slate-700 w-24 text-right flex-shrink-0">{c.clientCount} · {formatCurrency(c.revenue)}</span>
                      </div>
                    ))}
                    {filteredCities.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Aucune ville trouvée</p>}
                  </div>
                </>
              )}
            </Card>

            {/* Top products */}
            <Card title="Produits les plus vendus" subtitle="Ce que les clients achètent le plus">
              {data.topProducts.length === 0 ? (
                <Empty text="Aucune vente enregistrée." />
              ) : (
                <div className="space-y-2">
                  {data.topProducts.map((p, idx) => (
                    <div key={p.productId} className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 text-white ${
                        idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-orange-700' : 'bg-slate-300'
                      }`}>{idx + 1}</span>
                      <div className="w-9 h-9 rounded bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" style={{ width: `${Math.round((p.revenue / maxProductRevenue) * 100)}%` }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-slate-900">{formatCurrency(p.revenue)}</p>
                        <p className="text-[11px] text-slate-400">{p.unitsSold} vendus</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Top categories */}
            <Card title="Catégories préférées" subtitle="Par chiffre d'affaires et nombre d'acheteurs">
              {data.topCategories.length === 0 ? (
                <Empty text="Aucune donnée de catégorie." />
              ) : (
                <div className="space-y-2.5">
                  {data.topCategories.map((c) => (
                    <div key={c.categoryName} className="flex items-center gap-3">
                      <span className="text-sm text-slate-600 w-32 truncate flex-shrink-0">{c.categoryName}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" style={{ width: `${Math.round((c.revenue / maxCategoryRevenue) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-medium text-slate-700 w-28 text-right flex-shrink-0">{formatCurrency(c.revenue)} · {c.buyerCount}👤</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Top clients */}
          <Card title="Meilleurs clients" subtitle="Classement par valeur totale">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="py-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider">#</th>
                    <th className="py-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Client</th>
                    <th className="py-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Ville</th>
                    <th className="py-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Segment</th>
                    <th className="py-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Commandes</th>
                    <th className="py-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.topClients.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-2 px-2 text-sm text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-2 text-sm font-medium text-slate-900">{c.name}</td>
                      <td className="py-2 px-2 text-sm text-slate-500">{c.city || '—'}</td>
                      <td className="py-2 px-2 text-sm text-slate-600">{SEGMENT_LABELS[c.segment]}</td>
                      <td className="py-2 px-2 text-sm text-center text-slate-700">{c.orderCount}</td>
                      <td className="py-2 px-2 text-sm text-right font-semibold text-slate-900">{formatCurrency(c.totalSpent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function KpiTile({ label, value, accent }: { label: string; value: string; accent: 'emerald' | 'cyan' | 'violet' | 'amber' | 'rose' }) {
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
    </div>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-400 text-center py-8">{text}</p>
}
