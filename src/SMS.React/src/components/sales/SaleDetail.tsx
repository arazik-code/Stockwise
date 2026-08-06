import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { printReceipt, buildReceiptData } from '../../utils/printReceipt'
import { showToast } from '../shared/Toast'
import type { Sale } from '../../types/sale'

interface SaleDetailProps {
  sale: Sale
  onClose: () => void
}

export default function SaleDetail({ sale, onClose }: SaleDetailProps) {
  const { t } = useTranslation()
  const [printing, setPrinting] = useState(false)

  const handleReprint = async () => {
    setPrinting(true)
    try {
      const receipt = buildReceiptData({
        saleNumber: sale.saleNumber,
        items: sale.items.map((i) => ({
          productVariantId: i.productVariantId,
          productId: 0,
          name: i.productName,
          sku: i.variantSku,
          colorName: i.colorName,
          sizeValue: i.sizeValue,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          lineTotal: i.lineTotal,
          isLiquidation: false,
        })),
        subtotal: sale.subTotal,
        taxRate: sale.subTotal > 0 ? sale.taxAmount / sale.subTotal : 0,
        taxAmount: sale.taxAmount,
        loyaltyDiscount: sale.loyaltyDiscountAmount,
        total: sale.totalAmount,
        // ReceiptData only distinguishes Cash/Card - Online (Shopify) sales print as Card, closer
        // to an electronic payment than cash in a drawer.
        paymentMethod: sale.paymentMethod === 'Cash' ? 'Cash' : 'Card',
        amountPaid: sale.amountPaid,
        change: sale.changeGiven,
        clientName: sale.clientName,
        pointsEarned: sale.loyaltyPointsEarned,
        pointsRedeemed: sale.loyaltyPointsRedeemed,
        receiptBarcode: sale.receiptBarcode,
        cashier: sale.userName,
      })
      await printReceipt(receipt)
    } catch {
      showToast(t('sales.detailModal.reprintFailed'), 'error')
    } finally {
      setPrinting(false)
    }
  }

  const totalQty = sale.items.reduce((sum, i) => sum + i.quantity, 0)
  const totalCost = sale.items.reduce((sum, i) => sum + (i.costPrice * i.quantity), 0)
  const profit = sale.totalAmount - totalCost
  const categoryKey = `sales.categories.${sale.category.charAt(0).toLowerCase() + sale.category.slice(1)}`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[680px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{t('sales.detailModal.title')}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{sale.saleNumber} · {formatDateTime(sale.createdAt)}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReprint}
              disabled={printing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              {printing ? t('sales.detailModal.printing') : t('sales.detailModal.reprintReceipt')}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none p-1">✕</button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Sale Info Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoItem label={t('sales.detailModal.channel')} value={sale.channel === 'Local' ? t('sales.channels.local') : t('sales.channels.shopify')} />
            <InfoItem label={t('sales.detailModal.category')} value={t(categoryKey)} />
            <InfoItem label={t('sales.detailModal.status')} value={t(`sales.statuses.${sale.status.toLowerCase()}`)} />
            <InfoItem label={t('sales.detailModal.payment')} value={t(`sales.payments.${sale.paymentMethod.toLowerCase()}`)} />
            <InfoItem label={t('sales.detailModal.cashier')} value={sale.userName ?? '-'} />
            <InfoItem label={t('sales.detailModal.client')} value={sale.clientName ?? '-'} />
            <InfoItem label={t('sales.items')} value={`${sale.items.length} (${totalQty} ${t('common.items')})`} />
            <InfoItem label={t('sales.detailModal.profit')} value={formatCurrency(profit)} valueClass={profit >= 0 ? 'text-emerald-600' : 'text-red-600'} />
            {sale.receiptBarcode && (
              <InfoItem label={t('pos.receipt')} value={sale.receiptBarcode} />
            )}
          </div>

          {/* Items Table */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">{t('sales.detailModal.items')}</h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">{t('sales.detailModal.product')}</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">{t('sales.detailModal.variant')}</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-slate-500">{t('sales.detailModal.qty')}</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">{t('sales.detailModal.unitPrice')}</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">{t('sales.detailModal.discount')}</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">{t('sales.detailModal.lineTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item, i) => {
                    return (
                      <tr key={i} className="border-b last:border-b-0">
                        <td className="px-3 py-2.5">
                          <p className="text-sm font-medium text-slate-900">{item.productName}</p>
                          <p className="text-[10px] font-mono text-slate-400">{item.variantSku}</p>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          {item.colorName} / {item.sizeValue}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-center font-medium text-slate-900">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-slate-500">
                          {item.discountAmount > 0 ? `-${formatCurrency(item.discountAmount)}` : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-right font-medium text-slate-900">{formatCurrency(item.lineTotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">{t('sales.detailModal.summary')}</h4>
              <div className="space-y-2 text-sm">
                <Row label={t('sales.detailModal.subtotal')} value={formatCurrency(sale.subTotal)} />
                {sale.taxAmount > 0 && <Row label={t('sales.detailModal.tax')} value={formatCurrency(sale.taxAmount)} />}
                {sale.discountAmount > 0 && <Row label={t('sales.detailModal.discount')} value={`-${formatCurrency(sale.discountAmount)}`} valueClass="text-red-500" />}
                {sale.loyaltyDiscountAmount > 0 && (
                  <Row label={t('sales.detailModal.loyaltyDiscount')} value={`-${formatCurrency(sale.loyaltyDiscountAmount)}`} valueClass="text-red-500" />
                )}
                <div className="flex justify-between font-bold text-lg border-t border-slate-200 pt-2 mt-2">
                  <span className="text-slate-900">{t('sales.detailModal.total')}</span>
                  <span className="text-slate-900">{formatCurrency(sale.totalAmount)}</span>
                </div>
                <div className="border-t border-slate-100 pt-2 mt-2 space-y-1">
                  <Row label={t('sales.detailModal.amountPaid')} value={formatCurrency(sale.amountPaid)} />
                  {sale.changeGiven > 0 && <Row label={t('sales.detailModal.change')} value={formatCurrency(sale.changeGiven)} valueClass="text-slate-500" />}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">{t('sales.detailModal.profit')}</h4>
              <div className="space-y-2 text-sm">
                <Row label={t('sales.detailModal.lineTotal')} value={formatCurrency(sale.subTotal)} />
                <Row label={t('sales.detailModal.cost')} value={formatCurrency(totalCost)} />
                <div className="flex justify-between font-bold text-lg border-t border-slate-200 pt-2 mt-2">
                  <span className="text-slate-900">{t('sales.detailModal.profit')}</span>
                  <span className={profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(profit)}</span>
                </div>

                {(sale.loyaltyPointsEarned > 0 || sale.loyaltyPointsRedeemed > 0) && (
                  <div className="border-t border-slate-100 pt-2 mt-2 space-y-1">
                    <h5 className="text-xs font-semibold text-slate-500 uppercase mt-2">{t('sales.detailModal.loyalty')}</h5>
                    {sale.loyaltyPointsEarned > 0 && (
                      <Row label={t('sales.detailModal.pointsEarned')} value={`+${sale.loyaltyPointsEarned}`} valueClass="text-emerald-600" />
                    )}
                    {sale.loyaltyPointsRedeemed > 0 && (
                      <Row label={t('sales.detailModal.pointsRedeemed')} value={`-${sale.loyaltyPointsRedeemed}`} valueClass="text-red-500" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoItem({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${valueClass || 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${valueClass || 'text-slate-900'}`}>{value}</span>
    </div>
  )
}
