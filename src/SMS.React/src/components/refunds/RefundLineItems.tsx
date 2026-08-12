import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../utils/format'
import { Checkbox, cn } from '../ui'
import type { SaleForRefund, SaleItemForRefund } from '../../api/refunds'
import type { RefundItemSelection } from '../../pages/RefundsPage'

/**
 * Per-line item selection table for a refund/exchange.
 *
 * Pure presentation + the toggle/select-all handlers, passed in unchanged
 * from RefundsPage. No logic here — this is a mechanical extraction.
 */

export interface RefundLineItemsProps {
  sale: SaleForRefund
  selections: RefundItemSelection[]
  handleToggleItem: (item: SaleItemForRefund) => void
  handleSelectAllItems: () => void
}

export default function RefundLineItems({
  sale,
  selections,
  handleToggleItem,
  handleSelectAllItems,
}: RefundLineItemsProps) {
  const { t } = useTranslation()

  return (
    <div className="surface-glass mb-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-fg">{t('refunds.selectReturnItems')}</h4>
        <button
          onClick={handleSelectAllItems}
          className="text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
        >
          {selections.length === sale.items.filter((i) => i.availableForRefund > 0).length
            ? t('refunds.deselectAll')
            : t('refunds.selectAll')}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-10 py-2 text-left font-medium text-fg-subtle" />
              <th className="py-2 text-left font-medium text-fg-subtle">{t('products.product')}</th>
              <th className="py-2 text-left font-medium text-fg-subtle">{t('products.color')}</th>
              <th className="py-2 text-left font-medium text-fg-subtle">{t('products.size')}</th>
              <th className="py-2 text-right font-medium text-fg-subtle">{t('common.quantity')}</th>
              <th className="py-2 text-right font-medium text-fg-subtle">{t('products.price')}</th>
              <th className="py-2 text-right font-medium text-fg-subtle">{t('refunds.refunded')}</th>
              <th className="py-2 text-right font-medium text-fg-subtle">{t('refunds.available')}</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => {
              const selected = selections.find((s) => s.item.id === item.id)
              return (
                <tr
                  key={item.id}
                  className={cn('border-b border-border/40', selected && 'bg-[var(--accent-soft)]')}
                >
                  <td className="py-3">
                    <Checkbox
                      checked={!!selected}
                      onChange={() => handleToggleItem(item)}
                      disabled={item.availableForRefund <= 0}
                    />
                  </td>
                  <td className="py-3 font-medium text-fg">{item.productName}</td>
                  <td className="py-3 text-fg-muted">{item.colorName}</td>
                  <td className="py-3 text-fg-muted">{item.sizeValue}</td>
                  <td className="num py-3 text-right text-fg-muted">{item.quantity}</td>
                  <td className="num py-3 text-right text-fg-muted">{formatCurrency(item.unitPrice)}</td>
                  <td className="num py-3 text-right text-fg-subtle">{item.alreadyRefundedQuantity}</td>
                  <td className="num py-3 text-right">
                    <span className={item.availableForRefund > 0 ? 'font-medium text-[var(--positive)]' : 'font-medium text-fg-subtle'}>
                      {item.availableForRefund}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
