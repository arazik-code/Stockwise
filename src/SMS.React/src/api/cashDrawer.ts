import api from './client'

export type CashDrawerMovementType = 'Deposit' | 'Withdrawal'

export interface CashDrawerMovement {
  id: number
  type: CashDrawerMovementType
  amount: number
  reason?: string
  userFullName: string
  createdAt: string
}

export interface CashDrawerSummary {
  balance: number
  cashSalesTotal: number
  cashRefundsTotal: number
  manualNet: number
  recent: CashDrawerMovement[]
}

export interface CreateCashDrawerMovementRequest {
  type: CashDrawerMovementType
  amount: number
  reason?: string
}

export const cashDrawerApi = {
  getSummary: () => api.get<CashDrawerSummary>('/cash-drawer/summary').then((r) => r.data),
  create: (request: CreateCashDrawerMovementRequest) =>
    api.post<CashDrawerMovement>('/cash-drawer', request).then((r) => r.data),
}
