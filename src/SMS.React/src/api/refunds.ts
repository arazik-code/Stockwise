import api from './client'

export interface RefundItem {
  id: number
  saleItemId: number
  productVariantId: number
  productName: string
  productSku?: string
  colorName?: string
  sizeValue?: string
  quantity: number
  unitPrice: number
  refundAmount: number
  reason?: string
}

export interface ExchangeItem {
  id: number
  productVariantId: number
  productName: string
  productSku?: string
  colorName?: string
  sizeValue?: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface Refund {
  id: number
  refundNumber: string
  saleId: number
  saleNumber: string
  type: string
  status: string
  totalRefundAmount: number
  totalExchangeAmount: number
  priceDifference: number
  reason: string
  notes?: string
  clientId?: number
  clientName?: string
  refundDate: string
  items: RefundItem[]
  exchangeItems: ExchangeItem[]
}

export interface SaleItemForRefund {
  id: number
  productVariantId: number
  productName: string
  productSku?: string
  colorName?: string
  sizeValue?: string
  quantity: number
  unitPrice: number
  lineTotal: number
  alreadyRefundedQuantity: number
  availableForRefund: number
}

export interface SaleForRefund {
  id: number
  saleNumber: string
  clientName?: string
  clientId?: number
  totalAmount: number
  amountPaid: number
  paymentMethod: string
  status: string
  createdAt: string
  items: SaleItemForRefund[]
}

export interface CreateRefundItemRequest {
  saleItemId: number
  quantity: number
  reason?: string
}

export interface CreateExchangeItemRequest {
  productVariantId: number
  quantity: number
}

export interface CreateRefundRequest {
  saleId: number
  type: 'Refund' | 'Exchange'
  reason: string
  notes?: string
  items: CreateRefundItemRequest[]
  exchangeItems: CreateExchangeItemRequest[]
}

export interface ProductVariantForExchange {
  id: number
  productId: number
  productName: string
  productDescription?: string
  sku: string
  barcode?: string
  imageUrl?: string
  colorName: string
  colorHexCode: string
  sizeValue: string
  price: number
  stockQuantity: number
}

export const refundsApi = {
  getAll: () => api.get<Refund[]>('/refunds').then((r) => r.data),
  getById: (id: number) => api.get<Refund>(`/refunds/${id}`).then((r) => r.data),
  getSaleForRefund: (saleId: number) =>
    api.get<SaleForRefund>(`/refunds/sale/${saleId}`).then((r) => r.data),
  scanBarcode: (barcode: string) =>
    api.get<SaleForRefund>(`/refunds/scan-barcode/${encodeURIComponent(barcode)}`).then((r) => r.data),
  scanClientQr: (qrCode: string) =>
    api.get<SaleForRefund[]>(`/refunds/scan-client-qr/${encodeURIComponent(qrCode)}`).then((r) => r.data),
  searchVariants: (query: string) =>
    api.get<ProductVariantForExchange[]>('/refunds/search-variants', { params: { query } }).then((r) => r.data),
  create: (request: CreateRefundRequest) =>
    api.post<Refund>('/refunds', request).then((r) => r.data),
  process: (id: number) => api.post<Refund>(`/refunds/${id}/process`).then((r) => r.data),
  cancel: (id: number) => api.post<Refund>(`/refunds/${id}/cancel`).then((r) => r.data),
}
