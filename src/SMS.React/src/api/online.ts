import api from './client'
import type {
  OnlineOrder,
  CreateManualOrderRequest,
  AssignShippingRequest,
  OnlineDashboard,
  OnlineReport,
  OnlineOrderChannel,
  OnlineOrderStatus,
} from '../types/onlineOrder'

export const onlineApi = {
  getAll: (params?: { channel?: OnlineOrderChannel; status?: OnlineOrderStatus; from?: string; to?: string }) =>
    api.get<OnlineOrder[]>('/online-orders', { params }).then((r) => r.data),
  getById: (id: number) => api.get<OnlineOrder>(`/online-orders/${id}`).then((r) => r.data),
  create: (data: CreateManualOrderRequest) => api.post<OnlineOrder>('/online-orders', data).then((r) => r.data),
  updateStatus: (id: number, status: OnlineOrderStatus) =>
    api.put<OnlineOrder>(`/online-orders/${id}/status`, { status }).then((r) => r.data),
  confirmAndShip: (id: number) =>
    api.post<{ order: OnlineOrder; parcel: { ok: boolean; error?: string; parcel?: { trackingNumber: string; deliveryNoteRef?: string } } }>(`/online-orders/${id}/confirm-ship`, {}, { timeout: 60000 }).then((r) => r.data),
  cancel: (id: number, reason?: string) => api.post(`/online-orders/${id}/cancel`, { reason }),
  markPaid: (id: number, amountPaid?: number) =>
    api.post<OnlineOrder>(`/online-orders/${id}/pay`, { amountPaid }).then((r) => r.data),
  assignShipping: (id: number, data: AssignShippingRequest) =>
    api.put<OnlineOrder>(`/online-orders/${id}/shipping`, data).then((r) => r.data),
  getDashboard: () => api.get<OnlineDashboard>('/online-orders/dashboard').then((r) => r.data),
  getConflicts: () => api.get<OnlineOrder[]>('/online-orders/conflicts').then((r) => r.data),
  getReport: (from: string, to: string) =>
    api.get<OnlineReport>('/online-orders/reports', { params: { from, to } }).then((r) => r.data),
}
