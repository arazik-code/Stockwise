import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useCartStore } from '../../store/cartStore'
import { useExchangeStore } from '../../store/exchangeStore'
import { salesApi } from '../../api/sales'
import { refundsApi } from '../../api/refunds'
import { formatCurrency } from '../../utils/format'
import { printReceipt, printExchangeReceipt, buildReceiptData, type ReceiptData } from '../../utils/printReceipt'
import type { Client } from '../../api/clients'

interface CheckoutDialogProps {
  onClose: () => void
  loyaltyClient?: Client | null
  loyaltyEnabled: boolean
  loyaltyDiscount: number
  pointsToRedeem: number
  onSaleComplete?: () => void
}

export default function CheckoutDialog({
  onClose,
  loyaltyClient,
  loyaltyEnabled,
  loyaltyDiscount,
  pointsToRedeem,
  onSaleComplete,
}: CheckoutDialogProps) {
  const { t } = useTranslation()
  const { items, subtotal, tax, taxRate, hasLiquidationItems, clearCart } = useCartStore()
  const exchangeContext = useExchangeStore((s) => s.context)
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Card')
  const [amountPaid, setAmountPaid] = useState('')
  const [processing, setProcessing] = useState(false)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const completeRef = useRef<HTMLButtonElement>(null)

  const currentSubtotal = subtotal()
  const taxAmount = tax()
  const rawTotal = currentSubtotal + taxAmount - loyaltyDiscount
  const exchangeCredit = exchangeContext?.totalRefundAmount ?? 0
  const total = Math.max(0, rawTotal - exchangeCredit)
  const amountPaidNum = parseFloat(amountPaid || '0')
  const change = amountPaidNum - total

  const pointsToEarn = loyaltyEnabled && !hasLiquidationItems() ? Math.floor((currentSubtotal - loyaltyDiscount) / 10) : 0

  const handleComplete = useCallback(async () => {
    if (processing) return
    if (paymentMethod === 'Cash' && change < 0) return
    setProcessing(true)
    try {
      const isExchange = !!exchangeContext
      const category = isExchange ? 6 : hasLiquidationItems() ? 2 : 0

      // Capture cart data BEFORE clearing
      const cartSnapshot = [...items]
      const exchangeItemsTotal = cartSnapshot.reduce((sum, item) => sum + item.lineTotal, 0)
      const priceDifference = exchangeItemsTotal - exchangeCredit
      const capturedSubtotal = currentSubtotal
      const capturedTaxAmount = taxAmount
      const capturedTaxRate = taxRate
      const capturedTotal = rawTotal

      const sale = await salesApi.create({
        category: category,
        paymentMethod: paymentMethod === 'Cash' ? 0 : 1,
        amountPaid: amountPaidNum,
        taxRate: useCartStore.getState().taxRate,
        clientId: loyaltyClient?.id,
        loyaltyPointsToRedeem: loyaltyEnabled && pointsToRedeem > 0 ? pointsToRedeem : undefined,
        items: items.map((i) => ({
          productVariantId: i.productVariantId,
          quantity: i.quantity,
          discountAmount: 0,
        })),
      })

      // If exchange: create the refund record
      if (isExchange && exchangeContext) {
        try {
          const refund = await refundsApi.create({
            saleId: exchangeContext.originalSaleId,
            type: 'Exchange',
            reason: 'Échange via POS',
            notes: `Vente de remplacement: ${sale.saleNumber}`,
            items: exchangeContext.returnedItems.map((ri) => ({
              saleItemId: ri.saleItemId,
              quantity: ri.quantity,
            })),
            exchangeItems: items.map((i) => ({
              productVariantId: i.productVariantId,
              quantity: i.quantity,
            })),
          })
          await refundsApi.process(refund.id)
        } catch (refundErr) {
          console.error('Failed to create exchange refund record:', refundErr)
        }
      }

      // Build receipt data from snapshot
      const receipt = buildReceiptData({
        saleNumber: sale.saleNumber,
        items: cartSnapshot,
        subtotal: capturedSubtotal,
        taxRate: capturedTaxRate,
        taxAmount: capturedTaxAmount,
        loyaltyDiscount: loyaltyDiscount,
        total: capturedTotal,
        paymentMethod,
        amountPaid: parseFloat(amountPaid || total.toFixed(2)),
        change: Math.max(0, parseFloat(amountPaid || '0') - capturedTotal),
        clientName: loyaltyClient?.name,
        clientQrCode: loyaltyClient?.qrCode,
        pointsEarned: loyaltyEnabled && !hasLiquidationItems() ? pointsToEarn : 0,
        pointsRedeemed: loyaltyEnabled && pointsToRedeem > 0 ? pointsToRedeem : 0,
        receiptBarcode: sale.receiptBarcode,
      })

      setReceiptData(receipt)
      clearCart()

      // Auto-print after short delay
      if (isExchange && exchangeContext) {
        setTimeout(() => printExchangeReceipt(receipt, {
          originalSaleNumber: exchangeContext.originalSaleNumber,
          returnedItems: exchangeContext.returnedItems,
          totalRefundAmount: exchangeContext.totalRefundAmount,
          exchangeItems: cartSnapshot.map((i) => ({
            productName: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
          })),
          priceDifference,
        }), 800)
      } else {
        setTimeout(() => printReceipt(receipt), 800)
      }

      if (onSaleComplete) {
        onSaleComplete()
      }
    } catch (err) {
      console.error('Checkout failed:', err)
    } finally {
      setProcessing(false)
    }
  }, [processing, paymentMethod, change, items, rawTotal, total, currentSubtotal, taxAmount, taxRate, loyaltyClient, loyaltyEnabled, pointsToRedeem, loyaltyDiscount, hasLiquidationItems, pointsToEarn, amountPaid, clearCart, onSaleComplete, exchangeContext, exchangeCredit])

  // Keyboard navigation inside checkout dialog
  useEffect(() => {
    if (receiptData) {
      // After sale: Enter prints + closes, Escape just closes
      const handleKeyDown = (e: KeyboardEvent) => {
        switch (e.key) {
          case 'Enter':
            e.preventDefault()
            e.stopPropagation()
            printReceipt(receiptData)
            onClose()
            break
          case 'Escape':
            e.preventDefault()
            e.stopPropagation()
            onClose()
            break
        }
      }
      window.addEventListener('keydown', handleKeyDown, { capture: true })
      return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          e.stopPropagation()
          setPaymentMethod('Cash')
          break
        case 'ArrowRight':
          e.preventDefault()
          e.stopPropagation()
          setPaymentMethod('Card')
          break
        case 'Enter':
          e.preventDefault()
          e.stopPropagation()
          if (paymentMethod === 'Cash') {
            if (tag === 'INPUT') {
              handleComplete()
            } else {
              amountInputRef.current?.focus()
            }
          } else {
            handleComplete()
          }
          break
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [receiptData, paymentMethod, handleComplete, onClose])

  // Focus amount input when switching to Cash
  useEffect(() => {
    if (paymentMethod === 'Cash' && !receiptData) {
      setTimeout(() => amountInputRef.current?.focus(), 50)
    }
  }, [paymentMethod, receiptData])

  // ── Post-sale receipt screen ──
  if (receiptData) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 w-[420px] text-center border border-slate-200 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">{t('pos.saleComplete')}</h2>
          <p className="text-base text-slate-500 mb-4">
            {t('pos.receipt')}: <span className="font-mono font-bold">{receiptData.saleNumber}</span>
          </p>

          {/* Loyalty info */}
          {loyaltyClient && (
            <div className="bg-slate-50 rounded-xl p-4 mb-5">
              {receiptData.pointsRedeemed > 0 && (
                <p className="text-base text-emerald-600 mb-1">
                  -{receiptData.pointsRedeemed} points utilisés ({formatCurrency(loyaltyDiscount)} de remise)
                </p>
              )}
              {receiptData.pointsEarned > 0 && (
                <p className="text-base text-blue-600 font-medium">
                  +{receiptData.pointsEarned} points gagnés
                </p>
              )}
            </div>
          )}

          {/* Receipt preview */}
          <div className="bg-slate-50 rounded-lg p-4 mb-5 text-left max-h-48 overflow-auto border border-slate-100">
            <pre className="text-[10px] font-mono text-slate-700 whitespace-pre-wrap leading-tight">
              {formatReceiptPreview(receiptData)}
            </pre>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => printReceipt(receiptData)}
              className="flex-1 py-3 text-base font-semibold text-blue-700 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 transition-colors inline-flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimer
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 text-base font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
            >
              {t('pos.close')}
            </button>
          </div>

          <p className="text-xs text-slate-400 mt-3">Entrée pour fermer et imprimer</p>
        </div>
      </div>
    )
  }

  // ── Checkout form ──
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 w-[440px] border border-slate-200 max-h-[90vh] overflow-auto shadow-xl">
        <h2 className="text-xl font-bold text-slate-900 mb-6">{t('pos.checkout')}</h2>

        {loyaltyClient && loyaltyEnabled && pointsToRedeem > 0 && (
          <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-base text-emerald-700">Remise fidélité</span>
              <span className="text-base font-bold text-emerald-700">-{formatCurrency(loyaltyDiscount)}</span>
            </div>
            <p className="text-sm text-emerald-600 mt-1">{pointsToRedeem} points utilisés</p>
          </div>
        )}

        {exchangeContext && (
          <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-blue-700">
                Crédit échange — {exchangeContext.originalSaleNumber}
              </span>
              <span className="text-sm font-bold text-blue-700">-{formatCurrency(exchangeCredit)}</span>
            </div>
            <div className="space-y-1">
              {exchangeContext.returnedItems.map((ri) => (
                <div key={ri.saleItemId} className="flex justify-between text-xs text-blue-600">
                  <span>{ri.productName} ×{ri.quantity}</span>
                  <span>{formatCurrency(ri.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-base">
            <span className="text-slate-500">{t('common.subtotal')}</span>
            <span className="font-semibold text-slate-700">{formatCurrency(currentSubtotal)}</span>
          </div>
          {loyaltyDiscount > 0 && (
            <div className="flex justify-between text-base">
              <span className="text-emerald-600">Remise fidélité</span>
              <span className="text-emerald-600 font-bold">-{formatCurrency(loyaltyDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base">
            <span className="text-slate-500">{t('common.tax')}</span>
            <span className="font-semibold text-slate-700">{formatCurrency(taxAmount)}</span>
          </div>
          <div className="flex justify-between text-2xl font-bold border-t-2 border-slate-100 pt-4 mt-3">
            <span className="text-slate-900">{t('common.total')}</span>
            <span className="text-slate-900">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-500 mb-2">{t('pos.paymentMethod')} <span className="text-slate-400">← →</span></label>
          <div className="flex gap-3">
            <button
              onClick={() => setPaymentMethod('Cash')}
              className={`flex-1 py-3 text-base font-semibold rounded-xl border-2 transition-colors ${
                paymentMethod === 'Cash' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t('sales.payments.cash')}
            </button>
            <button
              onClick={() => setPaymentMethod('Card')}
              className={`flex-1 py-3 text-base font-semibold rounded-xl border-2 transition-colors ${
                paymentMethod === 'Card' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t('sales.payments.card')}
            </button>
          </div>
        </div>

        {paymentMethod === 'Cash' && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-500 mb-2">{t('pos.amountTendered')} <span className="text-slate-400">Entrée pour valider</span></label>
            <input
              ref={amountInputRef}
              type="number"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder={total.toFixed(2)}
              className="w-full px-4 py-3 text-lg border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 font-semibold"
            />
            {amountPaid && (
              <p className="text-sm mt-2 text-slate-500">
                {t('pos.change')}: <span className="font-bold text-lg text-slate-900">{formatCurrency(Math.max(0, change))}</span>
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 text-base font-semibold text-slate-700 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            {t('common.cancel')}
          </button>
          <button
            ref={completeRef}
            onClick={handleComplete}
            disabled={processing || (paymentMethod === 'Cash' && change < 0)}
            className="flex-1 py-3 text-base font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? t('pos.processing') : t('pos.completeSale')}
          </button>
        </div>

        <p className="text-xs text-slate-400 text-center mt-4">
          ← → Changer mode · Entrée Valider · Échap Annuler
        </p>
      </div>
    </div>
  )
}

// Build a short text preview of the receipt for the dialog
function formatReceiptPreview(data: ReceiptData): string {
  const W = 32
  const lines: string[] = []

  lines.push('════════════════════════════════')
  lines.push(center('FLEX SHOES', W))
  lines.push(center('Chaussures & Plus', W))
  lines.push('════════════════════════════════')
  lines.push(`Ticket: ${data.saleNumber}`)
  lines.push(`Date:   ${formatDateShort(data.date)}`)
  lines.push('──────────────────────────────')

  for (const item of data.items) {
    lines.push(item.name)
    const variant = [item.colorName, item.sizeValue].filter(Boolean).join(' / ')
    if (variant) lines.push(`  ${variant}`)
    lines.push(`  ${item.quantity} × ${data.items.length <= 5 ? formatCurrency(item.unitPrice) : item.unitPrice.toFixed(2) + ' DH'}${' '.repeat(6)}${formatCurrency(item.lineTotal)}`)
  }

  lines.push('──────────────────────────────')
  lines.push(`Sous-total:            ${formatCurrency(data.subtotal)}`)
  if (data.loyaltyDiscount > 0) {
    lines.push(`Remise fidelite:      -${formatCurrency(data.loyaltyDiscount)}`)
  }
  lines.push(`TOTAL:                 ${formatCurrency(data.total)}`)
  lines.push('──────────────────────────────')
  lines.push(`Paiement: ${data.paymentMethod === 'Cash' ? 'Especes' : 'Carte'}`)
  if (data.paymentMethod === 'Cash') {
    lines.push(`Paye:     ${formatCurrency(data.amountPaid)}`)
    if (data.change > 0) lines.push(`Monnaie:  ${formatCurrency(data.change)}`)
  }
  lines.push('════════════════════════════════')
  if (data.pointsEarned > 0) lines.push(`+${data.pointsEarned} points gagnes`)
  if (data.receiptBarcode) {
    lines.push(center(`Bon: ${data.receiptBarcode}`, W))
    lines.push(center('Valable 15 jours', W))
  }
  lines.push(center('Merci et a bientot!', W))
  lines.push('════════════════════════════════')

  return lines.join('\n')
}

function center(str: string, len: number): string {
  const pad = Math.max(0, len - str.length)
  const left = Math.floor(pad / 2)
  return ' '.repeat(left) + str
}

function formatDateShort(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}
