import { type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Loader2, Search, X } from 'lucide-react'
import { formatCurrency } from '../../utils/format'
import RefundScanner from './RefundScanner'
import RefundLineItems from './RefundLineItems'
import { Button, EmptyState, Input, StatusBadge, Tabs } from '../ui'
import type { Sale } from '../../types/sale'
import type { SaleForRefund, SaleItemForRefund, ProductVariantForExchange } from '../../api/refunds'
import type { RefundItemSelection, ExchangeItemSelection, TimeFilter, RefundType } from '../../pages/RefundsPage'

/**
 * Create-tab surface: sale lookup list, then per-line item selection for a
 * refund/exchange. Mechanical extraction from RefundsPage — all state and
 * handlers are owned by the parent and threaded through as props.
 *
 * Console archetype: solid surfaces, no blur, touch-friendly - this tab is
 * operated at speed, like the POS.
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

/** Deterministic per-sale hue, same technique as <Avatar> - equal visual weight for every tile. */
function saleTileStyle(id: number, digits: string) {
  const hash = Array.from(String(id) + digits).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0)
  return { background: `oklch(0.58 0.15 ${hash})` }
}

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

          <Input
            ref={saleSearchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('refunds.searchPlaceholder')}
            leading={<Search />}
            wrapperClassName="mb-4"
          />

          <div className="mb-4">
            <Tabs
              variant="pill"
              layoutGroupId="refund-time-filter"
              value={timeFilter}
              onChange={(v) => setTimeFilter(v as TimeFilter)}
              items={timeFilters.map((f) => ({ value: f.key, label: f.label }))}
            />
          </div>

          {timeFilter === 'custom' && (
            <div className="mb-4 flex gap-3">
              <Input
                type="date"
                label={t('refunds.from')}
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                size="sm"
              />
              <Input
                type="date"
                label={t('refunds.to')}
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                size="sm"
              />
            </div>
          )}

          <p className="num mb-3 text-xs text-fg-subtle">
            {filteredSales.length} {t('refunds.salesFound')}
          </p>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-fg-subtle" />
            </div>
          ) : filteredSales.length === 0 ? (
            <EmptyState title={t('refunds.noSales')} compact />
          ) : (
            <div className="space-y-2">
              {filteredSales.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleSelectSale(s)}
                  className="surface-plain cursor-pointer p-4 transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-4">
                      <div
                        style={saleTileStyle(s.id, s.saleNumber.slice(-4))}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field text-sm font-bold text-white"
                      >
                        {s.saleNumber.slice(-4)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="num truncate text-sm font-semibold text-fg">{s.saleNumber}</p>
                          <StatusBadge domain="sale" value={s.status} animate={false} showIcon={false} size="xs" />
                        </div>
                        <p className="truncate text-xs text-fg-subtle">{s.clientName ?? t('refunds.walkInClient')}</p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-fg-subtle">{formatDate(s.createdAt)}</p>
                        <p className="text-xs text-fg-subtle">{paymentMethodLabel(s.paymentMethod, t)}</p>
                      </div>
                      <div className="text-right">
                        <p className="num text-sm font-semibold text-fg">{formatCurrency(s.totalAmount)}</p>
                        <p className="num text-xs text-fg-subtle">{s.items.length} {t('common.items')}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-fg-subtle" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="h-4 w-4" />}
            className="mb-4 -ml-2"
            onClick={() => {
              setSale(null)
              setSelections([])
              setExchangeSelections([])
              setReason('')
              setNotes('')
            }}
          >
            {t('refunds.backToList')}
          </Button>

          <div className="surface-plain mb-4 p-4">
            <div className="flex items-center gap-4">
              <div
                style={saleTileStyle(sale.id, sale.saleNumber.slice(-4))}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-field text-base font-bold text-white"
              >
                {sale.saleNumber.slice(-4)}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-fg">{sale.saleNumber}</h3>
                <p className="text-sm text-fg-subtle">
                  {sale.clientName ?? t('refunds.walkInClient')} · {formatDate(sale.createdAt)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-fg-subtle">{t('common.total')}</p>
                <p className="num text-lg font-semibold text-fg">{formatCurrency(sale.totalAmount)}</p>
              </div>
            </div>

            <div className="mt-4">
              <Tabs
                variant="segmented"
                layoutGroupId="refund-type"
                value={refundType}
                onChange={(v) => setRefundType(v as RefundType)}
                items={[
                  { value: 'Refund', label: t('refunds.typeRefund') },
                  { value: 'Exchange', label: t('refunds.typeExchange') },
                ]}
              />
            </div>
          </div>

          <RefundLineItems
            sale={sale}
            selections={selections}
            handleToggleItem={handleToggleItem}
            handleSelectAllItems={handleSelectAllItems}
          />

          {refundType === 'Exchange' && (
            <div className="surface-plain mb-4 p-4">
              <h4 className="mb-3 text-sm font-semibold text-fg">{t('refunds.selectExchangeItems')}</h4>

              <div className="relative mb-4">
                <Input
                  ref={exchangeInputRef}
                  value={exchangeSearchQuery}
                  onChange={(e) => handleExchangeInput(e.target.value)}
                  onKeyDown={handleExchangeKeyDown}
                  placeholder={`${t('refunds.searchExchangePlaceholder')} (ou scanner le code-barres)`}
                  leading={<Search />}
                  trailing={searchingExchange ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
                />
                {exchangeSearchResults.length > 0 && (
                  <div className="surface-glass absolute z-10 mt-1 max-h-60 w-full overflow-auto p-1">
                    {exchangeSearchResults.map((variant) => (
                      <div
                        key={variant.id}
                        onClick={() => handleAddExchangeItem(variant)}
                        className="flex cursor-pointer items-center justify-between rounded-inset px-2 py-2 transition-colors hover:bg-[var(--accent-soft)]"
                      >
                        <div className="flex items-center gap-3">
                          {variant.imageUrl ? (
                            <img
                              src={variant.imageUrl}
                              alt={variant.productName}
                              className="h-10 w-10 shrink-0 rounded-field border border-border object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-sunken">
                              <span
                                className="h-3 w-3 rounded-chip border border-border-strong"
                                style={{ backgroundColor: variant.colorHexCode }}
                              />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-fg">{variant.productName}</p>
                            <p className="text-xs text-fg-subtle">
                              {variant.colorName} · {variant.sizeValue}
                              {variant.sku && <span className="ml-1 text-fg-subtle">({variant.sku})</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="num text-xs text-fg-subtle">{t('refunds.stock')}: {variant.stockQuantity}</span>
                          <span className="num text-sm font-medium text-fg">{formatCurrency(variant.price)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {exchangeSelections.length > 0 ? (
                <div className="space-y-2">
                  {exchangeSelections.map((sel) => (
                    <div key={sel.variant.id} className="flex items-center gap-3 rounded-field bg-[var(--special-soft)] p-3">
                      {sel.variant.imageUrl ? (
                        <img
                          src={sel.variant.imageUrl}
                          alt={sel.variant.productName}
                          className="h-10 w-10 shrink-0 rounded-field border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-surface">
                          <span
                            className="h-3 w-3 rounded-chip border border-border-strong"
                            style={{ backgroundColor: sel.variant.colorHexCode }}
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{sel.variant.productName}</p>
                        <p className="text-xs text-fg-subtle">
                          {sel.variant.colorName} · {sel.variant.sizeValue}
                          {sel.variant.sku && <span className="ml-1 text-fg-subtle">({sel.variant.sku})</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <label className="text-xs text-fg-subtle">{t('common.quantity')}:</label>
                        <input
                          type="number"
                          min={1}
                          max={sel.variant.stockQuantity}
                          value={sel.quantity}
                          onChange={(e) => handleExchangeQuantityChange(sel.variant.id, parseInt(e.target.value) || 1)}
                          className="num w-16 rounded-field border border-border bg-surface px-2 py-1 text-center text-sm text-fg focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
                        />
                      </div>
                      <span className="num w-24 shrink-0 text-right text-sm font-medium text-fg">
                        {formatCurrency(sel.quantity * sel.variant.price)}
                      </span>
                      <button
                        onClick={() => handleRemoveExchangeItem(sel.variant.id)}
                        className="shrink-0 text-fg-subtle transition-colors hover:text-[var(--negative)]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-fg-subtle">{t('refunds.noExchangeItems')}</p>
              )}
            </div>
          )}

          {(selections.length > 0 || (refundType === 'Exchange' && exchangeSelections.length > 0)) && (
            <div className="surface-plain mb-4 p-4">
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label={
                    <>
                      {t('refunds.globalReason')} <span className="text-fg-subtle">({t('common.cancel')})</span>
                    </>
                  }
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('refunds.reasonPlaceholder')}
                />
                <Input
                  label={t('refunds.notes')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('refunds.notesPlaceholder')}
                />
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-fg-subtle">{t('refunds.returnTotal')}</span>
                  <span className="num font-medium text-fg">{formatCurrency(totalRefund)}</span>
                </div>
                {refundType === 'Exchange' && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-fg-subtle">{t('refunds.exchangeTotal')}</span>
                      <span className="num font-medium text-fg">{formatCurrency(totalExchange)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
                      <span className="text-fg">{t('refunds.priceDifference')}</span>
                      <span className={`num ${priceDifference >= 0 ? 'text-[var(--negative)]' : 'text-[var(--positive)]'}`}>
                        {priceDifference >= 0 ? '+' : ''}
                        {formatCurrency(priceDifference)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                {refundType === 'Exchange' && selections.length > 0 && (
                  <Button variant="outline" onClick={handleExchangeViaPos}>
                    {t('refunds.exchangeViaPos')}
                  </Button>
                )}
                <Button
                  variant={refundType === 'Exchange' ? 'solid' : 'success'}
                  disabled={selections.length === 0}
                  loading={submitting}
                  onClick={handleSubmitRefund}
                >
                  {refundType === 'Exchange' ? t('refunds.processExchange') : t('refunds.processRefund')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
