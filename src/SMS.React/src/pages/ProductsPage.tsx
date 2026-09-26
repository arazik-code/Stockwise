import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Barcode, ImageOff, Package, Plus, Printer, RefreshCw, Search, Trash2, X } from 'lucide-react'
import ProductForm from '../components/products/ProductForm'
import { printLabels, type LabelSizeCode } from '../components/products/BarcodeLabel'
import { productsApi } from '../api/products'
import { categoriesApi, type Category } from '../api/categories'
import { shopifyApi } from '../api/shopify'
import { showToast } from '../components/shared/Toast'
import { formatCurrency } from '../utils/format'
import {
  Badge, Button, Card, Checkbox, EmptyState, IconButton, Input, Modal, Page,
  Pagination, Select, SkeletonCards, StatusBadge, Tabs, Toolbar, cn,
} from '../components/ui'
import { listItem } from '../design/variants'
import type { Product, CreateProductRequest } from '../types/product'

type StockFilter = 'all' | 'inStock' | 'low' | 'out'

const PAGE_SIZE = 48

function totalStock(p: Product): number {
  return p.variants.reduce((sum, v) => sum + v.stockQuantity, 0)
}

const placeholderIcon = <ImageOff className="h-10 w-10 text-fg-subtle" aria-hidden="true" />

/**
 * ══ CATALOG ARCHETYPE - GOLDEN REFERENCE ════════════════════════════════════
 *
 * Copy this page's structure for every image-led grid (OnlineProducts, and any
 * future browse-by-picture screen).
 *
 * The pattern, in order:
 *   <Page section=… title=… actions=…>     section supplies the accent + hue
 *     <Toolbar>                            search, category, segmented filters
 *     loading / empty                      designed states (see the note below)
 *     grid of <Card interactive>           image first, meta second
 *     <Pagination>
 *
 * Why the card is a <Card interactive> and not a styled div: the spring
 * hover-lift, the press feedback and the hue-tinted shadow all come free and
 * identically everywhere. The only motion this page adds on top is the image's
 * own `group-hover:scale-105`, retimed onto duration-base/ease-out-soft so the
 * picture and the card lift on the same clock instead of racing each other.
 *
 * ── On the entrance stagger ─────────────────────────────────────────────────
 *
 * The catalog archetype's entrance is `stagger`, but the page renders 48 cards.
 * CONTRACT §4 caps animated items at ~12, so only the first row-and-a-bit
 * animate in and the rest mount plain. The stagger is what the eye reads at the
 * top of the viewport; below the fold it is pure cost.
 *
 * ── On the missing error state ──────────────────────────────────────────────
 *
 * CONTRACT §3 wants three states. This page has two, because `loadProducts`
 * carries no error flag and adding one is a change above `return (`. Same
 * situation as the golden ledger page. Escalated, not improvised.
 *
 * ── On the <=10 "low stock" threshold ───────────────────────────────────────
 *
 * The predicate below is byte-for-byte the one the old `stockBadge()` helper
 * used, and it deliberately DISAGREES with StockPage (per-item reorder level)
 * and DashboardPage (<=3). Only the LOOK is unified, through the stockLevel
 * registry. A restyle must never silently redefine a business rule.
 */
