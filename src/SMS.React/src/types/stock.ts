export interface StockItem {
  productVariantId: number
  productName: string
  colorName: string
  sizeValue: string
  sku: string
  quantityOnHand: number
  quantityReserved: number
  quantityAvailable: number
  reorderLevel: number
  isLowStock: boolean
}

export interface StockMovement {
  id: number
  productVariantId: number
  productName: string
  colorName: string
  sizeValue: string
  type: string
  quantityChange: number
  quantityAfter: number
  reference?: string
  notes?: string
  userName?: string
  createdAt: string
}

export interface StockAdjustmentRequest {
  productVariantId: number
  adjustmentDelta?: number
  newQuantity?: number
  notes?: string
}
