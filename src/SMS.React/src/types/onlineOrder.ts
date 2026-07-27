export type OnlineOrderChannel = 'Manual' | 'WhatsApp' | 'Shopify'

export type OnlineOrderStatus =
  | 'Pending'
  | 'Processing'
  | 'Confirmed'
  | 'Packing'
  | 'ReadyToShip'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled'
  | 'Refunded'
  | 'InventoryConflict'

export type OnlinePaymentStatus = 'Unpaid' | 'Paid' | 'Refunded'
export type OnlinePaymentMethod = 'COD' | 'Manual' | 'BankTransfer' | 'ShopifyCheckout'

export interface OnlineOrderItem {
  id: number
  productVariantId: number
  productName: string
  sku: string
  colorName?: string
  sizeValue?: string
  quantity: number
  unitPrice: number
  discountAmount: number
  lineTotal: number
  stockAvailable: number
}

export interface OnlineOrder {
  id: number
  orderNumber: string
  channel: OnlineOrderChannel
  status: OnlineOrderStatus
  paymentStatus: OnlinePaymentStatus
  paymentMethod: OnlinePaymentMethod

  clientId?: number
  customerName: string
  customerPhone?: string
  customerEmail?: string

  addressLine?: string
  city?: string
  carrierName?: string
  trackingNumber?: string
  deliveryFee: number
  expectedDeliveryDate?: string

  subTotal: number
  discountAmount: number
  shippingFee: number
  totalAmount: number
  amountPaid: number
  balanceDue: number

  notes?: string
  createdByUserName?: string

  loyaltyPointsEarned: number
  loyaltyPointsRedeemed: number
  loyaltyDiscountAmount: number

  items: OnlineOrderItem[]

  createdAt: string
  confirmedAt?: string
  shippedAt?: string
  deliveredAt?: string
}

export interface CreateOnlineOrderItemRequest {
  productVariantId: number
  quantity: number
  unitPriceOverride?: number
  discountAmount: number
}

export interface CreateManualOrderRequest {
  channel: OnlineOrderChannel
  paymentMethod: OnlinePaymentMethod
  clientId?: number
  customerName: string
  customerPhone?: string
  customerEmail?: string
  addressLine?: string
  city?: string
  deliveryFee: number
  discountAmount: number
  loyaltyPointsToRedeem?: number
  notes?: string
  items: CreateOnlineOrderItemRequest[]
}

export interface AssignShippingRequest {
  carrierName: string
  trackingNumber?: string
  deliveryFee?: number
  expectedDeliveryDate?: string
}

export interface OrderTrendPoint {
  date: string
  count: number
  revenue: number
}

export interface ChannelBreakdownPoint {
  channel: string
  count: number
  revenue: number
}

export interface OnlineDashboard {
  todayOrders: number
  todayRevenue: number
  pendingOrders: number
  conflictCount: number
  weekOrders: number
  weekRevenue: number
  monthOrders: number
  monthRevenue: number
  ordersTrend: OrderTrendPoint[]
  channelBreakdown: ChannelBreakdownPoint[]
  recentOrders: OnlineOrder[]
}

export interface OnlineReport {
  from: string
  to: string
  totalOrders: number
  totalRevenue: number
  totalDeliveryFees: number
  cancelledCount: number
  conflictCount: number
  channelBreakdown: ChannelBreakdownPoint[]
  dailyRevenue: OrderTrendPoint[]
}
