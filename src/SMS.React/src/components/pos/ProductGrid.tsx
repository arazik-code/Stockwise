import { BookOpen, House, ImageOff, Package, Plus, Shirt, ShoppingBag, Smartphone, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { useCartStore } from '../../store/cartStore'
import { formatCurrency } from '../../utils/format'
import { EmptyState } from '../ui'
import type { ProductVariant } from '../../types/product'

interface ProductGridProps {
  variants: (ProductVariant & { productName: string; brand?: string; imageUrl?: string; categoryName?: string })[]
  limit?: number
  defaultView?: boolean
}

const DEFAULT_LIMIT = 60

function ProductArtwork({ category }: { category?: string }) {
  const label = category?.toLowerCase() ?? ''
  const Icon = label.includes('cloth') || label.includes('wear')
    ? Shirt
    : label.includes('foot') || label.includes('shoe') || label.includes('access')
      ? ShoppingBag
      : label.includes('beauty') || label.includes('fragrance') || label.includes('parfum')
        ? Sparkles
        : label.includes('elect')
          ? Smartphone
          : label.includes('home') || label.includes('kitchen')
            ? House
            : label.includes('station') || label.includes('book')
              ? BookOpen
              : Package

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_72%,color-mix(in_oklab,var(--accent)_20%,transparent),transparent_58%),linear-gradient(145deg,var(--surface-2),var(--canvas))]">
      <div className="absolute h-28 w-28 rounded-full border border-[color-mix(in_oklab,var(--accent)_14%,transparent)]" />
      <div className="absolute h-20 w-20 rounded-full border border-[color-mix(in_oklab,var(--accent)_12%,transparent)]" />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[color-mix(in_oklab,var(--accent)_15%,transparent)] bg-surface/80 text-[var(--accent)] shadow-[0_8px_24px_rgb(20_30_25/0.08)]">
        <Icon className="h-7 w-7" strokeWidth={1.4} aria-hidden="true" />
      </span>
    </div>
  )
}

export default function ProductGrid({ variants, limit = DEFAULT_LIMIT, defaultView }: ProductGridProps) {
  const addItem = useCartStore((s) => s.addItem)
  const inStock = variants.filter((v) => v.stockQuantity > 0)
  const shown = inStock.slice(0, limit)
  const hiddenCount = inStock.length - shown.length

  return (
    <div>
      {shown.length === 0 ? (
        <EmptyState
          icon={ImageOff}
          variant={defaultView ? 'default' : 'search'}
          title={defaultView ? 'Aucun produit en stock' : 'Aucun résultat'}
          description={
            defaultView
              ? 'Ajoutez des produits et leurs quantités en stock pour commencer.'
              : 'Essayez un autre terme de recherche.'
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
          {shown.map((variant, index) => {
            const lowStock = variant.stockQuantity <= 5
            return (
              <motion.button
                key={variant.id}
                onClick={() => addItem(variant, variant.productName)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(index * 0.018, 0.18) }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.985 }}
                aria-label={`Ajouter ${variant.productName}, ${variant.colorName}, ${variant.sizeValue}, ${formatCurrency(variant.price)}`}
                className="group relative overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-[0_2px_8px_rgb(25_35_28/0.04)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--accent)] hover:shadow-[0_14px_30px_rgb(25_35_28/0.12)]"
              >
                <div className="relative flex aspect-[1.18/1] items-center justify-center overflow-hidden bg-[linear-gradient(145deg,var(--surface-2),var(--canvas))]">
                  {variant.imageUrl ? (
                    <img
                      src={variant.imageUrl}
                      alt={variant.productName}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.045]"
                    />
                  ) : (
                    <ProductArtwork category={variant.categoryName} />
                  )}
                  <span className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide backdrop-blur-sm ${lowStock ? 'bg-amber-100/95 text-amber-900' : 'bg-white/90 text-neutral-700'}`}>
                    {lowStock ? `Plus que ${variant.stockQuantity}` : `${variant.stockQuantity} en stock`}
                  </span>
                  <span className="absolute bottom-2.5 right-2.5 flex h-9 w-9 translate-y-2 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)] opacity-0 shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="p-3.5">
                  <p className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-snug text-fg">{variant.productName}</p>
                  <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-fg-subtle">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: variant.colorHexCode }}
                    />
                    <span className="truncate">{variant.colorName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="num truncate">{variant.sizeValue}</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2 border-t border-border/70 pt-2.5">
                    <span className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-fg-subtle">{variant.categoryName || 'Produit'}</span>
                    <span className="num shrink-0 text-sm font-bold tracking-tight text-fg">{formatCurrency(variant.price)}</span>
                  </div>
                </div>
              </motion.button>
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
