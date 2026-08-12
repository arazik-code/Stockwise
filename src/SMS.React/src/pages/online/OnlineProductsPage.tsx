import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  AlertTriangle, Award, ImageOff, Info, Package, PackageX, Plus, RefreshCw,
  Search, Trash2, TrendingUp, X,
} from 'lucide-react'
import ProductForm from '../../components/products/ProductForm'
import { showToast } from '../../components/shared/Toast'
import { shopifyApi, type ShopifyProductMapping } from '../../api/shopify'
import { productsApi, type OnlineProductStats } from '../../api/products'
import { categoriesApi, type Category } from '../../api/categories'
import type { Product, CreateProductRequest } from '../../types/product'
import { formatCurrency, formatDateTime } from '../../utils/format'
import {
  Badge, Button, Card, Checkbox, DataTable, EmptyState, IconButton, Input,
  Modal, Page, Pagination, ProgressBar, Select, SkeletonTable,
  StatCard, StatusBadge, Tabs, Toolbar, type Column,
} from '../../components/ui'

type MainTab = 'catalog' | 'mapping'
type SortKey = 'revenue' | 'units' | 'stock' | 'name'
type LinkFilter = 'all' | 'linked' | 'unlinked'

const PAGE_SIZE = 50
const CATALOG_PAGE_SIZE = 24

function totalStock(p: Product): number {
  return p.variants.reduce((sum, v) => sum + v.stockQuantity, 0)
}

const placeholderIcon = <ImageOff className="h-6 w-6 text-fg-subtle" aria-hidden="true" />

