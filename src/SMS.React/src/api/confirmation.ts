import api from './client'

export type ConfirmationStatus = 'New' | 'InProgress' | 'Confirmed' | 'Unreachable' | 'Refused' | 'Duplicate'
export type ConfirmationChannel = 'Call' | 'WhatsApp' | 'Sms'
export type ConfirmationOutcome =
  | 'Confirmed' | 'NoAnswer' | 'Busy' | 'WrongNumber' | 'Refused' | 'Postponed' | 'Duplicate' | 'AskedToChange'

export interface ConfirmationQueueItem {
  onlineOrderId: number
  orderNumber: string
  customerName: string
  customerPhone?: string
  city?: string
  totalAmount: number
  itemCount: number
  status: ConfirmationStatus
  attemptCount: number
  lastAttemptAt?: string
  nextCallbackAt?: string
  createdAt: string
  priorDeliveredOrders: number
  duplicateOrderWarning: boolean
}

export interface ConfirmationStats {
  queueCount: number
  dueCallbacks: number
  confirmedToday: number
  totalAttemptsToday: number
  confirmationRatePercent: number
}

export interface ConfirmationAttempt {
  id: number
  channel: ConfirmationChannel
  outcome: ConfirmationOutcome
  note?: string
  createdAt: string
  agentName?: string
}

export const confirmationApi = {
  getQueue: () => api.get<ConfirmationQueueItem[]>('/order-confirmation/queue').then((r) => r.data),
  getStats: () => api.get<ConfirmationStats>('/order-confirmation/stats').then((r) => r.data),
  getAttempts: (onlineOrderId: number) =>
    api.get<ConfirmationAttempt[]>(`/order-confirmation/${onlineOrderId}/attempts`).then((r) => r.data),
  logAttempt: (onlineOrderId: number, channel: ConfirmationChannel, outcome: ConfirmationOutcome, note?: string) =>
    api.post(`/order-confirmation/${onlineOrderId}/attempts`, { channel, outcome, note }),
}
