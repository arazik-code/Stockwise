import { useEffect } from 'react'
import { formatCurrency } from '../../utils/format'
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-[560px] max-h-[85vh] flex flex-col border border-slate-200 shadow-xl">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-start">
          <div>
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-0.5">Code-barres produit scanné</p>
            <h2 className="text-lg font-bold text-slate-900">{product.name}</h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{product.barcode}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">{product.variants.length} variante(s)</span>
          <span className="text-xs font-medium text-slate-500">{totalStock} unité(s) en stock au total</span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {product.variants.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">Aucune variante pour ce produit</p>
          )}
          {product.variants.map((v) => {
            const outOfStock = v.stockQuantity <= 0
            const lowStock = !outOfStock && v.stockQuantity <= 5
            return (
              <button
                key={v.id}
                onClick={() => !outOfStock && onSelectVariant(v)}
                disabled={outOfStock}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                  outOfStock
                    ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer'
                }`}
              >
                <span className="w-4 h-4 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: v.colorHexCode }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{v.colorName}</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-sm font-medium text-slate-900">{v.sizeValue}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{v.sku}</span>
                </div>
                <span className="text-sm font-semibold text-slate-700">{formatCurrency(v.price)}</span>
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full ${
                    outOfStock
                      ? 'bg-red-50 text-red-600'
                      : lowStock
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {outOfStock ? 'Rupture' : `${v.stockQuantity} en stock`}
                </span>
              </button>
            )
          })}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-400 text-center">Cliquez sur une variante pour l'ajouter au panier · Échap pour fermer</p>
        </div>
      </div>
    </div>
  )
}