export default function OnlineProductsPage() {
  const [tab, setTab] = useState<MainTab>('catalog')

  return (
    <Page section="onlineProducts" title="Produits en ligne">
      <div className="mb-5">
        <Tabs<MainTab>
          variant="segmented"
          size="sm"
          layoutGroupId="online-products-main"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'catalog', label: 'Catalogue & Analytique' },
            { value: 'mapping', label: 'Association manuelle Shopify' },
          ]}
        />
      </div>

      {tab === 'catalog' ? <CatalogAnalyticsView /> : <ManualMappingView />}
    </Page>
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
    <div className="space-y-5">
      {/* KPI band — section hue + glass already make this read as "online", no
          bespoke gradient chrome needed. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Chiffre d'affaires en ligne"
          value={formatCurrency(kpis.totalRevenue)}
          icon={TrendingUp}
          tone="positive"
          loading={loading}
        />
        <StatCard
          label="Unités vendues en ligne"
          value={kpis.totalUnits.toLocaleString('fr-FR')}
          icon={Package}
          tone="info"
          loading={loading}
        />
        <StatCard
          label="Meilleure catégorie"
          value={kpis.topCategory ? kpis.topCategory[0] : '—'}
          sub={kpis.topCategory ? formatCurrency(kpis.topCategory[1]) : undefined}
          icon={Award}
          tone="special"
          loading={loading}
        />
        <StatCard
          label="Jamais vendus en ligne"
          value={kpis.neverSold.toLocaleString('fr-FR')}
          icon={PackageX}
          tone="caution"
          loading={loading}
        />
      </div>

      <Toolbar>
        <Input
          type="text"
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leading={<Search />}
          size="sm"
          wrapperClassName="min-w-[220px] max-w-md flex-1"
          trailing={
            search ? (
              <button
                onClick={() => setSearch('')}
                aria-label="Effacer"
                className="pointer-events-auto text-fg-subtle transition-colors hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            ) : undefined
          }
        />
        <Select
          size="sm"
          wrapperClassName="w-full sm:w-52"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        >
          <option value="all">Toutes catégories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select
          size="sm"
          wrapperClassName="w-full sm:w-56"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          <option value="revenue">Trier: Revenu en ligne</option>
          <option value="units">Trier: Unités vendues</option>
          <option value="stock">Trier: Stock disponible</option>
          <option value="name">Trier: Nom</option>
        </Select>
        <Checkbox
          checked={soldOnlineOnly}
          onChange={(e) => setSoldOnlineOnly(e.target.checked)}
          label="Vendus en ligne uniquement"
        />
        {!loading && (
          <Badge tone="neutral" size="sm" className="ml-auto">
            <span className="num">{filtered.length.toLocaleString('fr-FR')}</span>
            &nbsp;produit(s)
          </Badge>
        )}
      </Toolbar>

      {loading ? (
        <SkeletonTable rows={10} cols={6} />
      ) : filtered.length === 0 ? (
        <div className="surface-glass">
          <EmptyState
            icon={Package}
            variant={(search || categoryFilter !== 'all' || soldOnlineOnly) ? 'search' : 'default'}
            title={(search || categoryFilter !== 'all' || soldOnlineOnly) ? 'Aucun produit trouvé' : 'Aucun produit'}
            description={
              (search || categoryFilter !== 'all' || soldOnlineOnly)
                ? 'Essayez un autre nom, marque ou catégorie.'
                : 'Les produits apparaîtront ici une fois ajoutés au catalogue.'
            }
          />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paged.map((p, idx) => {
              const rank = (currentPage - 1) * CATALOG_PAGE_SIZE + idx
              const s = stats[p.id]
              const stock = totalStock(p)
              const revenuePct = s ? Math.round((s.revenue / maxRevenue) * 100) : 0

              return (
                <Card
                  key={p.id}
                  interactive
                  padded={false}
                  onClick={() => setEditingProduct(p)}
                  className="group flex items-center gap-4 p-3"
                >
                  <div className="relative flex-shrink-0">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-card border border-border bg-sunken">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : placeholderIcon}
                    </div>
                    {rank < 3 && s && (
                      <Badge
                        tone={rank === 0 ? 'caution' : rank === 1 ? 'neutral' : 'special'}
                        size="xs"
                        className="absolute -left-1.5 -top-1.5 h-5 w-5 justify-center rounded-chip p-0 shadow-e1"
                      >
                        {rank + 1}
                      </Badge>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-fg">{p.name}</p>
                      {p.shopifyProductId && <Badge tone="special" size="xs">Shopify</Badge>}
                    </div>
                    <p className="text-xs text-fg-subtle">{p.categoryName} {p.brand ? `· ${p.brand}` : ''}</p>
                    <ProgressBar value={revenuePct} tone="positive" size="sm" className="mt-1.5 max-w-xs" />
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-6 text-right">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-fg-subtle">Revenu en ligne</p>
                      <p className="num text-sm font-semibold text-fg">{s ? formatCurrency(s.revenue) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-fg-subtle">Unités</p>
                      <p className="num text-sm font-medium text-fg-muted">{s?.unitsSold ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-fg-subtle">Stock</p>
                      {/* Predicate unchanged from the old inline text-colour logic: <=0 out, <=10 low. */}
                      <StatusBadge
                        domain="stockLevel"
                        value={stock <= 0 ? 'out' : stock <= 10 ? 'low' : 'ok'}
                        size="xs"
                        showIcon={false}
                        animate={false}
                      />
                    </div>
                    <div className="hidden lg:block">
                      <p className="text-[10px] uppercase tracking-wide text-fg-subtle">Dernière commande</p>
                      <p className="text-sm text-fg-subtle">{s?.lastOrderAt ? formatDateTime(s.lastOrderAt) : '—'}</p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {pageCount > 1 && (
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              total={filtered.length}
              pageSize={CATALOG_PAGE_SIZE}
              onChange={setPage}
            />
          )}
        </>
      )}

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

  const columns: Column<ShopifyProductMapping>[] = [
    {
      key: 'title',
      header: 'Produit Shopify',
      render: (m) => <span className="font-medium text-fg">{m.title}</span>,
    },
    {
      key: 'sku',
      header: 'SKU',
      width: '8rem',
      render: (m) => <span className="num text-fg-muted">{m.sku || '—'}</span>,
    },
    {
      key: 'price',
      header: 'Prix Shopify',
      numeric: true,
      width: '9rem',
      render: (m) => (
        <span className="inline-flex items-center justify-end gap-1.5">
          <span className="num text-fg">{formatCurrency(m.price)}</span>
          {m.priceMismatch && (
            <span title="Différent du prix local">
              <AlertTriangle className="h-3.5 w-3.5 text-[var(--caution)]" />
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'local',
      header: 'Produit local',
      width: '16rem',
      render: (m) => (
        <Select size="sm" value={m.localProductId ?? ''} onChange={(e) => handleLink(m, e.target.value)}>
          <option value="">— Non associé —</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      ),
    },
    {
      key: 'synced',
      header: 'Synchronisé',
      width: '10rem',
      render: (m) => <span className="text-fg-subtle">{formatDateTime(m.syncedAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'center',
      width: '6rem',
      render: (m) => (
        <div className="flex justify-center">
          <IconButton
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label="Supprimer"
            size="xs"
            variant="danger-ghost"
            onClick={() => handleDelete(m)}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div
        role="status"
        data-tone="info"
        className="flex items-start gap-3 rounded-card border border-[color-mix(in_oklab,var(--tone)_28%,transparent)] bg-[var(--tone-soft)] px-4 py-3 text-sm text-[var(--tone-ink)]"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Le catalogue complet (images, couleurs, tailles, stock) est géré depuis l'onglet{' '}
          <span className="font-medium">Catalogue &amp; Analytique</span> ci-dessus.
          Cette table sert uniquement à l'association manuelle fine par référence Shopify brute.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-fg-subtle">
            <span className="num">{mappings.length}</span> produit(s) Shopify référencé(s)
          </p>
          {unlinkedCount > 0 && (
            <Badge tone="caution" size="sm">
              <span className="num">{unlinkedCount}</span>&nbsp;non associé(s)
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="soft"
            onClick={handleImport}
            disabled={importing}
            loading={importing}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            {importing ? 'Import en cours…' : 'Importer depuis Shopify'}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAdd(true)}
            icon={<Plus className="h-4 w-4" />}
          >
            Associer un produit Shopify
          </Button>
        </div>
      </div>

      <Toolbar>
        <Input
          type="text"
          placeholder="Rechercher par titre ou SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leading={<Search />}
          size="sm"
          wrapperClassName="min-w-[240px] max-w-md flex-1"
        />
        <Tabs<LinkFilter>
          variant="segmented"
          size="sm"
          layoutGroupId="online-products-mapping-filter"
          value={linkFilter}
          onChange={setLinkFilter}
          items={[
            { value: 'all', label: 'Tous' },
            { value: 'linked', label: 'Associés' },
            { value: 'unlinked', label: 'Non associés' },
          ]}
        />
        <Badge tone="neutral" size="sm" className="ml-auto">
          <span className="num">{filtered.length.toLocaleString('fr-FR')}</span>
          &nbsp;résultat(s)
        </Badge>
      </Toolbar>

      {loading ? (
        <SkeletonTable rows={8} cols={6} />
      ) : filtered.length === 0 ? (
        <div className="surface-glass">
          <EmptyState
            icon={Package}
            variant={search || linkFilter !== 'all' ? 'search' : 'default'}
            title={mappings.length === 0 ? 'Aucun produit Shopify associé' : 'Aucun résultat pour ces filtres'}
            description={
              mappings.length === 0
                ? "Importez votre catalogue Shopify ou créez une association manuelle."
                : 'Essayez un autre titre, SKU ou filtre.'
            }
          />
        </div>
      ) : (
        <>
          <DataTable<ShopifyProductMapping>
            columns={columns}
            data={paged}
            keyField={(m) => m.id}
          />
          {pageCount > 1 && (
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          )}
        </>
      )}

      {/* closeOnEsc stays false: this page binds no Escape handler of its own,
          and this modal has no in-flight state that a stray Escape could corrupt. */}
      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); resetForm() }}
        size="md"
        title="Associer un produit Shopify"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => { setShowAdd(false); resetForm() }}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={saving} loading={saving}>
              {saving ? 'Création…' : "Créer l'association"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="ID produit Shopify"
              type="number"
              size="sm"
              value={form.shopifyProductId}
              onChange={(e) => setForm({ ...form, shopifyProductId: e.target.value })}
            />
            <Input
              label="ID variante Shopify"
              type="number"
              size="sm"
              value={form.shopifyVariantId}
              onChange={(e) => setForm({ ...form, shopifyVariantId: e.target.value })}
            />
          </div>
          <Input
            label="Titre"
            type="text"
            size="sm"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="SKU"
              type="text"
              size="sm"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
            <Input
              label="Prix Shopify"
              type="number"
              step="0.01"
              size="sm"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <Select
            label="Produit local (optionnel)"
            size="sm"
            value={form.localProductId}
            onChange={(e) => setForm({ ...form, localProductId: e.target.value })}
          >
            <option value="">— Non associé —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
      </Modal>
    </div>
  )
}
