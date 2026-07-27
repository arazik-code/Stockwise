import { create } from 'zustand'

export interface ExchangeReturnedItem {
  saleItemId: number
  productVariantId: number
  productName: string
  sku?: string
  colorName?: string
  sizeValue?: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface ExchangeContext {
  originalSaleId: number
  originalSaleNumber: string
  clientId?: number
  clientName?: string
  returnedItems: ExchangeReturnedItem[]
  totalRefundAmount: number
}

interface ExchangeState {
  context: ExchangeContext | null
  setExchangeContext: (ctx: ExchangeContext) => void
  clearExchangeContext: () => void
}

export const useExchangeStore = create<ExchangeState>((set) => ({
  context: null,
  setExchangeContext: (ctx) => set({ context: ctx }),
  clearExchangeContext: () => set({ context: null }),
}))
