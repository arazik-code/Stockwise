import { ImageOff, Info, Plus } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { formatCurrency } from '../../utils/format'
import { Badge, EmptyState } from '../ui'
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
        <div
          data-tone="info"
          className="mb-3 flex items-center gap-2 rounded-card border border-[color-mix(in_oklab,var(--tone)_28%,transparent)] bg-[var(--tone-soft)] px-3 py-2"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-chip bg-[var(--tone)] text-white">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <p className="text-xs text-[var(--tone-ink)]">
            <span className="font-semibold">{defaultViewCategory}</span> — recherchez par nom ou scannez un code-barres pour voir tout le catalogue
          </p>
        </div>
      )}

      {shown.length === 0 ? (
        <EmptyState
          icon={ImageOff}
          variant={defaultView ? 'default' : 'search'}
          title={defaultView ? `Aucun produit dans « ${defaultViewCategory} »` : 'Aucun résultat'}
          description={
            defaultView
              ? 'Recherchez par nom ou scannez un code-barres pour trouver un produit.'
              : 'Essayez un autre terme de recherche.'
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          {shown.map((variant) => {
            const lowStock = variant.stockQuantity <= 5
            return (
              <button
                key={variant.id}
                onClick={() => addItem(variant, variant.productName)}
                className="group relative overflow-hidden rounded-card border border-border bg-surface text-left shadow-e1 transition-all duration-base ease-out-soft hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-e3"
              >
                <div className="relative flex h-24 items-center justify-center overflow-hidden bg-surface-2">
                  {variant.imageUrl ? (
                    <img
                      src={variant.imageUrl}
                      alt={variant.productName}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-slow group-hover:scale-110"
                    />
                  ) : (
                    <ImageOff className="h-9 w-9 text-fg-subtle" aria-hidden="true" />
                  )}
                  <Badge
                    tone={lowStock ? 'negative' : 'neutral'}
                    variant={lowStock ? 'solid' : 'soft'}
                    size="xs"
                    className="num absolute right-1.5 top-1.5"
                  >
                    {variant.stockQuantity > 99 ? '99+' : variant.stockQuantity}
                  </Badge>
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 min-h-[2rem] text-xs font-semibold leading-tight text-fg">{variant.productName}</p>
                  <div className="mt-1.5 flex items-center gap-1">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-chip border border-border"
                      style={{ backgroundColor: variant.colorHexCode }}
                    />
                    <span className="truncate text-[10px] text-fg-subtle">{variant.colorName}</span>
                    <span className="text-[10px] text-fg-subtle">/</span>
                    <span className="num text-[10px] text-fg-subtle">{variant.sizeValue}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-border pt-1.5">
                    <span className="num text-xs font-bold text-[var(--accent)]">{formatCurrency(variant.price)}</span>
                    <span className="text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100">
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {hiddenCount > 0 && (
        <p className="mt-3 text-center text-xs text-fg-subtle">
          <span className="num">{shown.length}</span> sur <span className="num">{inStock.length}</span> produits affichés — utilisez la recherche pour affiner
        </p>
      )}
    </div>
  )
}
