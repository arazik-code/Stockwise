import { useEffect } from 'react'
import { formatCurrency } from '../../utils/format'
import { Badge, Modal, cn } from '../ui'
import type { Product, ProductVariant } from '../../types/product'

interface ProductVariantsModalProps {
  product: Product
  onClose: () => void
  onSelectVariant: (variant: ProductVariant) => void
}

export default function ProductVariantsModal({ product, onClose, onSelectVariant }: ProductVariantsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [onClose])

  const totalStock = product.variants.reduce((sum, v) => sum + v.stockQuantity, 0)

  return (
    <Modal
      open
      onClose={onClose}
      closeOnEsc={false}
      size="md"
      bodyClassName="p-0"
      title={
        <div>
          <Badge tone="info" size="xs" className="mb-1 uppercase tracking-wide">
            Code-barres produit scanné
          </Badge>
          <div className="text-base font-bold text-fg">{product.name}</div>
        </div>
      }
      description={<span className="num">{product.barcode}</span>}
      footer={
        <p className="w-full text-center text-xs text-fg-subtle">
          Cliquez sur une variante pour l'ajouter au panier · Échap pour fermer
        </p>
      }
    >
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-6 py-3">
        <span className="text-xs font-medium text-fg-subtle">
          <span className="num">{product.variants.length}</span> variante(s)
        </span>
        <span className="text-xs font-medium text-fg-subtle">
          <span className="num">{totalStock}</span> unité(s) en stock au total
        </span>
      </div>

      <div className="space-y-2 px-6 py-4">
        {product.variants.length === 0 && (
          <p className="py-8 text-center text-sm text-fg-subtle">Aucune variante pour ce produit</p>
        )}
        {product.variants.map((v) => {
          const outOfStock = v.stockQuantity <= 0
          const lowStock = !outOfStock && v.stockQuantity <= 5
          return (
            <button
              key={v.id}
              onClick={() => !outOfStock && onSelectVariant(v)}
              disabled={outOfStock}
              className={cn(
                'flex w-full items-center gap-3 rounded-card border p-3 text-left transition-colors duration-fast',
                outOfStock
                  ? 'cursor-not-allowed border-border bg-sunken opacity-60'
                  : 'cursor-pointer border-border bg-surface hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]'
              )}
            >
              <span
                className="h-4 w-4 shrink-0 rounded-chip border border-border"
                style={{ backgroundColor: v.colorHexCode }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-fg">{v.colorName}</span>
                  <span className="text-fg-subtle">/</span>
                  <span className="text-sm font-medium text-fg">{v.sizeValue}</span>
                </div>
                <span className="num text-xs text-fg-subtle">{v.sku}</span>
              </div>
              <span className="num text-sm font-semibold text-fg-muted">{formatCurrency(v.price)}</span>
              <Badge tone={outOfStock ? 'negative' : lowStock ? 'caution' : 'positive'} size="sm">
                {outOfStock ? 'Rupture' : <span className="num">{v.stockQuantity} en stock</span>}
              </Badge>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
