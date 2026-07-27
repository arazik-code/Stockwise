import api from './client'
import type { Invoice, CreateInvoiceRequest, PayInvoiceRequest, CancelInvoiceRequest, InvoiceSummary, InvoiceLabelData } from '../types/invoice'

export const invoicesApi = {
  getAll: () => api.get<Invoice[]>('/invoices').then((r) => r.data),
  getById: (id: number) => api.get<Invoice>(`/invoices/${id}`).then((r) => r.data),
  getByFournisseur: (fournisseurId: number) =>
    api.get<Invoice[]>(`/invoices/fournisseur/${fournisseurId}`).then((r) => r.data),
  search: (params: { query?: string; status?: string; fournisseurId?: number }) =>
    api.get<Invoice[]>('/invoices/search', { params }).then((r) => r.data),
  create: (data: CreateInvoiceRequest) => api.post<Invoice>('/invoices', data).then((r) => r.data),
  update: (id: number, data: CreateInvoiceRequest) => api.put<Invoice>(`/invoices/${id}`, data).then((r) => r.data),
  pay: (id: number, data: PayInvoiceRequest) => api.post<Invoice>(`/invoices/${id}/pay`, data).then((r) => r.data),
  cancel: (id: number, data?: CancelInvoiceRequest) =>
    api.post<Invoice>(`/invoices/${id}/cancel`, data).then((r) => r.data),
  receive: (id: number) => api.post<Invoice>(`/invoices/${id}/receive`).then((r) => r.data),
  getLabels: (id: number) => api.get<InvoiceLabelData[]>(`/invoices/${id}/labels`).then((r) => r.data),
  cancelMany: (ids: number[]) => api.post<{ cancelled: number }>('/invoices/cancel-many', { ids }).then((r) => r.data),
  getSummary: () => api.get<InvoiceSummary>('/invoices/summary').then((r) => r.data),
}
