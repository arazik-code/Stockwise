import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../utils/format'
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
    <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-900">{t('refunds.selectReturnItems')}</h4>
        <button
          onClick={handleSelectAllItems}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {selections.length === sale.items.filter((i) => i.availableForRefund > 0).length
            ? t('refunds.deselectAll')
            : t('refunds.selectAll')}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 font-medium text-slate-600 w-10"></th>
              <th className="text-left py-2 font-medium text-slate-600">{t('products.product')}</th>
              <th className="text-left py-2 font-medium text-slate-600">{t('products.color')}</th>
              <th className="text-left py-2 font-medium text-slate-600">{t('products.size')}</th>
              <th className="text-right py-2 font-medium text-slate-600">{t('common.quantity')}</th>
              <th className="text-right py-2 font-medium text-slate-600">{t('products.price')}</th>
              <th className="text-right py-2 font-medium text-slate-600">{t('refunds.refunded')}</th>
              <th className="text-right py-2 font-medium text-slate-600">{t('refunds.available')}</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => {
              const selected = selections.find((s) => s.item.id === item.id)
              return (
                <tr
                  key={item.id}
                  className={`border-b border-slate-50 ${selected ? 'bg-blue-50/40' : ''}`}
                >
                  <td className="py-3">
                    <input
                      type="checkbox"
                      checked={!!selected}
                      onChange={() => handleToggleItem(item)}
                      disabled={item.availableForRefund <= 0}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                    />
                  </td>
                  <td className="py-3 font-medium text-slate-900">{item.productName}</td>
                  <td className="py-3 text-slate-600">{item.colorName}</td>
                  <td className="py-3 text-slate-600">{item.sizeValue}</td>
                  <td className="py-3 text-right text-slate-600">{item.quantity}</td>
                  <td className="py-3 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-3 text-right text-slate-500">{item.alreadyRefundedQuantity}</td>
                  <td className="py-3 text-right">
                    <span
                      className={`font-medium ${
                        item.availableForRefund > 0 ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
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
