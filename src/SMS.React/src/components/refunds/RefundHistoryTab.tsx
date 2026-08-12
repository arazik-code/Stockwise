import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { ChevronDown, Printer, RotateCcw, Search, X } from 'lucide-react'
import { formatCurrency } from '../../utils/format'
import {
  Badge, Button, Card, DataTable, EmptyState, Input, StatCard, StatusBadge,
  Tabs,
} from '../ui'
import { collapseVariants } from '../../design/variants'
import type { Refund } from '../../api/refunds'
import type { HistoryStatusFilter } from '../../pages/RefundsPage'

/**
 * History tab: stat tiles, status/search filters, expandable refund cards.
 * Mechanical extraction from RefundsPage — all state and handlers are owned
 * by the parent and threaded through as props.
 *
 * The old refundStatusBadge()/refundStatusLabel() helpers here were the only
 * place in the app using the -100 badge tier and `yellow` instead of `amber` -
 * both gone, replaced by the shared `refund` status domain.
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

  return (
    <div className="max-w-5xl">
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label={t('refunds.stats.totalOperations')} value={historyStats.total.toString()} />
        <StatCard label={t('refunds.stats.refundsCount')} value={historyStats.refundsCount.toString()} tone="info" />
        <StatCard label={t('refunds.stats.exchangesCount')} value={historyStats.exchangesCount.toString()} tone="special" />
        <StatCard label={t('refunds.stats.totalRefunded')} value={formatCurrency(historyStats.totalRefunded)} tone="negative" />
        <StatCard label={t('refunds.stats.pendingCount')} value={historyStats.pendingCount.toString()} tone="caution" />
      </div>

      <div className="mb-4">
        <Tabs
          variant="pill"
          layoutGroupId="refund-history-filter"
          value={historyStatusFilter}
          onChange={(v) => setHistoryStatusFilter(v as HistoryStatusFilter)}
          items={historyStatusFilters.map((f) => ({ value: f.key, label: f.label }))}
        />
      </div>

      <Input
        value={historySearchQuery}
        onChange={(e) => setHistorySearchQuery(e.target.value)}
        placeholder={t('refunds.searchHistoryPlaceholder')}
        leading={<Search />}
        wrapperClassName="mb-4"
      />

      <p className="num mb-3 text-xs text-fg-subtle">
        {filteredRefunds.length} {t('refunds.operationsFound')}
      </p>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => <Card key={i} className="h-20" />)}
        </div>
      ) : filteredRefunds.length === 0 ? (
        <div className="surface-glass">
          <EmptyState title={t('refunds.noRefunds')} compact />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRefunds.map((refund) => {
            const isExpanded = expandedRefundId === refund.id
            return (
              <Card key={refund.id} padded={false} className="overflow-hidden">
                <div
                  onClick={() => setExpandedRefundId(isExpanded ? null : refund.id)}
                  className="cursor-pointer p-4 transition-colors hover:bg-surface-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Badge tone={refund.type === 'Exchange' ? 'special' : 'info'} size="sm">
                        {refund.type === 'Exchange' ? t('refunds.typeExchange') : t('refunds.typeRefund')}
                      </Badge>
                      <div className="min-w-0">
                        <p className="num truncate text-sm font-semibold text-fg">{refund.refundNumber}</p>
                        <p className="truncate text-xs text-fg-subtle">
                          {refund.saleNumber} · {refund.clientName ?? t('refunds.walkInClient')} · {formatDate(refund.refundDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <StatusBadge domain="refund" value={refund.status} animate={false} showIcon={false} size="sm" />
                      <span className="num text-sm font-semibold text-fg">
                        {formatCurrency(refund.type === 'Exchange' ? refund.totalExchangeAmount : refund.totalRefundAmount)}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-fg-subtle transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </div>

                <motion.div
                  initial={false}
                  animate={isExpanded ? 'animate' : 'initial'}
                  variants={collapseVariants}
                  style={{ overflow: 'hidden' }}
                >
                  {isExpanded && (
                    <div className="space-y-4 border-t border-border px-4 pb-4 pt-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-fg-muted">{t('refunds.reason')}:</span>{' '}
                          <span className="text-fg">{refund.reason}</span>
                        </div>
                        {refund.notes && (
                          <div>
                            <span className="font-medium text-fg-muted">{t('refunds.notes')}:</span>{' '}
                            <span className="text-fg">{refund.notes}</span>
                          </div>
                        )}
                      </div>

                      {refund.items.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase text-fg-subtle">{t('refunds.returnedItems')}</p>
                          <DataTable
                            sticky={false}
                            columns={[
                              {
                                key: 'product',
                                header: t('products.product'),
                                render: (item) => (
                                  <div>
                                    <p className="font-medium text-fg">{item.productName}</p>
                                    {item.colorName && item.sizeValue && (
                                      <p className="text-xs text-fg-subtle">{item.colorName} · {item.sizeValue}</p>
                                    )}
                                  </div>
                                ),
                              },
                              { key: 'qty', header: t('common.quantity'), numeric: true, render: (item) => <span className="text-fg-muted">{item.quantity}</span> },
                              { key: 'amount', header: t('refunds.amount'), numeric: true, render: (item) => <span className="text-fg-muted">{formatCurrency(item.refundAmount)}</span> },
                            ]}
                            data={refund.items}
                            keyField={(item) => item.id}
                          />
                        </div>
                      )}

                      {refund.type === 'Exchange' && refund.exchangeItems.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase text-fg-subtle">{t('refunds.exchangedItems')}</p>
                          <DataTable
                            sticky={false}
                            columns={[
                              {
                                key: 'product',
                                header: t('products.product'),
                                render: (item) => (
                                  <div>
                                    <p className="font-medium text-fg">{item.productName}</p>
                                    {item.colorName && item.sizeValue && (
                                      <p className="text-xs text-fg-subtle">{item.colorName} · {item.sizeValue}</p>
                                    )}
                                  </div>
                                ),
                              },
                              { key: 'qty', header: t('common.quantity'), numeric: true, render: (item) => <span className="text-fg-muted">{item.quantity}</span> },
                              { key: 'amount', header: t('refunds.amount'), numeric: true, render: (item) => <span className="text-fg-muted">{formatCurrency(item.totalPrice)}</span> },
                            ]}
                            data={refund.exchangeItems}
                            keyField={(item) => item.id}
                          />
                          {refund.priceDifference !== 0 && (
                            <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-medium">
                              <span className="text-fg-subtle">{t('refunds.priceDifference')}</span>
                              <span className={`num ${refund.priceDifference >= 0 ? 'text-[var(--negative)]' : 'text-[var(--positive)]'}`}>
                                {refund.priceDifference >= 0 ? '+' : ''}
                                {formatCurrency(refund.priceDifference)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 border-t border-border pt-2">
                        <Button
                          size="xs"
                          variant="outline"
                          icon={<Printer className="h-3.5 w-3.5" />}
                          onClick={(e) => { e.stopPropagation(); handlePrintReceipt(refund) }}
                        >
                          {t('refunds.printReceipt')}
                        </Button>

                        {refund.status === 'Pending' && (
                          <>
                            <Button
                              size="xs"
                              variant="success"
                              icon={<RotateCcw className="h-3.5 w-3.5" />}
                              onClick={(e) => { e.stopPropagation(); handleProcessRefund(refund.id) }}
                            >
                              {t('refunds.process')}
                            </Button>
                            <Button
                              size="xs"
                              variant="danger"
                              icon={<X className="h-3.5 w-3.5" />}
                              onClick={(e) => { e.stopPropagation(); handleCancelRefund(refund.id) }}
                            >
                              {t('common.cancel')}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
