import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { productsApi } from '../../api/products'
import { fournisseursApi } from '../../api/fournisseurs'
import { showToast } from '../shared/Toast'
import type { Product } from '../../types/product'
import type { Fournisseur } from '../../types/fournisseur'

interface Props {
  fournisseurId: number
  fournisseurName: string
  onClose: () => void
  onSuccess: () => void
}

interface LineItem {
  productVariantId: number
  quantity: number
}

export default function ReceiveDeliveryDialog({ fournisseurId, fournisseurName, onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [selectedFournisseurId, setSelectedFournisseurId] = useState(fournisseurId)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('')
  const [selectedColorId, setSelectedColorId] = useState<number | ''>('')
  const [selectedSizeId, setSelectedSizeId] = useState<number | ''>('')
  const [quantity, setQuantity] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fournisseursApi.getAll().then(setFournisseurs).catch(() => {})
  }, [])

  useEffect(() => {
    productsApi.getAll().then((all) => {
      setProducts(all.filter((p) => p.fournisseurId === selectedFournisseurId))
      setSelectedProductId('')
      setSelectedColorId('')
      setSelectedSizeId('')
    }).catch(() => {})
  }, [selectedFournisseurId])

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  )

  const availableColors = useMemo(() => {
    if (!selectedProduct) return []
    const colorMap = new Map<number, { id: number; name: string; hexCode: string }>()
    for (const v of selectedProduct.variants) {
      if (v.colorId && v.colorName && !colorMap.has(v.colorId)) {
        colorMap.set(v.colorId, { id: v.colorId, name: v.colorName, hexCode: v.colorHexCode ?? '#999' })
      }
    }
    return Array.from(colorMap.values())
  }, [selectedProduct])

  const availableSizes = useMemo(() => {
    if (!selectedProduct || !selectedColorId) return []
    const sizeMap = new Map<number, { id: number; value: string }>()
    for (const v of selectedProduct.variants) {
      if (v.colorId === selectedColorId && v.sizeId && v.sizeValue && !sizeMap.has(v.sizeId)) {
        sizeMap.set(v.sizeId, { id: v.sizeId, value: v.sizeValue })
      }
    }
    return Array.from(sizeMap.values())
  }, [selectedProduct, selectedColorId])

  const selectedVariant = useMemo(() => {
    if (!selectedProduct || !selectedColorId || !selectedSizeId) return null
    return selectedProduct.variants.find(
      (v) => v.colorId === selectedColorId && v.sizeId === selectedSizeId
    ) ?? null
  }, [selectedProduct, selectedColorId, selectedSizeId])

  const handleAddItem = () => {
    if (!selectedVariant || !quantity || parseInt(quantity) <= 0) return
    const qty = parseInt(quantity)
    const existing = lineItems.find((i) => i.productVariantId === selectedVariant.id)
    if (existing) {
      setLineItems(lineItems.map((i) =>
        i.productVariantId === selectedVariant.id ? { ...i, quantity: i.quantity + qty } : i
      ))
    } else {
      setLineItems([...lineItems, { productVariantId: selectedVariant.id, quantity: qty }])
    }
    setQuantity('')
    setSelectedProductId('')
    setSelectedColorId('')
    setSelectedSizeId('')
  }

  const handleRemoveItem = (variantId: number) => {
    setLineItems(lineItems.filter((i) => i.productVariantId !== variantId))
  }

  const handleSubmit = async () => {
    if (lineItems.length === 0) return
    setSubmitting(true)
    try {
      const result = await fournisseursApi.receiveDelivery(selectedFournisseurId, {
        reference: reference || undefined,
        notes: notes || undefined,
        items: lineItems,
      })
      showToast(`${result.totalQuantityAdded} ${t('stock.addedToStock')}`, 'success')
      onSuccess()
      onClose()
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const getVariantLabel = (variantId: number) => {
    for (const p of products) {
      const v = p.variants.find((x) => x.id === variantId)
      if (v) return `${p.name} - ${v.colorName} / ${v.sizeValue} (${v.sku})`
    }
    return `Variant #${variantId}`
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-[600px] max-h-[85vh] overflow-auto border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">
          {t('fournisseurs.receiveDelivery')}
        </h2>
        <p className="text-sm text-slate-500 mb-5">{fournisseurName}</p>

        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('fournisseurs.name')}</label>
            <select
              value={selectedFournisseurId}
              onChange={(e) => setSelectedFournisseurId(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('invoices.reference')}</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Bon de livraison..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('invoices.notes')}</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-md p-4 space-y-3">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">{t('fournisseurs.addItem')}</h4>

            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('products.name')}</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(Number(e.target.value) || '')
                    setSelectedColorId('')
                    setSelectedSizeId('')
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- {t('invoices.selectProduct')} --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('products.color')}</label>
                <select
                  value={selectedColorId}
                  onChange={(e) => {
                    setSelectedColorId(Number(e.target.value) || '')
                    setSelectedSizeId('')
                  }}
                  disabled={!selectedProductId}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">-- {t('products.selectColor')} --</option>
                  {availableColors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('products.size')}</label>
                <select
                  value={selectedSizeId}
                  onChange={(e) => setSelectedSizeId(Number(e.target.value) || '')}
                  disabled={!selectedColorId}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">-- {t('products.selectSize')} --</option>
                  {availableSizes.map((s) => (
                    <option key={s.id} value={s.id}>EU {s.value}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('common.quantity')}</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!selectedVariant || !quantity || parseInt(quantity) <= 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                {t('common.add')}
              </button>
            </div>

            {selectedVariant && (
              <p className="text-xs text-slate-500">
                {t('stock.onHand')}: <span className="font-medium text-slate-700">{selectedVariant.stockQuantity}</span>
                {' · '}SKU: <span className="font-mono text-slate-700">{selectedVariant.sku}</span>
              </p>
            )}
          </div>
        </div>

        {lineItems.length > 0 && (
          <div className="mb-5">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              {t('fournisseurs.deliveryItems')} ({lineItems.length})
            </h4>
            <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
              {lineItems.map((item) => (
                <div key={item.productVariantId} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-slate-700">{getVariantLabel(item.productVariantId)}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-900">+{item.quantity}</span>
                    <button
                      onClick={() => handleRemoveItem(item.productVariantId)}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={lineItems.length === 0 || submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? t('pos.processing') : t('fournisseurs.confirmDelivery')}
          </button>
        </div>
      </div>
    </div>
  )
}
