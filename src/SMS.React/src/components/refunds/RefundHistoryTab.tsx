import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../utils/format'
import type { Refund } from '../../api/refunds'
import type { HistoryStatusFilter } from '../../pages/RefundsPage'

/**
 * History tab: stat tiles, status/search filters, expandable refund cards.
 * Mechanical extraction from RefundsPage — all state and handlers are owned
 * by the parent and threaded through as props.
 */

export interface RefundHistoryTabProps {
  loading: boolean
  historyStats: {
    total: number
    refundsCount: number
    exchangesCount: number
    totalRefunded: number
    pendingCount: number
  }
  historyStatusFilter: HistoryStatusFilter
  setHistoryStatusFilter: (value: HistoryStatusFilter) => void
  historyStatusFilters: { key: HistoryStatusFilter; label: string }[]
  historySearchQuery: string
  setHistorySearchQuery: (value: string) => void
  filteredRefunds: Refund[]
  expandedRefundId: number | null
  setExpandedRefundId: (value: number | null) => void
  formatDate: (d: string) => string
  handlePrintReceipt: (refund: Refund) => void
  handleProcessRefund: (id: number) => void
  handleCancelRefund: (id: number) => void
}

export default function RefundHistoryTab({
  loading,
  historyStats,
  historyStatusFilter,
  setHistoryStatusFilter,
  historyStatusFilters,
  historySearchQuery,
  setHistorySearchQuery,
  filteredRefunds,
  expandedRefundId,
  setExpandedRefundId,
  formatDate,
  handlePrintReceipt,
  handleProcessRefund,
  handleCancelRefund,
}: RefundHistoryTabProps) {
  const { t } = useTranslation()

  const refundStatusBadge = (status: string) => {
    if (status === 'Completed') return 'bg-emerald-100 text-emerald-700'
    if (status === 'Cancelled') return 'bg-red-100 text-red-700'
    return 'bg-yellow-100 text-yellow-700'
  }

  const refundStatusLabel = (status: string, tFn: (k: string) => string) => {
    if (status === 'Completed') return tFn('refunds.completed')
    if (status === 'Cancelled') return tFn('refunds.cancelled')
    return tFn('refunds.pending')
  }

  return (
    <div className="max-w-5xl">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">
            {t('refunds.stats.totalOperations')}
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{historyStats.total}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">
            {t('refunds.stats.refundsCount')}
          </p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{historyStats.refundsCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">
            {t('refunds.stats.exchangesCount')}
          </p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{historyStats.exchangesCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">
            {t('refunds.stats.totalRefunded')}
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {formatCurrency(historyStats.totalRefunded)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">
            {t('refunds.stats.pendingCount')}
          </p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{historyStats.pendingCount}</p>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {historyStatusFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setHistoryStatusFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              historyStatusFilter === f.key
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={historySearchQuery}
          onChange={(e) => setHistorySearchQuery(e.target.value)}
          placeholder={t('refunds.searchHistoryPlaceholder')}
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Refunds count */}
      <div className="text-xs text-slate-500 mb-3">
        {filteredRefunds.length} {t('refunds.operationsFound')}
      </div>

      {/* Refund cards */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">{t('common.loading')}</div>
      ) : filteredRefunds.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">{t('refunds.noRefunds')}</div>
      ) : (
        <div className="space-y-3">
          {filteredRefunds.map((refund) => {
            const isExpanded = expandedRefundId === refund.id
            return (
              <div
                key={refund.id}
                className="bg-white rounded-lg border border-slate-200 overflow-hidden transition-colors"
              >
                {/* Card header */}
                <div
                  onClick={() => setExpandedRefundId(isExpanded ? null : refund.id)}
                  className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Type badge */}
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          refund.type === 'Exchange'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {refund.type === 'Exchange'
                          ? t('refunds.typeExchange')
                          : t('refunds.typeRefund')}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {refund.refundNumber}
                        </p>
                        <p className="text-xs text-slate-500">
                          {refund.saleNumber} ·{' '}
                          {refund.clientName ?? t('refunds.walkInClient')} ·{' '}
                          {formatDate(refund.refundDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${refundStatusBadge(refund.status)}`}
                      >
                        {refundStatusLabel(refund.status, t)}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {formatCurrency(
                          refund.type === 'Exchange'
                            ? refund.totalExchangeAmount
                            : refund.totalRefundAmount
                        )}
                      </span>
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-4">
                    {/* Reason & Notes */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-slate-600">{t('refunds.reason')}:</span>{' '}
                        <span className="text-slate-700">{refund.reason}</span>
                      </div>
                      {refund.notes && (
                        <div>
                          <span className="font-medium text-slate-600">{t('refunds.notes')}:</span>{' '}
                          <span className="text-slate-700">{refund.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Returned items table */}
                    {refund.items.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase mb-2">
                          {t('refunds.returnedItems')}
                        </p>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="text-left py-2 font-medium text-slate-600">
                                {t('products.product')}
                              </th>
                              <th className="text-right py-2 font-medium text-slate-600">
                                {t('common.quantity')}
                              </th>
                              <th className="text-right py-2 font-medium text-slate-600">
                                {t('refunds.amount')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {refund.items.map((item) => (
                              <tr key={item.id} className="border-b border-slate-50">
                                <td className="py-2 text-slate-700">
                                  <p className="font-medium">{item.productName}</p>
                                  {item.colorName && item.sizeValue && (
                                    <p className="text-xs text-slate-400">
                                      {item.colorName} · {item.sizeValue}
                                    </p>
                                  )}
                                </td>
                                <td className="py-2 text-right text-slate-600">
                                  {item.quantity}
                                </td>
                                <td className="py-2 text-right text-slate-600">
                                  {formatCurrency(item.refundAmount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Exchanged items table */}
                    {refund.type === 'Exchange' && refund.exchangeItems.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase mb-2">
                          {t('refunds.exchangedItems')}
                        </p>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="text-left py-2 font-medium text-slate-600">
                                {t('products.product')}
                              </th>
                              <th className="text-right py-2 font-medium text-slate-600">
                                {t('common.quantity')}
                              </th>
                              <th className="text-right py-2 font-medium text-slate-600">
                                {t('refunds.amount')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {refund.exchangeItems.map((item) => (
                              <tr key={item.id} className="border-b border-slate-50">
                                <td className="py-2 text-slate-700">
                                  <p className="font-medium">{item.productName}</p>
                                  {item.colorName && item.sizeValue && (
                                    <p className="text-xs text-slate-400">
                                      {item.colorName} · {item.sizeValue}
                                    </p>
                                  )}
                                </td>
                                <td className="py-2 text-right text-slate-600">
                                  {item.quantity}
                                </td>
                                <td className="py-2 text-right text-slate-600">
                                  {formatCurrency(item.totalPrice)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {refund.priceDifference !== 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-sm font-medium">
                            <span className="text-slate-500">{t('refunds.priceDifference')}</span>
                            <span
                              className={
                                refund.priceDifference >= 0 ? 'text-red-600' : 'text-emerald-600'
                              }
                            >
                              {refund.priceDifference >= 0 ? '+' : ''}
                              {formatCurrency(refund.priceDifference)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePrintReceipt(refund)
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                          />
                        </svg>
                        {t('refunds.printReceipt')}
                      </button>

                      {refund.status === 'Pending' && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleProcessRefund(refund.id)
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            {t('refunds.process')}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCancelRefund(refund.id)
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                            {t('common.cancel')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
