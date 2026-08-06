import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/layout/Header'
import ProductForm from '../components/products/ProductForm'
import { printLabels, type LabelSizeCode } from '../components/products/BarcodeLabel'
import { productsApi } from '../api/products'
import { categoriesApi, type Category } from '../api/categories'
import { shopifyApi } from '../api/shopify'
import { showToast } from '../components/shared/Toast'
import { formatCurrency } from '../utils/format'
import type { Product, CreateProductRequest } from '../types/product'

type StockFilter = 'all' | 'inStock' | 'low' | 'out'

const PAGE_SIZE = 48

function totalStock(p: Product): number {
  return p.variants.reduce((sum, v) => sum + v.stockQuantity, 0)
}

function stockBadge(qty: number) {
  if (qty <= 0) return { label: 'Rupture', className: 'bg-red-50 text-red-700 border-red-200' }
  if (qty <= 10) return { label: `${qty} en stock`, className: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { label: `${qty} en stock`, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
}

const placeholderIcon = (
  <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

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

  const handleCreate = async (data: CreateProductRequest) => {
    try {
      await productsApi.create(data)
      showToast(t('products.createSuccess'), 'success')
      setShowForm(false)
      loadProducts()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleUpdate = async (data: CreateProductRequest) => {
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
    <div className="flex flex-col flex-1">
      <Header
        title={t('products.title')}
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={handleImportCatalog}
              disabled={importing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-emerald-600" />
                  Import en cours…
                </>
              ) : (
                <>↻ Importer depuis Shopify</>
              )}
            </button>
            <button
              onClick={handleGenerateBarcodes}
              disabled={generatingBarcodes}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-md hover:bg-slate-200 transition-colors disabled:opacity-50"
              title="Générer des codes-barres EAN-13 pour les produits/variantes qui n'en ont pas"
            >
              {generatingBarcodes ? 'Génération…' : '▤ Générer codes-barres'}
            </button>
            <button
              onClick={() => { setEditingProduct(null); setShowForm(true) }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('products.add')}
            </button>
          </div>
        }
      />
      <div className="p-6 flex-1">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              placeholder={t('products.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Toutes catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {([
              { key: 'all', label: 'Tous' },
              { key: 'inStock', label: 'En stock' },
              { key: 'low', label: 'Stock bas' },
              { key: 'out', label: 'Rupture' },
            ] as { key: StockFilter; label: string }[]).map((f) => (
              <button
                key={f.key}
                onClick={() => setStockFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  stockFilter === f.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400 ml-auto">{filtered.length} produit(s)</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-sm text-slate-500">{t('common.loading')}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-sm">{search || categoryFilter !== 'all' || stockFilter !== 'all' ? 'Aucun produit trouvé' : 'Aucun produit'}</p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {paged.map((p) => {
              const stock = totalStock(p)
              const badge = stockBadge(stock)
              const colors = Array.from(new Map(p.variants.map(v => [v.colorId, v])).values()).slice(0, 5)
              const extraColors = new Set(p.variants.map(v => v.colorId)).size - colors.length
              const sizes = Array.from(new Set(p.variants.map(v => v.sizeValue))).slice(0, 6)
              const extraSizes = new Set(p.variants.map(v => v.sizeValue)).size - sizes.length

              return (
                <div
                  key={p.id}
                  onClick={() => { setEditingProduct(p); setShowForm(true) }}
                  className="group bg-white border border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:shadow-md hover:border-slate-300 transition-all flex flex-col"
                >
                  <div className="relative aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : placeholderIcon}

                    {p.shopifyProductId && (
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-600/90 text-white backdrop-blur-sm">
                        Shopify
                      </span>
                    )}
                    {!p.isActive && (
                      <span className="absolute top-2 right-2 inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-800/80 text-white">
                        Inactif
                      </span>
                    )}

                    <div className="absolute inset-x-0 bottom-0 p-2 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {p.variants.some(v => v.barcode) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openBatchPrint(p) }}
                          className="p-1.5 rounded-md bg-white/90 text-slate-600 hover:text-violet-600 shadow-sm backdrop-blur-sm"
                          title={t('products.batchPrintLabels')}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                        className="p-1.5 rounded-md bg-white/90 text-slate-600 hover:text-red-600 shadow-sm backdrop-blur-sm"
                        title={t('common.delete')}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="p-3 flex flex-col gap-1.5 flex-1">
                    <p className="text-xs text-slate-400">{p.categoryName || '—'}</p>
                    <h3 className="text-sm font-medium text-slate-900 leading-snug line-clamp-2 min-h-[2.5rem]">{p.name}</h3>

                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(p.price)}</span>
                      {p.liquidationPrice && (
                        <span className="text-xs text-slate-400 line-through">{formatCurrency(p.liquidationPrice)}</span>
                      )}
                    </div>

                    {colors.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {colors.map((v) => (
                          <span
                            key={v.colorId}
                            title={v.colorName}
                            className="w-3.5 h-3.5 rounded-full border border-slate-200 flex-shrink-0"
                            style={{ backgroundColor: v.colorHexCode }}
                          />
                        ))}
                        {extraColors > 0 && <span className="text-[10px] text-slate-400">+{extraColors}</span>}
                      </div>
                    )}

                    {sizes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {sizes.map((s) => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{s}</span>
                        ))}
                        {extraSizes > 0 && <span className="text-[10px] px-1.5 py-0.5 text-slate-400">+{extraSizes}</span>}
                      </div>
                    )}

                    <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${badge.className}`}>{badge.label}</span>
                      <span className="text-[11px] text-slate-400">{p.variants.length} var.</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              <span className="text-sm text-slate-500 px-2">Page {currentPage} / {pageCount}</span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage === pageCount}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
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

      {batchProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-slate-200 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{t('products.batchPrintLabels')}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{batchProduct.name}</p>
              </div>
              <button onClick={() => setBatchProduct(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={batchProduct.variants.filter(v => v.barcode).length > 0 && selectedVariants.size === batchProduct.variants.filter(v => v.barcode).length}
                  onChange={toggleAll}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {t('products.allVariantsSelected')}
              </label>
              <span className="text-xs text-slate-500">
                {t('products.selectedCount', { count: selectedVariants.size })}
              </span>
            </div>

            <div className="px-6 py-3 border-b border-slate-100 flex items-center flex-wrap gap-3 sm:gap-6 bg-slate-50">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600">{t('printer.labelSize')}</label>
                <select
                  value={labelSize}
                  onChange={(e) => setLabelSize(e.target.value as LabelSizeCode)}
                  className="px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="50x25">50 x 25 mm</option>
                  <option value="40x30">40 x 30 mm</option>
                  <option value="60x40">60 x 40 mm</option>
                  <option value="70x50">70 x 50 mm</option>
                  <option value="100x50">100 x 50 mm</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600">{t('printer.copies')}</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 px-2 py-1 text-xs border border-slate-200 rounded bg-white text-center focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {batchProduct.variants.map((v) => {
                const hasBarcode = !!v.barcode
                return (
                  <label
                    key={v.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                      !hasBarcode
                        ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                        : selectedVariants.has(v.id)
                          ? 'border-violet-200 bg-violet-50/50 cursor-pointer'
                          : 'border-slate-200 hover:border-slate-300 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedVariants.has(v.id)}
                      disabled={!hasBarcode}
                      onChange={() => toggleVariant(v.id)}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: v.colorHexCode }} />
                      <span className="text-sm text-slate-700">{v.colorName}</span>
                      <span className="text-sm text-slate-400">·</span>
                      <span className="text-sm text-slate-700">{v.sizeValue}</span>
                    </div>
                    <span className="text-xs font-mono text-slate-400 ml-auto">{v.sku}</span>
                    {hasBarcode ? (
                      <span className="text-xs font-mono text-slate-500">{v.barcode}</span>
                    ) : (
                      <span className="text-xs text-red-400">{t('products.noBarcode')}</span>
                    )}
                    <span className="text-sm font-medium text-slate-700 ml-2">{formatCurrency(v.price)}</span>
                  </label>
                )
              })}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setBatchProduct(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleBatchPrint}
                disabled={selectedVariants.size === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('products.printSelected')} ({selectedVariants.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
