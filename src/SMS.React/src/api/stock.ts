import api from './client'
import type { StockItem, StockMovement, StockAdjustmentRequest } from '../types/stock'

export const stockApi = {
  getAll: () => api.get<StockItem[]>('/stock').then((r) => r.data),
  getByVariant: (productVariantId: number) => api.get<StockItem>(`/stock/${productVariantId}`).then((r) => r.data),
  getLowStock: () => api.get<StockItem[]>('/stock/low').then((r) => r.data),
  adjust: (data: StockAdjustmentRequest) => api.post('/stock/adjust', data).then((r) => r.data),
  setQuantity: (productVariantId: number, newQuantity: number, notes?: string) =>
    api.post('/stock/set-quantity', { productVariantId, newQuantity, notes }).then((r) => r.data),
  deleteStock: (variantId: number) =>
    api.delete(`/stock/${variantId}`).then((r) => r.data),
  bulkDeleteStock: (variantIds: number[]) =>
    api.post('/stock/bulk-delete', variantIds).then((r) => r.data),
  getMovements: (productVariantId?: number, from?: string, to?: string) =>
    api.get<StockMovement[]>('/stock/movements', { params: { productVariantId, from, to } }).then((r) => r.data),
  undoAdjustment: (movementId: number) =>
    api.post(`/stock/movements/${movementId}/undo`).then((r) => r.data),
}
