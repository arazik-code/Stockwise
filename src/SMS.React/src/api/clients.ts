import api from './client'
import type { Sale } from '../types/sale'
import type { ClientCategoryValue } from '../utils/clientCategory'

export interface Client {
  id: number
  name: string
  phone: string
  qrCode: string
  totalPoints: number
  lifetimePoints: number
  totalSpent: number
  visitCount: number
  loyaltyRate: number
  createdAt: string
  lastVisitAt?: string
  recentTransactions?: LoyaltyTransaction[]
  effectiveCategory: ClientCategoryValue
  manualCategory?: ClientCategoryValue | null
  computedCategory: ClientCategoryValue
  categoryUpdatedAt?: string
}

export interface LoyaltyTransaction {
  id: number
  pointsChange: number
  type: string
  description?: string
  balanceAfter: number
  createdAt: string
}

export interface CreateClientRequest {
  name: string
  phone: string
}

export interface LoyaltySettingsConfig {
  newClientRate: number
  ancientClientRate: number
  premiumClientRate: number
  pointsForRedemption: number
  dhPerRedemption: number
  welcomePoints: number
  enabled: boolean
}

export interface StoreSettingsConfig {
  name: string
  phone: string
  address: string
}

export interface TaxSettingsConfig {
  rate: number
}

export interface InvoiceTemplateConfig {
  shopName: string
  shopAddress: string
  shopPhone: string
  shopEmail: string
  shopWebsite: string
  taxId: string
  logoBase64: string
  showSku: boolean
  showColor: boolean
  showSize: boolean
  showBarcode: boolean
  showDescription: boolean
  showHeader: boolean
  showFooter: boolean
  showTax: boolean
  showPaymentInfo: boolean
  showSignature: boolean
  showBorders: boolean
  fontFamily: string
  fontSize: string
  headerText: string
  footerText: string
  notesLabel: string
  defaultNotes: string
  paperSize: string
  landscape: boolean
}

export interface ReceiptTemplateConfig {
  shopName: string
  shopTagline: string
  shopAddress: string
  shopPhone: string
  shopWebsite: string
  logoBase64: string
  showTicketNumber: boolean
  showDate: boolean
  showCashier: boolean
  showVariantDetails: boolean
  showSku: boolean
  showUnitPrice: boolean
  showSubtotal: boolean
  showTax: boolean
  showDiscount: boolean
  showPaymentMethod: boolean
  showLoyaltyInfo: boolean
  showQrCode: boolean
  headerText: string
  footerText: string
  termsText: string
  fontFamily: string
}

export interface ShopifySettingsConfig {
  shopDomain: string
  apiVersion: string
  locationId: string
  pollingIntervalSeconds: number
  accessTokenSet: boolean
  accessTokenMasked: string
  webhookSecretSet: boolean
  webhookSecretMasked: string
  clientIdSet: boolean
  clientIdMasked: string
  clientSecretSet: boolean
  clientSecretMasked: string
}

export interface ShopifySettingsUpdate {
  shopDomain: string
  accessToken?: string
  clientId?: string
  clientSecret?: string
  apiVersion: string
  webhookSecret?: string
  pollingIntervalSeconds: number
  locationId: string
}

export const clientsApi = {
  getAll: (search?: string, category?: ClientCategoryValue) =>
    api.get<Client[]>('/clients', { params: { search, category } }).then((r) => r.data),
  getById: (id: number) => api.get<Client>(`/clients/${id}`).then((r) => r.data),
  getByQrCode: (qrCode: string) => api.get<Client>(`/clients/qr/${qrCode}`).then((r) => r.data),
  getByPhone: (phone: string) => api.get<Client>(`/clients/phone/${phone}`).then((r) => r.data),
  create: (data: CreateClientRequest) => api.post<Client>('/clients', data).then((r) => r.data),
  update: (id: number, data: Partial<Client>) => api.put<Client>(`/clients/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/clients/${id}`).then((r) => r.data),
  adjustPoints: (id: number, points: number, reason?: string) =>
    api.post<Client>(`/clients/${id}/adjust-points`, { points, reason }).then((r) => r.data),
  getSales: (id: number) => api.get<Sale[]>(`/clients/${id}/sales`).then((r) => r.data),
  // category = null reverts to automatic (clears the manual override).
  setCategory: (id: number, category: ClientCategoryValue | null, reason?: string) =>
    api.post<Client>(`/clients/${id}/category`, { category, reason }).then((r) => r.data),
  recalculateCategories: () =>
    api.post<{ recalculated: number }>('/clients/recalculate-categories', {}).then((r) => r.data),
}

export type ClientSegment = 'New' | 'Regular' | 'Vip' | 'AtRisk' | 'Lost'

