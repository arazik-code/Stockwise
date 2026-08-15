import api from './client'
import type { Product, CreateProductRequest, ProductVariant, CreateProductVariantRequest } from '../types/product'

export interface OnlineProductStats {
  productId: number
  unitsSold: number
  revenue: number
  orderCount: number
  lastOrderAt?: string
}

export interface DraftProduct {
  id: number
  name: string
  imageUrl?: string
  isShopifyLinked: boolean
  colorwayCount: number
  variantCount: number
}

export interface SkippedDraftProduct {
  id: number
  name: string
  reason: string
}

export interface DeleteDraftProductsResult {
  totalDrafts: number
  deleted: number
  skipped: SkippedDraftProduct[]
}

export const productsApi = {
  getAll: () => api.get<Product[]>('/products').then((r) => r.data),
  getOnlineStats: () => api.get<OnlineProductStats[]>('/products/online-stats').then((r) => r.data),
  getById: (id: number) => api.get<Product>(`/products/${id}`).then((r) => r.data),
  search: (query: string) => api.get<Product[]>('/products/search', { params: { query } }).then((r) => r.data),
  create: (data: CreateProductRequest) => api.post<Product>('/products', data).then((r) => r.data),
  update: (id: number, data: Partial<Product>) => api.put<Product>(`/products/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/products/${id}`),
  uploadImage: (id: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ imageUrl: string }>(`/products/${id}/image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },
  addVariant: (data: CreateProductVariantRequest) => api.post<ProductVariant>('/products/variants', data).then((r) => r.data),
  updateVariant: (variantId: number, data: Partial<ProductVariant>) => api.put<ProductVariant>(`/products/variants/${variantId}`, data).then((r) => r.data),
  deleteVariant: (variantId: number) => api.delete(`/products/variants/${variantId}`),
  getVariantByBarcode: (barcode: string) => api.get<ProductVariant>(`/products/variants/barcode/${barcode}`).then((r) => r.data),
  getByBarcode: (barcode: string) => api.get<Product>(`/products/barcode/${barcode}`).then((r) => r.data),
  generateMissingBarcodes: () => api.post<{ generated: number }>('/products/generate-barcodes').then((r) => r.data),
  getDrafts: () => api.get<DraftProduct[]>('/products/drafts').then((r) => r.data),
  deleteDrafts: () => api.delete<DeleteDraftProductsResult>('/products/drafts').then((r) => r.data),
}
