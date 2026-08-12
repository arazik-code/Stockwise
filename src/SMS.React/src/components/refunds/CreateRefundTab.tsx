import { type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../utils/format'
import RefundScanner from './RefundScanner'
import RefundLineItems from './RefundLineItems'
import type { Sale } from '../../types/sale'
import type { SaleForRefund, SaleItemForRefund, ProductVariantForExchange } from '../../api/refunds'
import type { RefundItemSelection, ExchangeItemSelection, TimeFilter, RefundType } from '../../pages/RefundsPage'

/**
 * Create-tab surface: sale lookup list, then per-line item selection for a
 * refund/exchange. Mechanical extraction from RefundsPage — all state and
 * handlers are owned by the parent and threaded through as props.
 */

export interface CreateRefundTabProps {
  loading: boolean

  // Receipt QR scanner (-> RefundScanner)
  receiptQrRef: RefObject<HTMLInputElement | null>
  receiptQrQuery: string
  scanningQr: boolean
  qrError: string | null
  handleReceiptQrInput: (value: string) => void
  handleReceiptQrKeyDown: (e: React.KeyboardEvent) => void
  setQrError: (value: string | null) => void
  setReceiptQrQuery: (value: string) => void
  scannedSales: SaleForRefund[]
  setScannedSales: (value: SaleForRefund[]) => void
  handleSelectScannedSale: (saleId: number) => void

  // Sales list
  saleSearchRef: RefObject<HTMLInputElement | null>
  searchQuery: string
  setSearchQuery: (value: string) => void
  timeFilter: TimeFilter
  setTimeFilter: (value: TimeFilter) => void
  timeFilters: { key: TimeFilter; label: string }[]
  customDateFrom: string
  setCustomDateFrom: (value: string) => void
  customDateTo: string
  setCustomDateTo: (value: string) => void
  filteredSales: Sale[]
  handleSelectSale: (s: Sale) => void
  formatDate: (d: string) => string

  // Sale detail
  sale: SaleForRefund | null
  setSale: (value: SaleForRefund | null) => void
  setSelections: (value: RefundItemSelection[]) => void
  setExchangeSelections: (value: ExchangeItemSelection[]) => void
  setReason: (value: string) => void
  setNotes: (value: string) => void
  refundType: RefundType
  setRefundType: (value: RefundType) => void
  selections: RefundItemSelection[]
  handleToggleItem: (item: SaleItemForRefund) => void
  handleSelectAllItems: () => void

  // Exchange section
  exchangeSearchQuery: string
  exchangeSearchResults: ProductVariantForExchange[]
  searchingExchange: boolean
  exchangeInputRef: RefObject<HTMLInputElement | null>
  handleExchangeInput: (value: string) => void
  handleExchangeKeyDown: (e: React.KeyboardEvent) => void
  handleAddExchangeItem: (variant: ProductVariantForExchange) => void
  exchangeSelections: ExchangeItemSelection[]
  handleExchangeQuantityChange: (variantId: number, quantity: number) => void
  handleRemoveExchangeItem: (variantId: number) => void

  // Summary + submit
  reason: string
  notes: string
  totalRefund: number
  totalExchange: number
  priceDifference: number
  submitting: boolean
  handleSubmitRefund: () => void
  handleExchangeViaPos: () => void
}

const gradientColors = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
]

const getGradient = (id: number) => gradientColors[id % gradientColors.length]

