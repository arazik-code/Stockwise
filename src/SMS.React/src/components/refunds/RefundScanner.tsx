import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { QrCode, X } from 'lucide-react'
import { cn, Spinner } from '../ui'
import { formatCurrency } from '../../utils/format'
import type { SaleForRefund } from '../../api/refunds'

/**
 * Receipt / client QR dropzone and the multi-sale disambiguation list.
 *
 * State machine lives in RefundsPage: this renders idle / scanning / error and
 * the "several sales matched this client QR" picker. Every handler is passed
 * in unchanged.
 *
 * This is the single best "feels alive" moment on the page - the dropzone
 * physically changes tone as the scan progresses, and a fresh error gets a
 * quick shake so a cashier notices it without having to read the text first.
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
  const tone = qrError ? 'negative' : scanningQr ? 'info' : 'positive'

  return (
    <>
      {/* Receipt QR Scanner - solid Console surface, no blur; the tone itself
          is the feedback, so it has to read instantly under shop lighting. */}
      <motion.div
        data-tone={tone}
        animate={qrError ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className={cn(
          'mb-4 rounded-field border-2 border-dashed p-3 transition-colors',
          'border-[var(--tone)]/35 bg-[var(--tone-soft)]'
        )}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-[var(--tone)] text-white">
            {scanningQr ? <Spinner size="sm" tone="current" /> : <QrCode className="h-5 w-5" aria-hidden="true" />}
          </span>
          <div className="flex-1">
            <input
              ref={receiptQrRef}
              type="text"
              value={receiptQrQuery}
              onChange={(e) => handleReceiptQrInput(e.target.value)}
              onKeyDown={handleReceiptQrKeyDown}
              placeholder={t('refunds.scanReceiptQr')}
              className="w-full border-0 bg-transparent px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-0"
              disabled={scanningQr}
            />
          </div>
          {scanningQr && (
            <div className="shrink-0 text-xs text-[var(--tone-ink)]">{t('common.loading')}</div>
          )}
          {qrError && (
            <button
              onClick={() => { setQrError(null); setReceiptQrQuery(''); receiptQrRef.current?.focus() }}
              aria-label={t('common.cancel')}
              className="shrink-0 text-[var(--tone)] transition-colors hover:brightness-90"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {qrError && <p className="mt-2 px-1 text-xs text-[var(--tone-ink)]">{qrError}</p>}
      </motion.div>

      {/* Scanned sales list (multiple sales from client QR) */}
      {scannedSales.length > 0 && (
        <div className="surface-glass mb-4 p-4">
          <h3 className="mb-3 text-sm font-semibold text-fg">
            {t('refunds.salesFound', { count: scannedSales.length })}
          </h3>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {scannedSales.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectScannedSale(s.id)}
                className="flex w-full items-center justify-between rounded-field border border-border bg-surface-2 p-3 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                <div>
                  <div className="text-sm font-semibold text-fg">{s.saleNumber}</div>
                  <div className="num text-xs text-fg-subtle">{new Date(s.createdAt).toLocaleDateString('fr-FR')} — {s.items.length} article(s)</div>
                </div>
                <div className="num text-sm font-bold text-fg">{formatCurrency(s.totalAmount)}</div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setScannedSales([])}
            className="mt-3 text-xs text-fg-subtle transition-colors hover:text-fg"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}
    </>
  )
}
