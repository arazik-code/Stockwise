export interface Sale {
  id: number
  saleNumber: string
  channel: 'Local' | 'Shopify'
  category: 'VenteNormale' | 'VentePromotion' | 'Liquidation' | 'VenteEnGros' | 'VenteSpeciale' | 'Retour' | 'Echange'
  paymentMethod: 'Cash' | 'Card' | 'Online'
  subTotal: number
  taxAmount: number
  discountAmount: number
  totalAmount: number
  amountPaid: number
  changeGiven: number
  status: string
  userName?: string
  clientId?: number
  clientName?: string
  loyaltyPointsEarned: number
  loyaltyPointsRedeemed: number
  loyaltyDiscountAmount: number
  items: SaleItem[]
  receiptBarcode?: string
  createdAt: string
  isLocalFallbackOrigin: boolean
  reconciledAt?: string
}

export interface SaleItem {
  id: number
  saleId: number
  productVariantId: number
  productName: string
  variantSku: string
  variantBarcode?: string
  colorName: string
  sizeValue: string
  quantity: number
  unitPrice: number
  costPrice: number
  discountAmount: number
  lineTotal: number
}

export interface CreateSaleRequest {
  category: number
  paymentMethod: number
  amountPaid: number
  taxRate: number
  clientId?: number
  loyaltyPointsToRedeem?: number
  exchangeCreditAmount?: number
  items: { productVariantId: number; quantity: number; discountAmount: number }[]
}

export interface DailySalesReport {
  date: string
  totalSales: number
  totalRevenue: number
  totalTax: number
  cashSales: number
  cardSales: number
  onlineSales: number
  topProducts: { productVariantId: number; productName: string; colorName: string; sizeValue: string; quantitySold: number; revenue: number }[]
}

export interface SalesReport {
  from: string
  to: string
  totalSales: number
  totalItemsSold: number
  totalRevenue: number
  totalCost: number
  totalProfit: number
  totalTax: number
  totalDiscount: number
  averageOrderValue: number
  averageItemsPerOrder: number
  paymentBreakdown: {
    cash: number
    card: number
    online: number
    cashCount: number
    cardCount: number
    onlineCount: number
  }
  channelBreakdown: {
    local: number
    shopify: number
    localCount: number
    shopifyCount: number
  }
  categoryBreakdown: {
    category: string
    count: number
    revenue: number
  }[]
  topProducts: {
    productVariantId: number
    productName: string
    sku: string
    colorName: string
    sizeValue: string
    quantitySold: number
    revenue: number
    cost: number
    profit: number
    averageUnitPrice: number
  }[]
  dailyRevenue: {
    date: string
    salesCount: number
    revenue: number
    profit: number
    itemsSold: number
  }[]
  sales: Sale[]
}
