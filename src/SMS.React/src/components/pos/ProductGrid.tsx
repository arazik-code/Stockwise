import { useCartStore } from '../../store/cartStore'
import { formatCurrency } from '../../utils/format'
import type { ProductVariant } from '../../types/product'

interface ProductGridProps {
  variants: (ProductVariant & { productName: string; brand?: string; imageUrl?: string })[]
  limit?: number
}

const DEFAULT_LIMIT = 60

export default function ProductGrid({ variants, limit = DEFAULT_LIMIT }: ProductGridProps) {
  const addItem = useCartStore((s) => s.addItem)
  const inStock = variants.filter((v) => v.stockQuantity > 0)
  const shown = inStock.slice(0, limit)
  const hiddenCount = inStock.length - shown.length

  return (
    <div>
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
      {shown.map((variant) => (
        <button
          key={variant.id}
          onClick={() => addItem(variant, variant.productName)}
          className="bg-white border border-slate-200 rounded-lg overflow-hidden text-left hover:border-blue-300 hover:shadow-sm transition-all group"
        >
          <div className="h-20 bg-slate-50 flex items-center justify-center overflow-hidden">
            {variant.imageUrl ? (
              <img
                src={variant.imageUrl}
                alt={variant.productName}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <div className="p-2.5">
            <p className="text-xs font-semibold text-slate-900 leading-tight line-clamp-2">{variant.productName}</p>
            <div className="flex items-center gap-1 mt-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full border border-slate-200 flex-shrink-0"
                style={{ backgroundColor: variant.colorHexCode }}
              />
              <span className="text-[10px] text-slate-500 truncate">{variant.colorName}</span>
              <span className="text-[10px] text-slate-300">/</span>
              <span className="text-[10px] text-slate-500">{variant.sizeValue}</span>
            </div>
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-xs font-bold text-slate-900">{formatCurrency(variant.price)}</span>
              <span className={`text-[10px] ${variant.stockQuantity <= 5 ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                {variant.stockQuantity > 99 ? '99+' : variant.stockQuantity}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
    {hiddenCount > 0 && (
      <p className="text-xs text-slate-400 text-center mt-3">
        {shown.length} sur {inStock.length} produits affichés — utilisez la recherche pour affiner
      </p>
    )}
    </div>
  )
}
