import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { CreateProductRequest, Category, Product, ProductVariant } from '../../types/product'
import type { Color } from '../../types/color'
import type { Size } from '../../types/size'
import type { Fournisseur } from '../../types/fournisseur'
import { colorsApi } from '../../api/colors'
import { sizesApi } from '../../api/sizes'
import { productsApi } from '../../api/products'
import { stockApi } from '../../api/stock'
import { showToast } from '../shared/Toast'
import { printLabel, printProductBarcode } from './BarcodeLabel'
import api from '../../api/client'

interface ProductFormProps {
  product?: Product | null
  onSubmit: (data: CreateProductRequest) => void
  onCancel: () => void
  onProductUpdated?: () => void
}

function stockBadgeClass(qty: number) {
  if (qty <= 0) return 'text-red-600 font-semibold'
  if (qty <= 5) return 'text-amber-600 font-medium'
  return 'text-slate-700'
}

export default function ProductForm({ product, onSubmit, onCancel, onProductUpdated }: ProductFormProps) {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<Category[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [colors, setColors] = useState<Color[]>([])
  const [sizes, setSizes] = useState<Size[]>([])
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [editingInfo, setEditingInfo] = useState(false)
  const isEditing = !!product

  const [form, setForm] = useState<CreateProductRequest>({
    name: product?.name ?? '',
    description: product?.description ?? '',
    brand: product?.brand ?? undefined,
    imageUrl: product?.imageUrl ?? undefined,
    price: product?.price ?? 0,
    costPrice: product?.costPrice ?? undefined,
    liquidationPrice: product?.liquidationPrice ?? undefined,
    onlinePrice: product?.onlinePrice ?? undefined,
    categoryId: product?.categoryId ?? 0,
    fournisseurId: product?.fournisseurId ?? undefined,
  })

  // Inline variant editing state
  const [editingVariantId, setEditingVariantId] = useState<number | 'new' | null>(null)
  const [editForm, setEditForm] = useState<{
    colorId: number
    sizeId: number
    sku: string
    barcode: string
    isLiquidation: boolean
  }>({
    colorId: 0,
    sizeId: 0,
    sku: '',
    barcode: '',
    isLiquidation: false,
  })
  const [editQuantity, setEditQuantity] = useState<number>(0)

  useEffect(() => {
    if (product?.imageUrl) setImagePreview(product.imageUrl)
  }, [product])

  useEffect(() => {
    api.get('/categories').then((r) => setCategories(r.data)).catch(() => {})
    api.get('/fournisseurs').then((r) => setFournisseurs(r.data)).catch(() => {})
    colorsApi.getAll().then(setColors).catch(() => {})
    sizesApi.getAll().then(setSizes).catch(() => {})
  }, [])

  const handleChange = (field: string, value: string | number | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ ...form, imageUrl: imagePreview ?? undefined })
    if (isEditing) setEditingInfo(false)
  }

  // Inline variant handlers
  const startEditVariant = async (v: ProductVariant) => {
    setEditingVariantId(v.id)
    setEditForm({
      colorId: v.colorId,
      sizeId: v.sizeId,
      sku: v.sku,
      barcode: v.barcode ?? '',
      isLiquidation: v.isLiquidation,
    })
    try {
      const stock = await stockApi.getByVariant(v.id)
      setEditQuantity(stock.quantityOnHand)
    } catch {
      setEditQuantity(v.stockQuantity ?? 0)
    }
  }

  const startAddVariant = () => {
    setEditingVariantId('new')
    setEditForm({ colorId: 0, sizeId: 0, sku: '', barcode: '', isLiquidation: false })
    setEditQuantity(0)
  }

  const duplicateVariant = (v: ProductVariant) => {
    setEditingVariantId('new')
    setEditForm({ colorId: v.colorId, sizeId: v.sizeId, sku: '', barcode: '', isLiquidation: v.isLiquidation })
    setEditQuantity(0)
  }

  const cancelInlineEdit = () => {
    setEditingVariantId(null)
    setEditForm({ colorId: 0, sizeId: 0, sku: '', barcode: '', isLiquidation: false })
    setEditQuantity(0)
  }

  const handleSaveInlineVariant = async () => {
    if (!product) return
    if (!editForm.colorId || !editForm.sizeId) {
      showToast(t('common.error'), 'error')
      return
    }
    try {
      let variantId: number
      let isNewVariant = false
      if (editingVariantId === 'new') {
        const created = await productsApi.addVariant({
          productId: product.id,
          colorId: editForm.colorId,
          sizeId: editForm.sizeId,
          sku: editForm.sku || undefined,
          barcode: editForm.barcode || undefined,
          isLiquidation: editForm.isLiquidation,
          initialStock: editQuantity,
          reorderLevel: 5,
        })
        variantId = created.id
        isNewVariant = true
      } else if (typeof editingVariantId === 'number') {
        variantId = editingVariantId
        await productsApi.updateVariant(editingVariantId, {
          colorId: editForm.colorId,
          sizeId: editForm.sizeId,
          sku: editForm.sku || undefined,
          barcode: editForm.barcode || undefined,
          isLiquidation: editForm.isLiquidation,
        })
        await stockApi.setQuantity(variantId, editQuantity, 'Updated from product form')
      } else {
        return
      }
      showToast(t('common.success'), 'success')
      cancelInlineEdit()
      onProductUpdated?.()

      if (isNewVariant && variantId) {
        try {
          const { devicesApi } = await import('../../api/devices')
          const status = await devicesApi.getStatus()
          if (status.printer.online) {
            const res = await fetch(`/api/printer/variant/${variantId}/print`, { method: 'POST' })
            const data = await res.json()
            if (data.sent) {
              showToast(`✓ Étiquette envoyée à l'imprimante`, 'success')
            }
          }
        } catch {
          // Auto-print failed silently — non-critical
        }
      }
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleDeleteVariant = async (variantId: number) => {
    if (!confirm(t('common.confirm'))) return
    try {
      await productsApi.deleteVariant(variantId)
      showToast(t('common.success'), 'success')
      if (editingVariantId === variantId) cancelInlineEdit()
      onProductUpdated?.()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleToggleLiquidation = async (v: ProductVariant) => {
    try {
      await productsApi.updateVariant(v.id, { isLiquidation: !v.isLiquidation })
      showToast(t('common.success'), 'success')
      onProductUpdated?.()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const totalStock = product?.variants.reduce((sum, v) => sum + v.stockQuantity, 0) ?? 0

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[92vh] overflow-hidden border border-slate-200 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">
              {isEditing ? product!.name : t('products.add')}
            </h2>
            {isEditing && (
              <div className="flex items-center gap-2 mt-0.5">
                {product?.shopifyProductId && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Importé de Shopify
                  </span>
                )}
                {product?.barcode && (
                  <span className="text-[11px] font-mono text-slate-400">{product.barcode}</span>
                )}
              </div>
            )}
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Read view (existing product, not editing info) */}
          {isEditing && !editingInfo ? (
            <div className="p-6 grid grid-cols-[220px_1fr] gap-6">
              <div className="space-y-3">
                <div className="w-full aspect-square rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                  {imagePreview ? (
                    <img src={imagePreview} alt={form.name} className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                {product?.barcode && (
                  <button
                    type="button"
                    onClick={() => printProductBarcode({ name: product.name, barcode: product.barcode! })}
                    className="w-full text-xs font-medium text-slate-600 hover:text-blue-600 border border-slate-200 rounded-md py-1.5"
                  >
                    Imprimer code-barres
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Catégorie</p>
                    <p className="text-slate-800 font-medium">{categories.find(c => c.id === form.categoryId)?.name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Marque</p>
                    <p className="text-slate-800 font-medium">{form.brand || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Stock total</p>
                    <p className={`font-medium ${stockBadgeClass(totalStock)}`}>{totalStock}</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 text-sm bg-slate-50 rounded-lg p-3">
                  <div>
                    <p className="text-[11px] text-slate-400">Prix local (magasin)</p>
                    <p className="text-slate-900 font-semibold">{form.price.toFixed(2)} DH</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Prix en ligne</p>
                    <p className="text-emerald-700 font-semibold">{form.onlinePrice ? `${form.onlinePrice.toFixed(2)} DH` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Prix d'achat</p>
                    <p className="text-slate-700">{form.costPrice ? `${form.costPrice.toFixed(2)} DH` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Prix soldé</p>
                    <p className="text-slate-700">{form.liquidationPrice ? `${form.liquidationPrice.toFixed(2)} DH` : '—'}</p>
                  </div>
                </div>

                {form.description && (
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-4">{form.description}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setEditingInfo(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Modifier les informations
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('products.productImage')}</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="hidden" id="image-upload" />
                    <label htmlFor="image-upload" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      {t('products.chooseFile')}
                    </label>
                    <p className="text-xs text-slate-400 mt-1">{t('products.fileHint')}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('products.name')} *</label>
                <input
                  type="text" required value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('products.description')}</label>
                <textarea
                  value={form.description ?? ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('products.brand')}</label>
                  <input
                    type="text" value={form.brand ?? ''}
                    onChange={(e) => handleChange('brand', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('products.category')} *</label>
                  <select
                    required value={form.categoryId}
                    onChange={(e) => handleChange('categoryId', parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={0}>{t('products.selectCategory')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('products.fournisseur')}</label>
                <select
                  value={form.fournisseurId ?? ''}
                  onChange={(e) => handleChange('fournisseurId', parseInt(e.target.value) || undefined)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('products.fournisseur')}</option>
                  {fournisseurs.map((f) => (
                    <option key={f.id} value={f.id}>{f.nom}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Prix local (magasin) *</label>
                  <input
                    type="number" step="0.01" min="0" required value={form.price}
                    onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Prix en boutique physique (POS)</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('products.costPrice')}</label>
                  <input
                    type="number" step="0.01" min="0" value={form.costPrice ?? ''}
                    onChange={(e) => handleChange('costPrice', parseFloat(e.target.value) || undefined)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Prix d'achat fournisseur</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('products.liquidationPrice')}</label>
                  <input
                    type="number" step="0.01" min="0" value={form.liquidationPrice ?? ''}
                    onChange={(e) => handleChange('liquidationPrice', parseFloat(e.target.value) || undefined)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Prix soldé (variante liquidation)</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-emerald-600 mb-1.5">Prix en ligne</label>
                  <input
                    type="number" step="0.01" min="0" value={form.onlinePrice ?? ''}
                    onChange={(e) => handleChange('onlinePrice', parseFloat(e.target.value) || undefined)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Commandes Shopify/WhatsApp (sinon prix local)</p>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => (isEditing ? setEditingInfo(false) : onCancel())}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
                  {isEditing ? t('common.save') : t('products.add')}
                </button>
              </div>
            </form>
          )}

          {/* Variants Section — only when editing */}
          {isEditing && product && (
            <div className="px-6 pb-6 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900">{t('products.variants')} <span className="text-slate-400 font-normal">({product.variants.length})</span></h3>
                <button
                  type="button"
                  onClick={startAddVariant}
                  disabled={editingVariantId !== null}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('products.addVariant')}
                </button>
              </div>

              {product.variants.length === 0 && editingVariantId === null ? (
                <p className="text-sm text-slate-400 py-4 text-center">{t('products.noVariants')}</p>
              ) : (
                <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">{t('products.color')}</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">{t('products.size')}</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">{t('products.sku')}</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">{t('stock.onHand')}</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-slate-500">{t('products.liquidation')}</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-slate-500">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {product.variants.map((v) => {
                        const isEditingRow = editingVariantId === v.id
                        return (
                          <tr key={v.id} className={isEditingRow ? 'bg-blue-50/50' : 'hover:bg-white transition-colors'}>
                            <td className="px-3 py-2">
                              {isEditingRow ? (
                                <select
                                  value={editForm.colorId}
                                  onChange={(e) => setEditForm((p) => ({ ...p, colorId: parseInt(e.target.value) }))}
                                  className="w-full px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value={0}>{t('products.selectColor')}</option>
                                  {colors.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: v.colorHexCode }} />
                                  <span className="text-slate-700">{v.colorName}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isEditingRow ? (
                                <select
                                  value={editForm.sizeId}
                                  onChange={(e) => setEditForm((p) => ({ ...p, sizeId: parseInt(e.target.value) }))}
                                  className="w-full px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value={0}>{t('products.selectSize')}</option>
                                  {sizes.map((s) => (
                                    <option key={s.id} value={s.id}>{s.value}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-slate-700">{v.sizeValue}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isEditingRow ? (
                                <input
                                  type="text" value={editForm.sku}
                                  onChange={(e) => setEditForm((p) => ({ ...p, sku: e.target.value }))}
                                  placeholder="Auto"
                                  className="w-full px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                />
                              ) : (
                                <span className="font-mono text-slate-500 text-xs">{v.sku}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {isEditingRow ? (
                                <input
                                  type="number" min={0} value={editQuantity}
                                  onChange={(e) => setEditQuantity(parseInt(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                                />
                              ) : (
                                <span className={stockBadgeClass(v.stockQuantity)}>{v.stockQuantity}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {isEditingRow ? (
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox" checked={editForm.isLiquidation}
                                    onChange={(e) => setEditForm((p) => ({ ...p, isLiquidation: e.target.checked }))}
                                    className="sr-only peer"
                                  />
                                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                                </label>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleLiquidation(v)}
                                  disabled={editingVariantId !== null}
                                  className="relative inline-flex items-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={v.isLiquidation ? t('products.liquidationOn') : t('products.liquidationOff')}
                                >
                                  <div className={`w-9 h-5 rounded-full transition-colors ${v.isLiquidation ? 'bg-orange-500' : 'bg-slate-200'}`}></div>
                                  <div className={`absolute left-0.5 top-0.5 bg-white border-slate-300 border rounded-full h-4 w-4 transition-transform ${v.isLiquidation ? 'translate-x-4' : ''}`}></div>
                                </button>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {isEditingRow ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button type="button" onClick={handleSaveInlineVariant} className="p-1 text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors" title={t('common.save')}>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                  <button type="button" onClick={cancelInlineEdit} className="p-1 text-slate-400 hover:text-slate-600 transition-colors" title={t('common.cancel')}>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button" onClick={() => startEditVariant(v)} disabled={editingVariantId !== null}
                                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title={t('products.editVariant')}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button" onClick={() => duplicateVariant(v)} disabled={editingVariantId !== null}
                                    className="p-1 text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title={t('products.duplicate')}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                  {v.barcode && (
                                    <button
                                      type="button" onClick={() => printLabel({ ...v, productName: product?.name ?? '' })} disabled={editingVariantId !== null}
                                      className="p-1 text-slate-400 hover:text-violet-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title={t('products.printBarcode')}
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                      </svg>
                                    </button>
                                  )}
                                  <button
                                    type="button" onClick={() => handleDeleteVariant(v.id)} disabled={editingVariantId !== null}
                                    className="p-1 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title={t('common.delete')}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}

                      {editingVariantId === 'new' && (
                        <tr className="bg-blue-50/50">
                          <td className="px-3 py-2">
                            <select
                              value={editForm.colorId}
                              onChange={(e) => setEditForm((p) => ({ ...p, colorId: parseInt(e.target.value) }))}
                              className="w-full px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value={0}>{t('products.selectColor')}</option>
                              {colors.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={editForm.sizeId}
                              onChange={(e) => setEditForm((p) => ({ ...p, sizeId: parseInt(e.target.value) }))}
                              className="w-full px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value={0}>{t('products.selectSize')}</option>
                              {sizes.map((s) => (
                                <option key={s.id} value={s.id}>{s.value}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text" value={editForm.sku}
                              onChange={(e) => setEditForm((p) => ({ ...p, sku: e.target.value }))}
                              placeholder="Auto"
                              className="w-full px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number" min={0} value={editQuantity}
                              onChange={(e) => setEditQuantity(parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                            />
                          </td>
                          <td></td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button type="button" onClick={handleSaveInlineVariant} className="p-1 text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors" title={t('common.save')}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button type="button" onClick={cancelInlineEdit} className="p-1 text-slate-400 hover:text-slate-600 transition-colors" title={t('common.cancel')}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
