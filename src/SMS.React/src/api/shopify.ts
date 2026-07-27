import api from './client'

export interface ShopifySyncStatus {
  lastSyncTime?: string
  pendingOrders: number
  pendingProducts: number
  isSyncing: boolean
}

export interface ShopifyProductMapping {
  id: number
  shopifyProductId: number
  shopifyVariantId: number
  title: string
  sku?: string
  price: number
  localProductId?: number
  localProductName?: string
  localPrice?: number
  priceMismatch: boolean
  syncedAt: string
}

export interface CreateShopifyProductMappingRequest {
  shopifyProductId: number
  shopifyVariantId: number
  title: string
  sku?: string
  price: number
  localProductId?: number
}

export interface ShopifyLocation {
  id: number
  name: string
  city?: string
  active: boolean
}

export interface ShopifyImportResult {
  totalVariants: number
  created: number
  updated: number
  autoLinked: number
  configured: boolean
}

export interface ShopifyCatalogImportResult {
  productsCreated: number
  productsUpdated: number
  variantsCreated: number
  variantsUpdated: number
  colorsCreated: number
  sizesCreated: number
  categoriesCreated: number
  barcodesGenerated: number
  configured: boolean
}

export const shopifyApi = {
  getSyncStatus: () => api.get<ShopifySyncStatus>('/shopify/sync/status').then((r) => r.data),
  triggerSync: () => api.post<{ message: string }>('/shopify/sync/trigger').then((r) => r.data),
  getLocations: () => api.get<ShopifyLocation[]>('/shopify/locations').then((r) => r.data),
  getProductMappings: () => api.get<ShopifyProductMapping[]>('/shopify-products').then((r) => r.data),
  createProductMapping: (data: CreateShopifyProductMappingRequest) =>
    api.post<ShopifyProductMapping>('/shopify-products', data).then((r) => r.data),
  linkProductMapping: (id: number, localProductId: number | null) =>
    api.put<ShopifyProductMapping>(`/shopify-products/${id}/link`, { localProductId }).then((r) => r.data),
  deleteProductMapping: (id: number) => api.delete(`/shopify-products/${id}`),
  importProducts: () => api.post<ShopifyImportResult>('/shopify-products/import', {}, { timeout: 120000 }).then((r) => r.data),
  importCatalog: () => api.post<ShopifyCatalogImportResult>('/shopify-products/import-catalog', {}, { timeout: 300000 }).then((r) => r.data),
}
