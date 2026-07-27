import api from './client'
import type { DashboardData, InventoryReportItem, SalesByChannelItem, TopProductItem } from '../types/report'

export const reportsApi = {
  getDashboard: () => api.get<DashboardData>('/reports/dashboard').then((r) => r.data),
  getInventory: () => api.get<InventoryReportItem[]>('/reports/inventory').then((r) => r.data),
  getSalesByChannel: (from?: string, to?: string) =>
    api.get<SalesByChannelItem[]>('/reports/sales-by-channel', { params: { from, to } }).then((r) => r.data),
  getTopProducts: (from?: string, to?: string, count?: number) =>
    api.get<TopProductItem[]>('/reports/top-products', { params: { from, to, count } }).then((r) => r.data),

  // ─── PDF downloads ──────────────────────────────────
  downloadStockPdf: (from?: string, to?: string) =>
    api.get('/reports/pdf/stock', { params: { from, to }, responseType: 'blob' }),
  downloadSalesPdf: (from?: string, to?: string) =>
    api.get('/reports/pdf/sales', { params: { from, to }, responseType: 'blob' }),
  downloadFournisseursPdf: () =>
    api.get('/reports/pdf/fournisseurs', { responseType: 'blob' }),
  downloadProductsPdf: (from?: string, to?: string) =>
    api.get('/reports/pdf/products', { params: { from, to }, responseType: 'blob' }),
  downloadDashboardPdf: (from?: string, to?: string) =>
    api.get('/reports/pdf/dashboard', { params: { from, to }, responseType: 'blob' }),

  // ─── CSV downloads ──────────────────────────────────
  downloadStockCsv: () =>
    api.get('/reports/csv/stock', { responseType: 'blob' }),
  downloadSalesCsv: (from?: string, to?: string) =>
    api.get('/reports/csv/sales', { params: { from, to }, responseType: 'blob' }),
  downloadFournisseursCsv: () =>
    api.get('/reports/csv/fournisseurs', { responseType: 'blob' }),
  downloadProductsCsv: () =>
    api.get('/reports/csv/products', { responseType: 'blob' }),
}
