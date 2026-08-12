import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { SaleForRefund } from '../../api/refunds'

/**
 * Receipt / client QR dropzone and the multi-sale disambiguation list.
 *
 * State machine lives in RefundsPage: this renders idle / scanning / error and
 * the "several sales matched this client QR" picker. Every handler is passed
 * in unchanged.
 */

export interface RefundScannerProps {
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
}

export default function RefundScanner({
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
}: RefundScannerProps) {
  const { t } = useTranslation()

  return (
    <>
      {/* Receipt QR Scanner */}
      <div className={`mb-4 p-3 rounded-lg border-2 border-dashed transition-colors ${
        qrError ? 'border-red-300 bg-red-50/50' :
        scanningQr ? 'border-blue-300 bg-blue-50/50' :
        'border-slate-200 bg-slate-50/50'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            scanningQr ? 'bg-blue-100' : 'bg-emerald-100'
          }`}>
            <svg className={`w-5 h-5 ${scanningQr ? 'text-blue-600' : 'text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <div className="flex-1">
            <input
              ref={receiptQrRef}
              type="text"
              value={receiptQrQuery}
              onChange={(e) => handleReceiptQrInput(e.target.value)}
              onKeyDown={handleReceiptQrKeyDown}
              placeholder={t('refunds.scanReceiptQr')}
              className="w-full px-3 py-2 text-sm border-0 bg-transparent focus:outline-none focus:ring-0 placeholder:text-slate-400"
              disabled={scanningQr}
            />
          </div>
          {scanningQr && (
            <div className="text-xs text-blue-500 flex-shrink-0">{t('common.loading')}</div>
          )}
          {qrError && (
            <button onClick={() => { setQrError(null); setReceiptQrQuery(''); receiptQrRef.current?.focus() }} className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
          )}
        </div>
      </div>

      {/* Scanned sales list (multiple sales from client QR) */}
      {scannedSales.length > 0 && (
        <div className="mb-4 p-4 bg-white border border-slate-200 rounded-lg">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            {t('refunds.salesFound', { count: scannedSales.length })}
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {scannedSales.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectScannedSale(s.id)}
                className="w-full flex items-center justify-between p-3 text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-md transition-colors"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">{s.saleNumber}</div>
                  <div className="text-xs text-slate-500">{new Date(s.createdAt).toLocaleDateString('fr-FR')} — {s.items.length} article(s)</div>
                </div>
                <div className="text-sm font-bold text-slate-900">{s.totalAmount.toFixed(2)} DH</div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setScannedSales([])}
            className="mt-3 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}
    </>
  )
}
