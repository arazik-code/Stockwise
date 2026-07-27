import { create } from 'zustand'

interface InventoryState {
  stockLevels: Record<number, number>
  updateStock: (productId: number, quantity: number) => void
  setStockLevels: (levels: Record<number, number>) => void
}

export const useInventoryStore = create<InventoryState>((set) => ({
  stockLevels: {},

  updateStock: (productId, quantity) =>
    set((state) => ({
      stockLevels: { ...state.stockLevels, [productId]: quantity },
    })),

  setStockLevels: (levels) => set({ stockLevels: levels }),
}))