export default function ProductsPage() {
  const { t } = useTranslation()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [batchProduct, setBatchProduct] = useState<Product | null>(null)
  const [selectedVariants, setSelectedVariants] = useState<Set<number>>(new Set())
  const [labelSize, setLabelSize] = useState<LabelSizeCode>('50x25')
  const [copies, setCopies] = useState(1)
  const [page, setPage] = useState(1)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await productsApi.getAll()
      setProducts(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])
  useEffect(() => { categoriesApi.getAll().then(setCategories).catch(() => {}) }, [])

  const handleImportCatalog = async () => {
    setImporting(true)
    try {
      const result = await shopifyApi.importCatalog()
      if (!result.configured) {
        showToast('Shopify non configuré — enregistrez vos identifiants dans Paramètres', 'error')
        return
      }
      showToast(
        `Catalogue importé : ${result.productsCreated} produits créés, ${result.productsUpdated} mis à jour (${result.variantsCreated + result.variantsUpdated} variantes)${result.barcodesGenerated ? `, ${result.barcodesGenerated} codes-barres générés` : ''}`,
        'success'
      )
      loadProducts()
    } catch {
      showToast("Erreur lors de l'import du catalogue Shopify", 'error')
    } finally {
      setImporting(false)
    }
  }

  const [generatingBarcodes, setGeneratingBarcodes] = useState(false)
  const handleGenerateBarcodes = async () => {
    setGeneratingBarcodes(true)
    try {
      const r = await productsApi.generateMissingBarcodes()
      showToast(r.generated > 0 ? `${r.generated} codes-barres EAN-13 générés` : 'Tous les produits ont déjà un code-barres', 'success')
      loadProducts()
    } catch {
      showToast('Erreur lors de la génération des codes-barres', 'error')
    } finally {
      setGeneratingBarcodes(false)
    }
  }

  const handleCreate = async (data: CreateProductRequest, imageFile: File | null) => {
    try {
      const created = await productsApi.create(data)
      if (imageFile) {
        try {
          await productsApi.uploadImage(created.id, imageFile)
        } catch {
          showToast(t('products.imageUploadError'), 'warning')
        }
      }
      showToast(t('products.createSuccess'), 'success')
      setShowForm(false)
      loadProducts()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleUpdate = async (data: CreateProductRequest, imageFile: File | null) => {
    if (!editingProduct) return
    try {
      await productsApi.update(editingProduct.id, {
        name: data.name,
        description: data.description,
        brand: data.brand,
        imageUrl: data.imageUrl,
        price: data.price,
        costPrice: data.costPrice,
        liquidationPrice: data.liquidationPrice,
        onlinePrice: data.onlinePrice,
        categoryId: data.categoryId,
        fournisseurId: data.fournisseurId,
      })
      if (imageFile) {
        try {
          await productsApi.uploadImage(editingProduct.id, imageFile)
        } catch {
          showToast(t('products.imageUploadError'), 'warning')
        }
      }
      showToast(t('products.updateSuccess'), 'success')
      setEditingProduct(null)
      setShowForm(false)
      loadProducts()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('common.confirm'))) return
    try {
      await productsApi.delete(id)
      showToast(t('products.deleteSuccess'), 'success')
      loadProducts()
    } catch {
      showToast(t('products.deleteFailed'), 'error')
    }
  }

  const openBatchPrint = (product: Product) => {
    setBatchProduct(product)
    const allIds = new Set(product.variants.filter(v => v.barcode).map(v => v.id))
    setSelectedVariants(allIds)
  }

  const refreshProduct = useCallback(async (productId: number) => {
    try {
      const updated = await productsApi.getById(productId)
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)))
      setEditingProduct((prev) => (prev?.id === productId ? updated : prev))
    } catch {
      // ignore
    }
  }, [])

  const toggleVariant = (id: number) => {
    setSelectedVariants((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (!batchProduct) return
    const barcodes = batchProduct.variants.filter(v => v.barcode)
    if (selectedVariants.size === barcodes.length) {
      setSelectedVariants(new Set())
    } else {
      setSelectedVariants(new Set(barcodes.map(v => v.id)))
    }
  }

  const handleBatchPrint = () => {
    if (!batchProduct) return
    const variants = batchProduct.variants
      .filter(v => selectedVariants.has(v.id))
      .map(v => ({ ...v, productName: batchProduct.name }))
    printLabels(variants, labelSize, copies)
    setBatchProduct(null)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter((p) => {
      if (q && !(
        p.name.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.variants.some(v => v.sku.toLowerCase().includes(q) || (v.barcode && v.barcode.toLowerCase().includes(q)))
      )) return false

      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false

      if (stockFilter !== 'all') {
        const stock = totalStock(p)
        if (stockFilter === 'out' && stock > 0) return false
        if (stockFilter === 'low' && (stock <= 0 || stock > 10)) return false
        if (stockFilter === 'inStock' && stock <= 0) return false
      }

      return true
    })
  }, [products, search, categoryFilter, stockFilter])

  useEffect(() => { setPage(1) }, [search, categoryFilter, stockFilter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <Page
      section="products"
      className="local-products"
      title={t('products.title')}
      actions={
        <>
          <Button
            size="sm"
            variant="soft"
            onClick={handleImportCatalog}
            disabled={importing}
            loading={importing}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            {importing ? 'Import en cours…' : 'Importer depuis Shopify'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateBarcodes}
            disabled={generatingBarcodes}
            loading={generatingBarcodes}
            icon={<Barcode className="h-3.5 w-3.5" />}
            title="Générer des codes-barres EAN-13 pour les produits/variantes qui n'en ont pas"
          >
            {generatingBarcodes ? 'Génération…' : 'Générer codes-barres'}
          </Button>
          <Button
            size="sm"
            onClick={() => { setEditingProduct(null); setShowForm(true) }}
            icon={<Plus className="h-4 w-4" />}
          >
            {t('products.add')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Toolbar className="local-toolbar">
          <Input
            type="text"
            placeholder={t('products.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leading={<Search />}
            size="sm"
            wrapperClassName="min-w-[240px] max-w-md flex-1"
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
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <Tabs<StockFilter>
            variant="segmented"
            size="sm"
            layoutGroupId="products-stock"
            value={stockFilter}
            onChange={setStockFilter}
            items={[
              { value: 'all', label: 'Tous' },
              { value: 'inStock', label: 'En stock' },
              { value: 'low', label: 'Stock bas' },
              { value: 'out', label: 'Rupture' },
            ]}
          />

          {!loading && (
            <Badge tone="neutral" size="sm" className="ml-auto">
              <span className="num">{filtered.length.toLocaleString('fr-FR')}</span>
              &nbsp;produit(s)
            </Badge>
          )}
        </Toolbar>

        {loading ? (
          <SkeletonCards count={12} className="sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" />
        ) : filtered.length === 0 ? (
          <div className="surface-glass">
            <EmptyState
              icon={Package}
              variant={search || categoryFilter !== 'all' || stockFilter !== 'all' ? 'search' : 'default'}
              title={search || categoryFilter !== 'all' || stockFilter !== 'all' ? 'Aucun produit trouvé' : t('products.noProducts')}
              description={
                search || categoryFilter !== 'all' || stockFilter !== 'all'
                  ? 'Essayez un autre nom, SKU, catégorie ou niveau de stock.'
                  : 'Ajoutez un produit ou importez votre catalogue Shopify.'
              }
            />
          </div>
        ) : (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {paged.map((p, i) => {
              const stock = totalStock(p)
              const colors = Array.from(new Map(p.variants.map(v => [v.colorId, v])).values()).slice(0, 5)
              const extraColors = new Set(p.variants.map(v => v.colorId)).size - colors.length
              const sizes = Array.from(new Set(p.variants.map(v => v.sizeValue))).slice(0, 6)
              const extraSizes = new Set(p.variants.map(v => v.sizeValue)).size - sizes.length

              return (
                <Card
                  key={p.id}
                  interactive
                  padded={false}
                  variants={i < 12 ? listItem : undefined}
                  initial={i < 12 ? 'initial' : false}
                  animate={i < 12 ? 'animate' : undefined}
                  custom={i}
                  onClick={() => { setEditingProduct(p); setShowForm(true) }}
                  className="group flex flex-col overflow-hidden"
                >
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-sunken">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-base ease-out-soft group-hover:scale-105"
                      />
                    ) : placeholderIcon}

                    {p.isShopifyLinked && (
                      <Badge tone="special" size="xs" className="absolute left-2 top-2 shadow-e1">
                        Shopify
                      </Badge>
                    )}
                    {!p.isActive && (
                      <Badge tone="muted" size="xs" className="absolute right-2 top-2 shadow-e1">
                        Inactif
                      </Badge>
                    )}

                    <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 p-2 opacity-0 transition-opacity duration-base ease-out-soft group-hover:opacity-100">
                      {p.variants.some(v => v.barcode) && (
                        <IconButton
                          icon={<Printer className="h-3.5 w-3.5" />}
                          label={t('products.batchPrintLabels')}
                          size="xs"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); openBatchPrint(p) }}
                        />
                      )}
                      <IconButton
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        label={t('common.delete')}
                        size="xs"
                        variant="outline"
                        className="hover:text-[var(--negative)]"
                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <p className="text-xs text-fg-subtle">{p.categoryName || '—'}</p>
                    <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-fg">{p.name}</h3>

                    <div className="mt-0.5 flex items-baseline gap-1.5">
                      <span className="num text-sm font-semibold text-fg">{formatCurrency(p.price)}</span>
                      {p.liquidationPrice && (
                        <span className="num text-xs text-fg-subtle line-through">{formatCurrency(p.liquidationPrice)}</span>
                      )}
                    </div>

                    {colors.length > 0 && (
                      <div className="mt-1 flex items-center gap-1">
                        {colors.map((v) => (
                          <span
                            key={v.colorId}
                            title={v.colorName}
                            className="h-3.5 w-3.5 flex-shrink-0 rounded-chip border border-border"
                            /* Real product colours from the database - data, not
                               design tokens. These stay inline by design. */
                            style={{ backgroundColor: v.colorHexCode }}
                          />
                        ))}
                        {extraColors > 0 && <span className="num text-[10px] text-fg-subtle">+{extraColors}</span>}
                      </div>
                    )}

                    {sizes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {sizes.map((s) => (
                          <span key={s} className="num rounded-inset bg-sunken px-1.5 py-0.5 text-[10px] text-fg-muted">{s}</span>
                        ))}
                        {extraSizes > 0 && <span className="num px-1.5 py-0.5 text-[10px] text-fg-subtle">+{extraSizes}</span>}
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      {/* Predicate unchanged from the old stockBadge() helper. */}
                      <StatusBadge
                        domain="stockLevel"
                        value={stock <= 0 ? 'out' : stock <= 10 ? 'low' : 'ok'}
                        size="xs"
                        showIcon={false}
                        animate={false}
                      />
                      <span className="text-[11px] text-fg-subtle">
                        <span className="num">{stock}</span> · <span className="num">{p.variants.length}</span> var.
                      </span>
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
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          )}
          </>
        )}
      </div>

      {showForm && (
        <ProductForm
          product={editingProduct}
          onSubmit={editingProduct ? handleUpdate : handleCreate}
          onCancel={() => { setEditingProduct(null); setShowForm(false) }}
          onProductUpdated={editingProduct ? () => refreshProduct(editingProduct.id) : undefined}
        />
      )}

      {/* closeOnEsc stays false: this page binds no Escape handler of its own,
          but ProductForm (rendered above from the same page) owns Escape while
          it is open, and the two are one keypress apart. Left to the explicit
          close affordances. */}
      <Modal
        open={!!batchProduct}
        onClose={() => setBatchProduct(null)}
        size="2xl"
        title={t('products.batchPrintLabels')}
        description={batchProduct?.name}
        bodyClassName="p-0"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setBatchProduct(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              icon={<Printer className="h-3.5 w-3.5" />}
              onClick={handleBatchPrint}
              disabled={selectedVariants.size === 0}
            >
              {t('products.printSelected')} (<span className="num">{selectedVariants.size}</span>)
            </Button>
          </>
        }
      >
        {batchProduct && (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-border bg-sunken px-5 py-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg">
                <Checkbox
                  checked={batchProduct.variants.filter(v => v.barcode).length > 0 && selectedVariants.size === batchProduct.variants.filter(v => v.barcode).length}
                  onChange={toggleAll}
                />
                {t('products.allVariantsSelected')}
              </label>
              <span className="num text-xs text-fg-subtle">
                {t('products.selectedCount', { count: selectedVariants.size })}
              </span>
            </div>

            <div className="flex flex-wrap items-end gap-4 border-b border-border bg-sunken px-5 py-3">
              <Select
                size="sm"
                label={t('printer.labelSize')}
                wrapperClassName="w-40"
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as LabelSizeCode)}
              >
                <option value="50x25">50 x 25 mm</option>
                <option value="40x30">40 x 30 mm</option>
                <option value="60x40">60 x 40 mm</option>
                <option value="70x50">70 x 50 mm</option>
                <option value="100x50">100 x 50 mm</option>
              </Select>
              <Input
                size="sm"
                type="number"
                min={1}
                max={99}
                label={t('printer.copies')}
                wrapperClassName="w-24"
                className="num text-center"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div className="space-y-2 px-5 py-4">
              {batchProduct.variants.map((v) => {
                const hasBarcode = !!v.barcode
                return (
                  <label
                    key={v.id}
                    className={cn(
                      'flex items-center gap-4 rounded-card border p-3 transition-colors duration-fast ease-out-soft',
                      !hasBarcode
                        ? 'cursor-not-allowed border-border bg-sunken opacity-50'
                        : selectedVariants.has(v.id)
                          ? 'cursor-pointer border-[var(--accent)] bg-[var(--accent-soft)]'
                          : 'cursor-pointer border-border hover:border-border-strong'
                    )}
                  >
                    <Checkbox
                      checked={selectedVariants.has(v.id)}
                      disabled={!hasBarcode}
                      onChange={() => toggleVariant(v.id)}
                    />
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-3 flex-shrink-0 rounded-chip border border-border"
                        style={{ backgroundColor: v.colorHexCode }}
                      />
                      <span className="text-sm text-fg">{v.colorName}</span>
                      <span className="text-sm text-fg-subtle">·</span>
                      <span className="num text-sm text-fg">{v.sizeValue}</span>
                    </div>
                    <span className="num ml-auto text-xs text-fg-subtle">{v.sku}</span>
                    {hasBarcode ? (
                      <span className="num text-xs text-fg-muted">{v.barcode}</span>
                    ) : (
                      <span className="text-xs text-[var(--negative)]">{t('products.noBarcode')}</span>
                    )}
                    <span className="num ml-2 text-sm font-medium text-fg">{formatCurrency(v.price)}</span>
                  </label>
                )
              })}
            </div>
          </>
        )}
      </Modal>
    </Page>
  )
}
