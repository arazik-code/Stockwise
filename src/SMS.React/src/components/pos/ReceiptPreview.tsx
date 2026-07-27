import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import JsBarcode from 'jsbarcode'
import { formatCurrency, formatDateTime } from '../../utils/format'
import type { Sale } from '../../types/sale'

interface ReceiptPreviewProps {
  sale: Sale
  onClose: () => void
}

export default function ReceiptPreview({ sale, onClose }: ReceiptPreviewProps) {
  const { t } = useTranslation()
  const barcodeRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (barcodeRef.current && sale.receiptBarcode) {
      JsBarcode(barcodeRef.current, sale.receiptBarcode, {
        format: 'CODE128',
        width: 1.5,
        height: 40,
        displayValue: true,
        fontSize: 12,
        margin: 0,
      })
    }
  }, [sale.receiptBarcode])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-80 max-h-[90vh] overflow-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold">{t('pos.receipt')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-4 font-mono text-sm space-y-3">
          <div className="text-center">
            <div className="font-bold text-lg">SHOE STORE</div>
            <div className="text-xs text-gray-500">123 Main Street</div>
            <div className="text-xs text-gray-500">Tel: (555) 123-4567</div>
          </div>
          <div className="border-t border-dashed pt-2">
            <div>{t('sales.date')}: {formatDateTime(sale.createdAt)}</div>
            <div>{t('pos.receipt')}: {sale.saleNumber}</div>
            <div>Caissier: {sale.userName ?? 'N/A'}</div>
          </div>
          <div className="border-t border-dashed pt-2 space-y-1">
            {sale.items.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between">
                  <span>{item.productName}</span>
                </div>
                <div className="flex justify-between text-gray-500 text-xs">
                  <span>  {item.colorName} / {item.sizeValue}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>  {item.quantity} x {formatCurrency(item.unitPrice)}</span>
                  <span>{formatCurrency(item.lineTotal)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed pt-2 space-y-1">
            <div className="flex justify-between"><span>{t('common.subtotal')}</span><span>{formatCurrency(sale.subTotal)}</span></div>
            <div className="flex justify-between"><span>{t('common.tax')}</span><span>{formatCurrency(sale.taxAmount)}</span></div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between"><span>{t('common.discount')}</span><span>-{formatCurrency(sale.discountAmount)}</span></div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-1">
              <span>{t('common.total').toUpperCase()}</span><span>{formatCurrency(sale.totalAmount)}</span>
            </div>
          </div>
          <div className="border-t border-dashed pt-2">
            <div>{t('sales.payment')}: {sale.paymentMethod}</div>
            <div>{t('pos.amountPaid')}: {formatCurrency(sale.amountPaid)}</div>
            {sale.changeGiven > 0 && <div>{t('pos.change')}: {formatCurrency(sale.changeGiven)}</div>}
          </div>
          {sale.receiptBarcode && (
            <div className="border-t border-dashed pt-3 text-center">
              <div className="text-xs text-gray-500 mb-2">{t('pos.scanForRefund', 'Scanner pour remboursement')}</div>
              <svg ref={barcodeRef} />
              <div className="text-xs text-gray-400 mt-1">{sale.receiptBarcode}</div>
              <div className="text-xs text-gray-400 mt-1">{t('pos.barcodeExpiry', 'Valable 15 jours')}</div>
            </div>
          )}
          <div className="border-t border-dashed pt-2 text-center text-xs text-gray-500">
            Merci pour votre achat !
          </div>
        </div>
        <div className="p-4 border-t">
          <button
            onClick={() => window.print()}
            className="w-full py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
          >
            {t('pos.receipt')}
          </button>
        </div>
      </div>
    </div>
  )
}