export default function CreateRefundTab({
  loading,
  receiptQrRef,
  receiptQrQuery,
  scanningQr,
  qrError,
  handleReceiptQrInput,
  handleReceiptQrKeyDown,
  setQrError,
  setReceiptQrQuery,
  scannedSales,
  setScannedSales,
  handleSelectScannedSale,
  saleSearchRef,
  searchQuery,
  setSearchQuery,
  timeFilter,
  setTimeFilter,
  timeFilters,
  customDateFrom,
  setCustomDateFrom,
  customDateTo,
  setCustomDateTo,
  filteredSales,
  handleSelectSale,
  formatDate,
  sale,
  setSale,
  setSelections,
  setExchangeSelections,
  setReason,
  setNotes,
  refundType,
  setRefundType,
  selections,
  handleToggleItem,
  handleSelectAllItems,
  exchangeSearchQuery,
  exchangeSearchResults,
  searchingExchange,
  exchangeInputRef,
  handleExchangeInput,
  handleExchangeKeyDown,
  handleAddExchangeItem,
  exchangeSelections,
  handleExchangeQuantityChange,
  handleRemoveExchangeItem,
  reason,
  notes,
  totalRefund,
  totalExchange,
  priceDifference,
  submitting,
  handleSubmitRefund,
  handleExchangeViaPos,
}: CreateRefundTabProps) {
  const { t } = useTranslation()

  const paymentMethodLabel = (method: string, tFn: (k: string) => string) => {
    const map: Record<string, string> = {
      Cash: tFn('sales.payments.cash'),
      Card: tFn('sales.payments.card'),
      Online: tFn('sales.payments.online'),
    }
    return map[method] ?? method
  }

  const saleStatusBadge = (status: string) => {
    if (status === 'Completed') return 'bg-emerald-100 text-emerald-700'
    if (status === 'Pending') return 'bg-yellow-100 text-yellow-700'
    return 'bg-slate-100 text-slate-600'
  }

  const saleStatusLabel = (status: string, tFn: (k: string) => string) => {
    if (status === 'Completed') return tFn('sales.completed')
    return status
  }

  return (
    <div className="max-w-5xl">
      {!sale ? (
        <>
          <RefundScanner
            receiptQrRef={receiptQrRef}
            receiptQrQuery={receiptQrQuery}
            scanningQr={scanningQr}
            qrError={qrError}
            handleReceiptQrInput={handleReceiptQrInput}
            handleReceiptQrKeyDown={handleReceiptQrKeyDown}
            setQrError={setQrError}
            setReceiptQrQuery={setReceiptQrQuery}
            scannedSales={scannedSales}
            setScannedSales={setScannedSales}
            handleSelectScannedSale={handleSelectScannedSale}
          />

          {/* Search bar with icon */}
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
              ref={saleSearchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('refunds.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Time filter buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {timeFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setTimeFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  timeFilter === f.key
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Custom date pickers */}
          {timeFilter === 'custom' && (
            <div className="flex gap-3 mb-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('refunds.from')}</label>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('refunds.to')}</label>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Count */}
          <div className="text-xs text-slate-500 mb-3">
            {filteredSales.length} {t('refunds.salesFound')}
          </div>

          {/* Sales list */}
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">{t('common.loading')}</div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">{t('refunds.noSales')}</div>
          ) : (
            <div className="space-y-2">
              {filteredSales.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleSelectSale(s)}
                  className="bg-white rounded-lg border border-slate-200 p-4 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Gradient avatar with last 4 digits */}
                      <div
                        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getGradient(s.id)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}
                      >
                        {s.saleNumber.slice(-4)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{s.saleNumber}</p>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${saleStatusBadge(s.status)}`}
                          >
                            {saleStatusLabel(s.status, t)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {s.clientName ?? t('refunds.walkInClient')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">{formatDate(s.createdAt)}</p>
                        <p className="text-xs text-slate-400">
                          {paymentMethodLabel(s.paymentMethod, t)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(s.totalAmount)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {s.items.length} {t('common.items')}
                        </p>
                      </div>
                      <svg
                        className="w-4 h-4 text-slate-400 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ── Sale detail view ── */
        <>
          {/* Back button */}
          <button
            onClick={() => {
              setSale(null)
              setSelections([])
              setExchangeSelections([])
              setReason('')
              setNotes('')
            }}
            className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {t('refunds.backToList')}
          </button>

          {/* Sale info header */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getGradient(sale.id)} flex items-center justify-center text-white text-base font-bold flex-shrink-0`}
              >
                {sale.saleNumber.slice(-4)}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900">{sale.saleNumber}</h3>
                <p className="text-sm text-slate-500">
                  {sale.clientName ?? t('refunds.walkInClient')} · {formatDate(sale.createdAt)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">{t('common.total')}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatCurrency(sale.totalAmount)}
                </p>
              </div>
            </div>

            {/* Refund / Exchange toggle */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit mt-4">
              <button
                onClick={() => setRefundType('Refund')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  refundType === 'Refund'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('refunds.typeRefund')}
              </button>
              <button
                onClick={() => setRefundType('Exchange')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  refundType === 'Exchange'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('refunds.typeExchange')}
              </button>
            </div>
          </div>

          <RefundLineItems
            sale={sale}
            selections={selections}
            handleToggleItem={handleToggleItem}
            handleSelectAllItems={handleSelectAllItems}
          />

          {/* Exchange section */}
          {refundType === 'Exchange' && (
            <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">
                {t('refunds.selectExchangeItems')}
              </h4>

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
                  ref={exchangeInputRef}
                  type="text"
                  value={exchangeSearchQuery}
                  onChange={(e) => handleExchangeInput(e.target.value)}
                  onKeyDown={handleExchangeKeyDown}
                  placeholder={t('refunds.searchExchangePlaceholder') + ' (ou scanner le code-barres)'}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                {searchingExchange && (
                  <div className="absolute right-3 top-2.5 text-xs text-slate-400">
                    {t('common.loading')}
                  </div>
                )}
                {exchangeSearchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    {exchangeSearchResults.map((variant) => (
                      <div
                        key={variant.id}
                        onClick={() => handleAddExchangeItem(variant)}
                        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-orange-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {variant.imageUrl ? (
                            <img
                              src={variant.imageUrl}
                              alt={variant.productName}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
                              <span
                                className="w-3 h-3 rounded-full border border-slate-300"
                                style={{ backgroundColor: variant.colorHexCode }}
                              />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {variant.productName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {variant.colorName} · {variant.sizeValue}
                              {variant.sku && <span className="ml-1 text-slate-400">({variant.sku})</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">
                            {t('refunds.stock')}: {variant.stockQuantity}
                          </span>
                          <span className="text-sm font-medium text-slate-900">
                            {formatCurrency(variant.price)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {exchangeSelections.length > 0 ? (
                <div className="space-y-2">
                  {exchangeSelections.map((sel) => (
                    <div
                      key={sel.variant.id}
                      className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg"
                    >
                      {sel.variant.imageUrl ? (
                        <img
                          src={sel.variant.imageUrl}
                          alt={sel.variant.productName}
                          className="w-10 h-10 rounded-lg object-cover border border-orange-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center flex-shrink-0">
                          <span
                            className="w-3 h-3 rounded-full border border-orange-300"
                            style={{ backgroundColor: sel.variant.colorHexCode }}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {sel.variant.productName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {sel.variant.colorName} · {sel.variant.sizeValue}
                          {sel.variant.sku && <span className="ml-1 text-slate-400">({sel.variant.sku})</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <label className="text-xs text-slate-500">{t('common.quantity')}:</label>
                        <input
                          type="number"
                          min={1}
                          max={sel.variant.stockQuantity}
                          value={sel.quantity}
                          onChange={(e) =>
                            handleExchangeQuantityChange(
                              sel.variant.id,
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="w-16 px-2 py-1 text-sm border border-slate-200 rounded text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-900 w-24 text-right flex-shrink-0">
                        {formatCurrency(sel.quantity * sel.variant.price)}
                      </span>
                      <button
                        onClick={() => handleRemoveExchangeItem(sel.variant.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                      >
                        <svg
                          className="w-4 h-4"
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
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">
                  {t('refunds.noExchangeItems')}
                </p>
              )}
            </div>
          )}

          {/* Summary + Reason + Submit */}
          {(selections.length > 0 ||
            (refundType === 'Exchange' && exchangeSelections.length > 0)) && (
            <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('refunds.globalReason')} <span className="text-slate-400 text-xs">({t('common.cancel')})</span>
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t('refunds.reasonPlaceholder')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('refunds.notes')}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('refunds.notesPlaceholder')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('refunds.returnTotal')}</span>
                  <span className="text-slate-900 font-medium">{formatCurrency(totalRefund)}</span>
                </div>
                {refundType === 'Exchange' && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('refunds.exchangeTotal')}</span>
                      <span className="text-slate-900 font-medium">
                        {formatCurrency(totalExchange)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold border-t border-slate-100 pt-2">
                      <span className="text-slate-900">{t('refunds.priceDifference')}</span>
                      <span
                        className={
                          priceDifference >= 0 ? 'text-red-600' : 'text-emerald-600'
                        }
                      >
                        {priceDifference >= 0 ? '+' : ''}
                        {formatCurrency(priceDifference)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                {refundType === 'Exchange' && selections.length > 0 && (
                  <button
                    onClick={handleExchangeViaPos}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                  >
                    {t('refunds.exchangeViaPos')}
                  </button>
                )}
                <button
                  onClick={handleSubmitRefund}
                  disabled={selections.length === 0 || submitting}
                  className={`px-6 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    refundType === 'Exchange'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {submitting
                    ? t('common.loading')
                    : refundType === 'Exchange'
                    ? t('refunds.processExchange')
                    : t('refunds.processRefund')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