export interface ClientCrmSummary {
  id: number
  name: string
  phone: string
  email?: string
  totalSpent: number
  orderCount: number
  lastOrderAt?: string
  daysSinceLastOrder?: number
  segment: ClientSegment
  favoriteCategory?: string
  tags?: string
  isShopifyImported: boolean
  createdAt: string
  city?: string
  addressLine?: string
  shopifyTotalSpent?: number
  shopifyOrdersCount?: number
  loyaltyCategory: ClientCategoryValue
}

export interface CrmDashboard {
  totalClients: number
  totalRevenue: number
  vipCount: number
  atRiskCount: number
  lostCount: number
  newCount: number
  clients: ClientCrmSummary[]
}

export interface ClientPurchaseHistoryItem {
  date: string
  source: string
  orderReference: string
  productName: string
  sku?: string
  colorName?: string
  sizeValue?: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface CategoryBreakdownItem {
  categoryName: string
  amountSpent: number
  unitsBought: number
}

export interface ProductRecommendation {
  productId: number
  name: string
  imageUrl?: string
  price: number
  categoryName: string
  reason: string
}

export interface ClientAnalytics {
  summary: ClientCrmSummary
  purchaseHistory: ClientPurchaseHistoryItem[]
  categoryBreakdown: CategoryBreakdownItem[]
  recommendations: ProductRecommendation[]
}

export interface ShopifyClientImportResult {
  configured: boolean
  approved: boolean
  message?: string
  created: number
  updated: number
  totalFetched: number
  ordersImported: number
  ordersFetched: number
  orderItemsMatched: number
}

export interface CrmSegmentCount {
  segment: ClientSegment
  count: number
  revenue: number
}

export interface CrmCityStat {
  city: string
  clientCount: number
  revenue: number
}

export interface CrmTopProduct {
  productId: number
  name: string
  imageUrl?: string
  categoryName: string
  unitsSold: number
  revenue: number
}

export interface CrmTopCategory {
  categoryName: string
  unitsSold: number
  revenue: number
  buyerCount: number
}

export interface CrmAnalytics {
  totalClients: number
  clientsWithOrders: number
  totalRevenue: number
  avgClientValue: number
  shopifyImportedCount: number
  avgOrderValue: number
  totalOrders: number
  repeatClients: number
  repeatRate: number
  clientsWithCity: number
  distinctCities: number
  segments: CrmSegmentCount[]
  cities: CrmCityStat[]
  topProducts: CrmTopProduct[]
  topCategories: CrmTopCategory[]
  topClients: ClientCrmSummary[]
}

export const crmApi = {
  getDashboard: () => api.get<CrmDashboard>('/clients/crm-summary').then((r) => r.data),
  getCrmAnalytics: () => api.get<CrmAnalytics>('/clients/crm-analytics').then((r) => r.data),
  getAnalytics: (id: number) => api.get<ClientAnalytics>(`/clients/${id}/analytics`).then((r) => r.data),
  importFromShopify: () =>
    api.post<ShopifyClientImportResult>('/clients/import-shopify', {}, { timeout: 600000 }).then((r) => r.data),
}

export const settingsApi = {
  getLoyalty: () => api.get<LoyaltySettingsConfig>('/settings/loyalty').then((r) => r.data),
  updateLoyalty: (data: LoyaltySettingsConfig) => api.put<LoyaltySettingsConfig>('/settings/loyalty', data).then((r) => r.data),
  getStore: () => api.get<StoreSettingsConfig>('/settings/store').then((r) => r.data),
  updateStore: (data: StoreSettingsConfig) => api.put<StoreSettingsConfig>('/settings/store', data).then((r) => r.data),
  getTax: () => api.get<TaxSettingsConfig>('/settings/tax').then((r) => r.data),
  updateTax: (data: TaxSettingsConfig) => api.put<TaxSettingsConfig>('/settings/tax', data).then((r) => r.data),
  getInvoiceTemplate: () => api.get<InvoiceTemplateConfig>('/settings/invoice-template').then((r) => r.data),
  updateInvoiceTemplate: (data: InvoiceTemplateConfig) => api.put<InvoiceTemplateConfig>('/settings/invoice-template', data).then((r) => r.data),
  getReceiptTemplate: () => api.get<ReceiptTemplateConfig>('/settings/receipt-template').then((r) => r.data),
  updateReceiptTemplate: (data: ReceiptTemplateConfig) => api.put<ReceiptTemplateConfig>('/settings/receipt-template', data).then((r) => r.data),
  getShopify: () => api.get<ShopifySettingsConfig>('/settings/shopify').then((r) => r.data),
  updateShopify: (data: ShopifySettingsUpdate) => api.put<{ message: string }>('/settings/shopify', data).then((r) => r.data),
}
