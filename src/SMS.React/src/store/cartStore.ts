import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProductVariant } from '../types/product'

export interface CartItem {
  productVariantId: number
  productId: number
  name: string
  sku: string
  colorName: string
  colorHexCode?: string
  sizeValue: string
  imageUrl?: string
  unitPrice: number
  quantity: number
  lineTotal: number
  isLiquidation: boolean
}

interface CartState {
  items: CartItem[]
  taxRate: number
  addItem: (variant: ProductVariant, productName: string) => void
  removeItem: (productVariantId: number) => void
  updateQuantity: (productVariantId: number, quantity: number) => void
  clearCart: () => void
  setTaxRate: (rate: number) => void
  subtotal: () => number
  tax: () => number
  total: () => number
  hasLiquidationItems: () => boolean
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      taxRate: 0.1,

      addItem: (variant, productName) =>
        set((state) => {
          const existing = state.items.find((i) => i.productVariantId === variant.id)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productVariantId === variant.id
                  ? { ...i, quantity: i.quantity + 1, lineTotal: (i.quantity + 1) * i.unitPrice }
                  : i
              ),
            }
          }
          return {
            items: [
              ...state.items,
              {
                productVariantId: variant.id,
                productId: variant.productId,
                name: productName,
                sku: variant.sku,
                colorName: variant.colorName,
                colorHexCode: variant.colorHexCode,
                sizeValue: variant.sizeValue,
                imageUrl: variant.imageUrl,
                unitPrice: variant.price,
                quantity: 1,
                lineTotal: variant.price,
                isLiquidation: variant.isLiquidation,
              },
            ],
          }
        }),

      removeItem: (productVariantId) =>
        set((state) => ({ items: state.items.filter((i) => i.productVariantId !== productVariantId) })),

      updateQuantity: (productVariantId, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.productVariantId === productVariantId
              ? { ...i, quantity, lineTotal: quantity * i.unitPrice }
              : i
          ),
        })),

      clearCart: () => set({ items: [] }),
      setTaxRate: (rate) => set({ taxRate: rate }),

      subtotal: () => get().items.reduce((sum, i) => sum + i.lineTotal, 0),
      tax: () => {
        const subtotal = get().items.reduce((sum, i) => sum + i.lineTotal, 0)
        return subtotal * get().taxRate
      },
      total: () => {
        const subtotal = get().items.reduce((sum, i) => sum + i.lineTotal, 0)
        return subtotal * (1 + get().taxRate)
      },
      hasLiquidationItems: () => get().items.some((i) => i.isLiquidation),
    }),
    {
      // Survives a full page reload - notably the VPS/local-fallback failover navigate, which
      // reloads the whole SPA (see plan doc, Architecture Decision #5) - so a cart mid-sale isn't
      // silently lost if the store's connection drops between scanning items and checkout.
      name: 'sms-cart',
      partialize: (state) => ({ items: state.items, taxRate: state.taxRate }),
    }
  )
)
