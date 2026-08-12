import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { productsApi } from '../../api/products'
import { fournisseursApi } from '../../api/fournisseurs'
import { showToast } from '../shared/Toast'
import { Button, IconButton, Input, Modal, Select } from '../ui'
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
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={t('fournisseurs.receiveDelivery')}
      description={fournisseurName}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="success"
            onClick={handleSubmit}
            disabled={lineItems.length === 0 || submitting}
            loading={submitting}
          >
            {t('fournisseurs.confirmDelivery')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label={t('fournisseurs.name')}
          value={selectedFournisseurId}
          onChange={(e) => setSelectedFournisseurId(Number(e.target.value))}
        >
          {fournisseurs.map((f) => (
            <option key={f.id} value={f.id}>{f.nom}</option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('invoices.reference')}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Bon de livraison..."
          />
          <Input
            label={t('invoices.notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes..."
          />
        </div>

        <div className="space-y-3 rounded-card border border-border p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">{t('fournisseurs.addItem')}</h4>

          <div className="grid grid-cols-4 gap-3">
            <Select
              wrapperClassName="col-span-2"
              label={t('products.name')}
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(Number(e.target.value) || '')
                setSelectedColorId('')
                setSelectedSizeId('')
              }}
            >
              <option value="">-- {t('invoices.selectProduct')} --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <Select
              label={t('products.color')}
              value={selectedColorId}
              onChange={(e) => {
                setSelectedColorId(Number(e.target.value) || '')
                setSelectedSizeId('')
              }}
              disabled={!selectedProductId}
            >
              <option value="">-- {t('products.selectColor')} --</option>
              {availableColors.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Select
              label={t('products.size')}
              value={selectedSizeId}
              onChange={(e) => setSelectedSizeId(Number(e.target.value) || '')}
              disabled={!selectedColorId}
            >
              <option value="">-- {t('products.selectSize')} --</option>
              {availableSizes.map((s) => (
                <option key={s.id} value={s.id}>EU {s.value}</option>
              ))}
            </Select>
          </div>

          <div className="flex items-end gap-3">
            <Input
              wrapperClassName="flex-1"
              label={t('common.quantity')}
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
            <Button
              type="button"
              onClick={handleAddItem}
              disabled={!selectedVariant || !quantity || parseInt(quantity) <= 0}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              {t('common.add')}
            </Button>
          </div>

          {selectedVariant && (
            <p className="text-xs text-fg-subtle">
              {t('stock.onHand')}: <span className="num font-medium text-fg">{selectedVariant.stockQuantity}</span>
              {' · '}SKU: <span className="num text-fg">{selectedVariant.sku}</span>
            </p>
          )}
        </div>

        {lineItems.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              {t('fournisseurs.deliveryItems')} (<span className="num">{lineItems.length}</span>)
            </h4>
            <div className="divide-y divide-border rounded-card border border-border">
              {lineItems.map((item) => (
                <div key={item.productVariantId} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-fg">{getVariantLabel(item.productVariantId)}</span>
                  <div className="flex items-center gap-3">
                    <span className="num text-sm font-medium text-fg">+{item.quantity}</span>
                    <IconButton
                      icon={<Trash2 className="h-4 w-4" />}
                      label={t('common.delete')}
                      size="xs"
                      variant="danger-ghost"
                      onClick={() => handleRemoveItem(item.productVariantId)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
