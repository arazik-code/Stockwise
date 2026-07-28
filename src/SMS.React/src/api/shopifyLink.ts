import api from './client'

export interface UnlinkedVariant {
  productVariantId: number
  productId: number
  productName: string
  colorName?: string
  sizeValue?: string
  sku: string
  barcode?: string
  quantityOnHand: number
}

export interface ShopifyVariantCandidate {
  shopifyProductId: number
  shopifyVariantId: number
  productTitle: string
  variantTitle?: string
  sku?: string
  barcode?: string
  price: number
  inventoryItemId: number
  inventoryQuantity?: number
  alreadyLinked: boolean
  linkedLocalVariantId?: number
  matchReason?: string
}

export interface LinkVariantResult {
  success: boolean
  message: string
  productVariantId: number
  shopifyVariantId?: number
  inventoryItemId?: number
  quantityPushed?: number
}

export interface AutoLinkResult {
  linked: number
  ambiguous: number
  noMatch: number
  details: string[]
}

export interface BulkSyncProgress {
  isRunning: boolean
  phase: string
  totalLinked: number
  compared: number
  differing: number
  pushed: number
  failed: number
  startedAt?: string
  finishedAt?: string
  lastError?: string
  recent: string[]
}

export const shopifySyncApi = {
  syncAll: () =>
    api.post<{ started: boolean; message: string; progress: BulkSyncProgress }>('/Shopify/inventory/sync-all').then((r) => r.data),
  status: () => api.get<BulkSyncProgress>('/Shopify/inventory/sync-status').then((r) => r.data),
}

export const shopifyLinkApi = {
  getUnlinked: () => api.get<UnlinkedVariant[]>('/shopify-link/unlinked').then((r) => r.data),
  search: (q: string, limit = 50) =>
    api.get<ShopifyVariantCandidate[]>('/shopify-link/search', { params: { q, limit } }).then((r) => r.data),
  suggestions: (productVariantId: number) =>
    api.get<ShopifyVariantCandidate[]>(`/shopify-link/${productVariantId}/suggestions`).then((r) => r.data),
  link: (productVariantId: number, shopifyVariantId: number) =>
    api.post<LinkVariantResult>(`/shopify-link/${productVariantId}/link`, { shopifyVariantId }).then((r) => r.data),
  unlink: (productVariantId: number) =>
    api.post<LinkVariantResult>(`/shopify-link/${productVariantId}/unlink`).then((r) => r.data),
  autoLink: () => api.post<AutoLinkResult>('/shopify-link/auto-link').then((r) => r.data),
  pushInventory: (productVariantId: number) =>
    api.post(`/Shopify/inventory/push/${productVariantId}`).then((r) => r.data),
}
