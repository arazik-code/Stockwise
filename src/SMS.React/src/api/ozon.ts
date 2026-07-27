import api from './client'

export type OzonParcelStatus =
  | 'New' | 'PickedUp' | 'AtHub' | 'InTransit' | 'OutForDelivery'
  | 'Delivered' | 'Returned' | 'Refused' | 'Cancelled' | 'Unknown'

export type OzonDeliveryNoteStatus = 'Draft' | 'Saved'

export interface OzonConfigStatus {
  configured: boolean
  customerId?: string
  cityCount: number
  citiesUpdatedAt?: string
}

export interface OzonCity {
  id: number
  ref: string
  name: string
  deliveredPrice: number
  returnedPrice: number
  refusedPrice: number
}

export interface OzonParcel {
  id: number
  onlineOrderId?: number
  orderNumber?: string
  trackingNumber: string
  receiver: string
  phone: string
  cityId: number
  cityName?: string
  address: string
  note?: string
  nature?: string
  price: number
  deliveredPrice?: number
  returnedPrice?: number
  refusedPrice?: number
  isStock: boolean
  fragile: boolean
  status: OzonParcelStatus
  statusText?: string
  deliveryNoteRef?: string
  lastSyncedAt?: string
  createdAt: string
}

export interface CreateOzonParcelRequest {
  onlineOrderId?: number
  receiver: string
  phone: string
  cityId: number
  address: string
  price: number
  isStock?: boolean
  note?: string
  nature?: string
  fragile?: boolean
  allowOpen?: boolean
  canReplace?: boolean
}

export interface OzonParcelResult {
  ok: boolean
  error?: string
  parcel?: OzonParcel
}

export interface OzonTrackingEvent {
  date?: string
  status: string
  comment?: string
}

export interface OzonTracking {
  ok: boolean
  error?: string
  trackingNumber: string
  status: OzonParcelStatus
  statusText?: string
  events: OzonTrackingEvent[]
}

export interface OzonSyncTrackingResult {
  synced: number
  updated: number
}

export interface OzonDeliveryNote {
  id: number
  ref: string
  status: OzonDeliveryNoteStatus
  parcelCount: number
  createdAt: string
  savedAt?: string
  pdfUrl: string
  labelsA4Url: string
  labels10x10Url: string
}

export interface OzonDeliveryNoteResult {
  ok: boolean
  error?: string
  deliveryNote?: OzonDeliveryNote
}

export interface OzonCityStat {
  city: string
  count: number
  cod: number
}

export interface OzonDashboard {
  configured: boolean
  totalParcels: number
  inTransit: number
  delivered: number
  returned: number
  refused: number
  pending: number
  codPending: number
  codCollected: number
  courierFees: number
  deliveryNoteCount: number
  recentParcels: OzonParcel[]
  topCities: OzonCityStat[]
}

export interface OzonSettingsConfig {
  customerId: string
  apiKeySet: boolean
  apiKeyMasked: string
}

export interface OzonSettingsUpdate {
  customerId: string
  apiKey?: string
}

export const ozonApi = {
  getStatus: () => api.get<OzonConfigStatus>('/ozonexpress/status').then((r) => r.data),
  getDashboard: () => api.get<OzonDashboard>('/ozonexpress/dashboard').then((r) => r.data),
  syncCities: () => api.post<{ count: number }>('/ozonexpress/sync-cities', {}, { timeout: 120000 }).then((r) => r.data),
  getCities: (search?: string) => api.get<OzonCity[]>('/ozonexpress/cities', { params: { search } }).then((r) => r.data),
  getParcels: (params?: { status?: string; search?: string }) =>
    api.get<OzonParcel[]>('/ozonexpress/parcels', { params }).then((r) => r.data),
  getParcel: (id: number) => api.get<OzonParcel>(`/ozonexpress/parcels/${id}`).then((r) => r.data),
  getParcelByOrder: (onlineOrderId: number) =>
    api.get<OzonParcel>(`/ozonexpress/parcels/by-order/${onlineOrderId}`).then((r) => r.data).catch(() => null),
  createParcel: (data: CreateOzonParcelRequest) =>
    api.post<OzonParcelResult>('/ozonexpress/parcels', data).then((r) => r.data),
  track: (id: number) => api.get<OzonTracking>(`/ozonexpress/parcels/${id}/track`).then((r) => r.data),
  syncTracking: () => api.post<OzonSyncTrackingResult>('/ozonexpress/parcels/sync-tracking', {}, { timeout: 180000 }).then((r) => r.data),
  getDeliveryNotes: () => api.get<OzonDeliveryNote[]>('/ozonexpress/delivery-notes').then((r) => r.data),
  createDeliveryNote: (trackingNumbers: string[]) =>
    api.post<OzonDeliveryNoteResult>('/ozonexpress/delivery-notes', { trackingNumbers }, { timeout: 60000 }).then((r) => r.data),
  getSettings: () => api.get<OzonSettingsConfig>('/settings/ozonexpress').then((r) => r.data),
  updateSettings: (data: OzonSettingsUpdate) => api.put<{ message: string }>('/settings/ozonexpress', data).then((r) => r.data),
}

// The real, OzonExpress-branded PDF for a given Bon de Livraison reference — this is what actually
// gets printed/attached to shipments, replacing any home-grown "Bon de Commande" document.
export const ozonDeliveryNotePdfUrl = (deliveryNoteRef: string) =>
  `https://client.ozoneexpress.ma/pdf-delivery-note?dn-ref=${encodeURIComponent(deliveryNoteRef)}`

export const OZON_STATUS_META: Record<OzonParcelStatus, { label: string; className: string; dot: string }> = {
  New: { label: 'Nouveau', className: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  PickedUp: { label: 'Ramassé', className: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  AtHub: { label: 'Au hub', className: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
  InTransit: { label: 'En transit', className: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  OutForDelivery: { label: 'En livraison', className: 'bg-cyan-50 text-cyan-700', dot: 'bg-cyan-500' },
  Delivered: { label: 'Livré', className: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  Returned: { label: 'Retourné', className: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
  Refused: { label: 'Refusé', className: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  Cancelled: { label: 'Annulé', className: 'bg-slate-100 text-slate-400', dot: 'bg-slate-300' },
  Unknown: { label: 'Inconnu', className: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
}
