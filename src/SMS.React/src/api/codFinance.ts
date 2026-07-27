import api from './client'

export type CodLedgerEntryType =
  | 'CodExpected' | 'CodCollected' | 'CourierFeeDelivered' | 'CourierFeeReturned'
  | 'CourierFeeRefused' | 'Remittance' | 'Adjustment' | 'WriteOff'

export interface CodLedgerEntry {
  id: number
  onlineOrderId: number
  orderNumber: string
  ozonParcelId?: number
  trackingNumber?: string
  type: CodLedgerEntryType
  amount: number
  courierRemittanceId?: number
  source: string
  note?: string
  occurredAt: string
}

export interface CodAgingBucket {
  label: string
  count: number
  amount: number
}

export interface CodOutstandingOrder {
  onlineOrderId: number
  orderNumber: string
  trackingNumber?: string
  customerName: string
  codAmount: number
  deliveredAt?: string
  daysOutstanding: number
}

export interface CodFinanceDashboard {
  outstandingCod: number
  outstandingCount: number
  collectedThisMonth: number
  courierFeesThisMonth: number
  netThisMonth: number
  unreconciledParcels: number
  aging: CodAgingBucket[]
  oldestOutstanding: CodOutstandingOrder[]
}

export type CourierRemittanceStatus = 'Draft' | 'Reconciled' | 'Disputed' | 'Closed'

export interface CourierRemittance {
  id: number
  carrier: string
  reference?: string
  periodStart: string
  periodEnd: string
  declaredAmount: number
  matchedAmount: number
  varianceAmount: number
  status: CourierRemittanceStatus
  receivedAt: string
  orderCount: number
}

export interface CreateRemittanceRequest {
  carrier: string
  reference?: string
  periodStart: string
  periodEnd: string
  declaredAmount: number
  bankRef?: string
  onlineOrderIds: number[]
}

export const codFinanceApi = {
  getDashboard: () => api.get<CodFinanceDashboard>('/cod-finance/dashboard').then((r) => r.data),
  getLedger: (onlineOrderId?: number) =>
    api.get<CodLedgerEntry[]>('/cod-finance/ledger', { params: { onlineOrderId } }).then((r) => r.data),
  getRemittances: () => api.get<CourierRemittance[]>('/cod-finance/remittances').then((r) => r.data),
  createRemittance: (data: CreateRemittanceRequest) =>
    api.post<CourierRemittance>('/cod-finance/remittances', data).then((r) => r.data),
}
