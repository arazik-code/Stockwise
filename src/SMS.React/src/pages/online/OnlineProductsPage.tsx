import { useState, useEffect, useCallback, useMemo } from 'react'
import Header from '../../components/layout/Header'
import ProductForm from '../../components/products/ProductForm'
import { showToast } from '../../components/shared/Toast'
import { shopifyApi, type ShopifyProductMapping } from '../../api/shopify'
import { productsApi, type OnlineProductStats } from '../../api/products'
import { categoriesApi, type Category } from '../../api/categories'
import type { Product, CreateProductRequest } from '../../types/product'
import { formatCurrency, formatDateTime } from '../../utils/format'

type MainTab = 'catalog' | 'mapping'
type SortKey = 'revenue' | 'units' | 'stock' | 'name'
type LinkFilter = 'all' | 'linked' | 'unlinked'

const PAGE_SIZE = 50
const CATALOG_PAGE_SIZE = 24

function totalStock(p: Product): number {
  return p.variants.reduce((sum, v) => sum + v.stockQuantity, 0)
}

export default function OnlineProductsPage() {
  const [tab, setTab] = useState<MainTab>('catalog')

  return (
    <div className="flex flex-col flex-1">
      <Header title="Produits en ligne" />
      <div className="px-6 pt-5">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('catalog')}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'catalog' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Catalogue &amp; Analytique
          </button>
          <button
            onClick={() => setTab('mapping')}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'mapping' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Association manuelle Shopify
          </button>
        </div>
      </div>

      {tab === 'catalog' ? <CatalogAnalyticsView /> : <ManualMappingView />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Catalog & Analytics — the new default "online store" experience
// ══════════════════════════════════════════════════════════════

function CatalogAnalyticsView() {
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState<Record<number, OnlineProductStats>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all')
  const [soldOnlineOnly, setSoldOnlineOnly] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('revenue')
  const [page, setPage] = useState(1)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, s] = await Promise.all([productsApi.getAll(), productsApi.getOnlineStats()])
      setProducts(p)
      setStats(Object.fromEntries(s.map((x) => [x.productId, x])))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { categoriesApi.getAll().then(setCategories).catch(() => {}) }, [])

  const kpis = useMemo(() => {
    const values = Object.values(stats)
    const totalRevenue = values.reduce((sum, s) => sum + s.revenue, 0)
    const totalUnits = values.reduce((sum, s) => sum + s.unitsSold, 0)
    const soldCount = values.length
    const neverSold = products.length - soldCount

    const revenueByCategory: Record<string, number> = {}
    for (const p of products) {
      const s = stats[p.id]
      if (!s) continue
      revenueByCategory[p.categoryName] = (revenueByCategory[p.categoryName] ?? 0) + s.revenue
    }
    const topCategory = Object.entries(revenueByCategory).sort((a, b) => b[1] - a[1])[0]

    return { totalRevenue, totalUnits, neverSold, topCategory }
  }, [stats, products])

  const maxRevenue = useMemo(() => Math.max(1, ...Object.values(stats).map((s) => s.revenue)), [stats])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let list = products.filter((p) => {
      if (q && !(p.name.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q))) return false
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false
      if (soldOnlineOnly && !stats[p.id]) return false
      return true
    })

    list = [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name)
      if (sortKey === 'stock') return totalStock(b) - totalStock(a)
      if (sortKey === 'units') return (stats[b.id]?.unitsSold ?? 0) - (stats[a.id]?.unitsSold ?? 0)
      return (stats[b.id]?.revenue ?? 0) - (stats[a.id]?.revenue ?? 0)
    })

    return list
  }, [products, search, categoryFilter, soldOnlineOnly, sortKey, stats])

  useEffect(() => { setPage(1) }, [search, categoryFilter, soldOnlineOnly, sortKey])

  const pageCount = Math.max(1, Math.ceil(filtered.length / CATALOG_PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const paged = filtered.slice((currentPage - 1) * CATALOG_PAGE_SIZE, currentPage * CATALOG_PAGE_SIZE)

  const handleUpdate = async (data: CreateProductRequest) => {
    if (!editingProduct) return
    try {
      await productsApi.update(editingProduct.id, {
        name: data.name, description: data.description, brand: data.brand, imageUrl: data.imageUrl,
        price: data.price, costPrice: data.costPrice, liquidationPrice: data.liquidationPrice,
        onlinePrice: data.onlinePrice, categoryId: data.categoryId, fournisseurId: data.fournisseurId,
      })
      showToast('Produit mis à jour', 'success')
      setEditingProduct(null)
      load()
    } catch {
      showToast('Erreur', 'error')
    }
  }

  const refreshProduct = useCallback(async (productId: number) => {
    try {
      const updated = await productsApi.getById(productId)
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)))
      setEditingProduct((prev) => (prev?.id === productId ? updated : prev))
    } catch { /* ignore */ }
  }, [])

  return (
    <div className="flex-1 flex flex-col">
      {/* Hero / KPI band — visually distinct from the local store's plain white grid */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 px-6 py-6 mt-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiTile label="Chiffre d'affaires en ligne" value={formatCurrency(kpis.totalRevenue)} accent="emerald" />
          <KpiTile label="Unités vendues en ligne" value={String(kpis.totalUnits)} accent="cyan" />
          <KpiTile label="Meilleure catégorie" value={kpis.topCategory ? kpis.topCategory[0] : '—'} sub={kpis.topCategory ? formatCurrency(kpis.topCategory[1]) : undefined} accent="violet" />
          <KpiTile label="Jamais vendus en ligne" value={String(kpis.neverSold)} accent="amber" />
        </div>
      </div>

      <div className="p-6 flex-1 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[220px] max-w-md px-3.5 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Toutes catégories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="revenue">Trier: Revenu en ligne</option>
            <option value="units">Trier: Unités vendues</option>
            <option value="stock">Trier: Stock disponible</option>
            <option value="name">Trier: Nom</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={soldOnlineOnly} onChange={(e) => setSoldOnlineOnly(e.target.checked)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            Vendus en ligne uniquement
          </label>
          <span className="text-xs text-slate-400 ml-auto">{filtered.length} produit(s)</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-white border border-slate-200 rounded-lg">Aucun produit</div>
        ) : (
          <>
          <div className="space-y-2">
            {paged.map((p, idx) => {
              const rank = (currentPage - 1) * CATALOG_PAGE_SIZE + idx
              const s = stats[p.id]
              const stock = totalStock(p)
              const revenuePct = s ? Math.round((s.revenue / maxRevenue) * 100) : 0

              return (
                <div
                  key={p.id}
                  onClick={() => setEditingProduct(p)}
                  className="group bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-4 cursor-pointer hover:border-emerald-300 hover:shadow-sm transition-all"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-16 h-16 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    {rank < 3 && s && (
                      <span className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white ${
                        rank === 0 ? 'bg-amber-500' : rank === 1 ? 'bg-slate-400' : 'bg-orange-700'
                      }`}>
                        {rank + 1}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                      {p.shopifyProductId && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">Shopify</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{p.categoryName} {p.brand ? `· ${p.brand}` : ''}</p>
                    <div className="mt-1.5 h-1.5 w-full max-w-xs bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" style={{ width: `${revenuePct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-shrink-0 text-right">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Revenu en ligne</p>
                      <p className="text-sm font-semibold text-slate-900">{s ? formatCurrency(s.revenue) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Unités</p>
                      <p className="text-sm font-medium text-slate-700">{s?.unitsSold ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Stock</p>
                      <p className={`text-sm font-medium ${stock <= 0 ? 'text-red-600' : stock <= 10 ? 'text-amber-600' : 'text-slate-700'}`}>{stock}</p>
                    </div>
                    <div className="hidden lg:block">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Dernière commande</p>
                      <p className="text-sm text-slate-500">{s?.lastOrderAt ? formatDateTime(s.lastOrderAt) : '—'}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40">Précédent</button>
              <span className="text-sm text-slate-500 px-2">Page {currentPage} / {pageCount}</span>
              <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount} className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40">Suivant</button>
            </div>
          )}
          </>
        )}
      </div>

      {editingProduct && (
        <ProductForm
          product={editingProduct}
          onSubmit={handleUpdate}
          onCancel={() => setEditingProduct(null)}
          onProductUpdated={() => refreshProduct(editingProduct.id)}
        />
      )}
    </div>
  )
}

function KpiTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: 'emerald' | 'cyan' | 'violet' | 'amber' }) {
  const ring = {
    emerald: 'from-emerald-400/20 to-emerald-400/0 ring-emerald-400/30',
    cyan: 'from-cyan-400/20 to-cyan-400/0 ring-cyan-400/30',
    violet: 'from-violet-400/20 to-violet-400/0 ring-violet-400/30',
    amber: 'from-amber-400/20 to-amber-400/0 ring-amber-400/30',
  }[accent]

  return (
    <div className={`rounded-xl p-4 bg-gradient-to-br ${ring} ring-1 backdrop-blur-sm`}>
      <p className="text-[11px] font-medium text-slate-300 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-white mt-1 truncate">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Manual Shopify mapping — the original lightweight linking tool
// ══════════════════════════════════════════════════════════════

function ManualMappingView() {
  const [mappings, setMappings] = useState<ShopifyProductMapping[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all')
  const [page, setPage] = useState(1)
  const [form, setForm] = useState({ shopifyProductId: '', shopifyVariantId: '', title: '', sku: '', price: '', localProductId: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [m, p] = await Promise.all([shopifyApi.getProductMappings(), productsApi.getAll()])
      setMappings(m)
      setProducts(p)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const resetForm = () => setForm({ shopifyProductId: '', shopifyVariantId: '', title: '', sku: '', price: '', localProductId: '' })

  const handleAdd = async () => {
    if (!form.shopifyProductId || !form.shopifyVariantId || !form.title) {
      showToast('Renseignez au moins l\'ID produit, l\'ID variante et le titre', 'error')
      return
    }
    setSaving(true)
    try {
      await shopifyApi.createProductMapping({
        shopifyProductId: Number(form.shopifyProductId),
        shopifyVariantId: Number(form.shopifyVariantId),
        title: form.title,
        sku: form.sku || undefined,
        price: Number(form.price) || 0,
        localProductId: form.localProductId ? Number(form.localProductId) : undefined,
      })
      showToast('Association créée', 'success')
      setShowAdd(false)
      resetForm()
      load()
    } catch {
      showToast('Erreur lors de la création', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleLink = async (mapping: ShopifyProductMapping, localProductId: string) => {
    try {
      await shopifyApi.linkProductMapping(mapping.id, localProductId ? Number(localProductId) : null)
      showToast('Association mise à jour', 'success')
      load()
    } catch {
      showToast('Erreur', 'error')
    }
  }

  const handleDelete = async (mapping: ShopifyProductMapping) => {
    if (!confirm(`Supprimer l'association "${mapping.title}" ?`)) return
    try {
      await shopifyApi.deleteProductMapping(mapping.id)
      showToast('Association supprimée', 'success')
      load()
    } catch {
      showToast('Erreur', 'error')
    }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const result = await shopifyApi.importProducts()
      if (!result.configured) {
        showToast('Shopify non configuré — enregistrez vos identifiants dans Paramètres', 'error')
        return
      }
      showToast(`Import terminé : ${result.created} nouveaux, ${result.updated} mis à jour, ${result.autoLinked} liés automatiquement (sur ${result.totalVariants} variantes)`, 'success')
      load()
    } catch {
      showToast('Erreur lors de l\'import Shopify', 'error')
    } finally {
      setImporting(false)
    }
  }

  const unlinkedCount = mappings.filter((m) => !m.localProductId).length

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return mappings.filter((m) => {
      if (q && !(m.title.toLowerCase().includes(q) || (m.sku ?? '').toLowerCase().includes(q))) return false
      if (linkFilter === 'linked' && !m.localProductId) return false
      if (linkFilter === 'unlinked' && m.localProductId) return false
      return true
    })
  }, [mappings, search, linkFilter])

  useEffect(() => { setPage(1) }, [search, linkFilter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="p-6 flex-1 space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        Le catalogue complet (images, couleurs, tailles, stock) est géré depuis l'onglet <span className="font-medium">Catalogue &amp; Analytique</span> ci-dessus.
        Cette table sert uniquement à l'association manuelle fine par référence Shopify brute.
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500">{mappings.length} produit(s) Shopify référencé(s)</p>
          {unlinkedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
              {unlinkedCount} non associé(s)
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-3.5 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 disabled:opacity-50"
          >
            {importing ? 'Import en cours…' : '↻ Importer depuis Shopify'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="px-3.5 py-2 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
          >
            + Associer un produit Shopify
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Rechercher par titre ou SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[240px] max-w-md px-3.5 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {([
            { key: 'all', label: 'Tous' },
            { key: 'linked', label: 'Associés' },
            { key: 'unlinked', label: 'Non associés' },
          ] as { key: LinkFilter; label: string }[]).map((f) => (
            <button
              key={f.key}
              onClick={() => setLinkFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                linkFilter === f.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} résultat(s)</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-lg">
          <p className="text-sm text-slate-500 mb-1">
            {mappings.length === 0 ? 'Aucun produit Shopify associé pour le moment.' : 'Aucun résultat pour ces filtres.'}
          </p>
        </div>
      ) : (
        <>
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Produit Shopify</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">SKU</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Prix Shopify</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Produit local</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Synchronisé</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{m.title}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 font-mono">{m.sku || '—'}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-900">
                    {formatCurrency(m.price)}
                    {m.priceMismatch && <span className="ml-1.5 text-[10px] text-amber-600" title="Différent du prix local">⚠</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <select
                      value={m.localProductId ?? ''}
                      onChange={(e) => handleLink(m, e.target.value)}
                      className="text-sm border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">— Non associé —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{formatDateTime(m.syncedAt)}</td>
                  <td className="px-4 py-3 text-sm text-center">
                    <button onClick={() => handleDelete(m)} className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50">
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40">Précédent</button>
            <span className="text-sm text-slate-500 px-2">Page {currentPage} / {pageCount}</span>
            <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount} className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40">Suivant</button>
          </div>
        )}
        </>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-[480px] border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-base font-semibold text-slate-900">Associer un produit Shopify</h3>
              <button onClick={() => { setShowAdd(false); resetForm() }} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ID produit Shopify</label>
                  <input type="number" value={form.shopifyProductId} onChange={(e) => setForm({ ...form, shopifyProductId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ID variante Shopify</label>
                  <input type="number" value={form.shopifyVariantId} onChange={(e) => setForm({ ...form, shopifyVariantId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Titre</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">SKU</label>
                  <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Prix Shopify</label>
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Produit local (optionnel)</label>
                <select value={form.localProductId} onChange={(e) => setForm({ ...form, localProductId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">— Non associé —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => { setShowAdd(false); resetForm() }} className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-md">
                Annuler
              </button>
              <button onClick={handleAdd} disabled={saving} className="px-3.5 py-2 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Création…' : 'Créer l\'association'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
