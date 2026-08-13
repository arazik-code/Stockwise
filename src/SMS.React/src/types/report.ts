export interface DashboardData {
  todaySales: number
  todayRevenue: number
  todayAvgOrderValue: number
  weekSales: number
  weekRevenue: number
  monthSales: number
  monthRevenue: number
  lowStockCount: number
  totalProducts: number
  totalVariants: number
  totalStockUnits: number
  pendingConflicts: number
  salesTrend: { date: string; count: number; revenue: number }[]
  paymentBreakdown: { method: string; count: number; revenue: number }[]
  categoryBreakdown: { category: string; count: number; revenue: number }[]
}

export interface InventoryReportItem {
  productVariantId: number
  productName: string
  colorName: string
  sizeValue: string
  sku: string
  category: string
  quantityOnHand: number
  quantityReserved: number
  reorderLevel: number
  isLowStock: boolean
}

export interface SalesByChannelItem {
  channel: string
  totalSales: number
  totalRevenue: number
}

export interface TopProductItem {
  productId: number
  productName: string
  colorName: string
  sizeValue: string
  quantitySold: number
  revenue: number
}
