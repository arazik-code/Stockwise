import { useCartStore } from '../../store/cartStore'
import { formatCurrency } from '../../utils/format'
import type { ProductVariant } from '../../types/product'

interface ProductGridProps {
  variants: (ProductVariant & { productName: string; brand?: string; imageUrl?: string; categoryName?: string })[]
  limit?: number
  defaultView?: boolean
  defaultViewCategory?: string
}

const DEFAULT_LIMIT = 60

export default function ProductGrid({ variants, limit = DEFAULT_LIMIT, defaultView, defaultViewCategory }: ProductGridProps) {
  const addItem = useCartStore((s) => s.addItem)
  const inStock = variants.filter((v) => v.stockQuantity > 0)
  const shown = inStock.slice(0, limit)
  const hiddenCount = inStock.length - shown.length

  return (
    <div>
      {defaultView && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-50 via-blue-50 to-transparent border border-indigo-100">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 14.15v4.25c0 .966-.784 1.75-1.75 1.75H5.5a1.75 1.75 0 01-1.75-1.75V8.15c0-.966.784-1.75 1.75-1.75h4.25M20.25 14.15L11.05 4.95m9.2 9.2h-4.25v-4.25" />
            </svg>
          </span>
          <p className="text-xs text-indigo-800">
            <span className="font-semibold">{defaultViewCategory}</span> — recherchez par nom ou scannez un code-barres pour voir tout le catalogue
          </p>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-500">
            {defaultView ? `Aucun produit dans « ${defaultViewCategory} »` : 'Aucun résultat'}
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            {defaultView
              ? 'Recherchez par nom ou scannez un code-barres pour trouver un produit.'
              : 'Essayez un autre terme de recherche.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {shown.map((variant) => {
            const lowStock = variant.stockQuantity <= 5
            return (
              <button
                key={variant.id}
                onClick={() => addItem(variant, variant.productName)}
                className="group relative bg-white border border-slate-200/80 rounded-2xl overflow-hidden text-left shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-indigo-200 transition-all duration-200"
              >
                <div className="relative h-24 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center overflow-hidden">
                  {variant.imageUrl ? (
                    <img
                      src={variant.imageUrl}
                      alt={variant.productName}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <svg className="w-9 h-9 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  <span
                    className={`absolute top-1.5 right-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full backdrop-blur-sm ${
                      lowStock ? 'bg-red-500/90 text-white' : 'bg-white/85 text-slate-600'
                    }`}
                  >
                    {variant.stockQuantity > 99 ? '99+' : variant.stockQuantity}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-slate-900 leading-tight line-clamp-2 min-h-[2rem]">{variant.productName}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full border border-slate-200 flex-shrink-0"
                      style={{ backgroundColor: variant.colorHexCode }}
                    />
                    <span className="text-[10px] text-slate-500 truncate">{variant.colorName}</span>
                    <span className="text-[10px] text-slate-300">/</span>
                    <span className="text-[10px] text-slate-500">{variant.sizeValue}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-slate-100">
                    <span className="text-xs font-bold text-indigo-700">{formatCurrency(variant.price)}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {hiddenCount > 0 && (
        <p className="text-xs text-slate-400 text-center mt-3">
          {shown.length} sur {inStock.length} produits affichés — utilisez la recherche pour affiner
        </p>
      )}
    </div>
  )
}
