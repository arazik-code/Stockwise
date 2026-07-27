import api from './client'
import type { Sale, CreateSaleRequest, DailySalesReport, SalesReport } from '../types/sale'

export const salesApi = {
  getAll: () => api.get<Sale[]>('/sales').then((r) => r.data),
  getById: (id: number) => api.get<Sale>(`/sales/${id}`).then((r) => r.data),
  create: (data: CreateSaleRequest) => api.post<Sale>('/sales', data).then((r) => r.data),
  remove: (id: number) => api.delete(`/sales/${id}`),
  removeMany: (ids: number[]) => api.post('/sales/bulk-delete', { ids }).then((r) => r.data),
  getDailyReport: (date?: string) =>
    api.get<DailySalesReport>('/sales/daily-report', { params: { date } }).then((r) => r.data),
  getSalesReport: (from: string, to: string, fournisseurId?: number | null, category?: string | null) =>
    api.get<SalesReport>('/sales/sales-report', { params: { from, to, fournisseurId, category } }).then((r) => r.data),
}
