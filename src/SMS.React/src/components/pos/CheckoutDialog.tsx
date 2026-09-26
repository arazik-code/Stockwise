import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Printer } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { useExchangeStore } from '../../store/exchangeStore'
import { salesApi } from '../../api/sales'
import { refundsApi } from '../../api/refunds'
import { formatCurrency } from '../../utils/format'
import { printReceipt, printExchangeReceipt, buildReceiptData, type ReceiptData } from '../../utils/printReceipt'
import { isDesktopShell } from '../../utils/printBridge'
import { Button, Input, KeyHint, Modal, Tabs } from '../ui'
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

      const sale = await salesApi.create({
        category: category,
        paymentMethod: paymentMethod === 'Cash' ? 0 : 1,
        amountPaid: amountPaidNum,
        taxRate: useCartStore.getState().taxRate,
        clientId: loyaltyClient?.id,
        loyaltyPointsToRedeem: loyaltyEnabled && pointsToRedeem > 0 ? pointsToRedeem : undefined,
        exchangeCreditAmount: isExchange ? exchangeCredit : undefined,
        items: items.map((i) => ({
          productVariantId: i.productVariantId,
          quantity: i.quantity,
          discountAmount: 0,
        })),
      })

      // The receipt's total/paid/change come from the persisted sale, not a locally recomputed
      // value - for an exchange this is the only number that's actually credit-adjusted (the backend
      // applies exchangeCreditAmount), so using it here is what keeps the printed ticket, the change
      // given, and the sale record itself in agreement instead of drifting apart.
      const capturedTotal = sale.totalAmount

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
        amountPaid: sale.amountPaid,
        change: sale.changeGiven,
        clientName: loyaltyClient?.name,
        clientQrCode: loyaltyClient?.qrCode,
        pointsEarned: loyaltyEnabled && !hasLiquidationItems() ? pointsToEarn : 0,
        pointsRedeemed: loyaltyEnabled && pointsToRedeem > 0 ? pointsToRedeem : 0,
        receiptBarcode: sale.receiptBarcode,
      })

      setReceiptData(receipt)
      clearCart()

      // Auto-print only inside the desktop shell, where printing goes straight to the OS
      // default printer with no dialog (see printBridge.ts). In a plain browser tab,
      // window.print() opens a real, OS-level modal dialog - reproduced directly: once it's
      // open, the tab stops responding to ANY input until it's dismissed. Auto-firing that,
      // unannounced, 800ms after the cashier finishes a sale is exactly what "the app just
      // froze" looks like. There, printing stays a deliberate action via the button below.
      if (isDesktopShell()) {
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
      }

      if (onSaleComplete) {
        onSaleComplete()
      }
    } catch (err) {
      console.error('Checkout failed:', err)
    } finally {
      setProcessing(false)
    }
  }, [processing, paymentMethod, change, items, total, currentSubtotal, taxAmount, taxRate, loyaltyClient, loyaltyEnabled, pointsToRedeem, loyaltyDiscount, hasLiquidationItems, pointsToEarn, amountPaid, amountPaidNum, clearCart, onSaleComplete, exchangeContext, exchangeCredit])

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
      <Modal open onClose={onClose} closeOnEsc={false} size="sm" showClose={false} bodyClassName="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-chip bg-[var(--positive-soft)] text-[var(--positive)]">
          <Check className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-fg">{t('pos.saleComplete')}</h2>
        <p className="mb-4 text-base text-fg-subtle">
          {t('pos.receipt')}: <span className="num font-mono font-bold text-fg">{receiptData.saleNumber}</span>
        </p>

        {/* Loyalty info */}
        {loyaltyClient && (
          <div className="mb-5 rounded-card bg-surface-2 p-4">
            {receiptData.pointsRedeemed > 0 && (
              <p className="num mb-1 text-base text-[var(--positive)]">
                -{receiptData.pointsRedeemed} points utilisés ({formatCurrency(loyaltyDiscount)} de remise)
              </p>
            )}
            {receiptData.pointsEarned > 0 && (
              <p className="num text-base font-medium text-[var(--info)]">
                +{receiptData.pointsEarned} points gagnés
              </p>
            )}
          </div>
        )}

        {/* Receipt preview */}
        <div className="mb-5 max-h-48 overflow-auto rounded-card border border-border bg-surface-2 p-4 text-left">
          <pre className="num whitespace-pre-wrap font-mono text-[10px] leading-tight text-fg-muted">
            {formatReceiptPreview(receiptData)}
          </pre>
        </div>

        {/* grid, not flex: two shrink-0 fullWidth buttons in a flex row both
            claim 100% of the row and neither can shrink to make room for the
            other, blowing the pair out past the dialog. A grid gives each
            button its own column instead. */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="soft" fullWidth icon={<Printer className="h-5 w-5" />} onClick={() => printReceipt(receiptData)}>
            Imprimer
          </Button>
          <Button variant="solid" fullWidth onClick={onClose}>
            {t('pos.close')}
          </Button>
        </div>

        <p className="mt-3 text-xs text-fg-subtle">
          {isDesktopShell()
            ? 'Entrée pour fermer et imprimer'
            : "Entrée pour fermer et imprimer — une fenêtre d'impression du système va s'ouvrir"}
        </p>
      </Modal>
    )
  }

  // ── Checkout form ──
  return (
    <Modal
      open
      onClose={onClose}
      closeOnEsc={false}
      size="sm"
      title={t('pos.checkout')}
      footer={
        <div className="flex w-full flex-col gap-3">
          {/* grid, not flex - see the note on the post-sale Imprimer/Fermer row above.
              This is the button that was rendering ~320px outside the dialog. */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" fullWidth onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              ref={completeRef}
              variant="success"
              fullWidth
              onClick={handleComplete}
              disabled={processing || (paymentMethod === 'Cash' && change < 0)}
              loading={processing}
            >
              {t('pos.completeSale')}
            </Button>
          </div>
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
            <KeyHint keys={['←', '→']} /> Changer mode
            <span>·</span>
            <KeyHint keys={['Entrée']} /> Valider
            <span>·</span>
            <KeyHint keys={['Échap']} /> Annuler
          </p>
        </div>
      }
    >
      {loyaltyClient && loyaltyEnabled && pointsToRedeem > 0 && (
        <div data-tone="positive" className="mb-5 rounded-card border border-[color-mix(in_oklab,var(--tone)_28%,transparent)] bg-[var(--tone-soft)] p-4">
          <div className="flex items-center justify-between">
            <span className="text-base text-[var(--tone-ink)]">Remise fidélité</span>
            <span className="num text-base font-bold text-[var(--tone-ink)]">-{formatCurrency(loyaltyDiscount)}</span>
          </div>
          <p className="num mt-1 text-sm text-[var(--tone-ink)] opacity-80">{pointsToRedeem} points utilisés</p>
        </div>
      )}

      {exchangeContext && (
        <div data-tone="info" className="mb-5 rounded-card border border-[color-mix(in_oklab,var(--tone)_28%,transparent)] bg-[var(--tone-soft)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--tone-ink)]">
              Crédit échange — {exchangeContext.originalSaleNumber}
            </span>
            <span className="num text-sm font-bold text-[var(--tone-ink)]">-{formatCurrency(exchangeCredit)}</span>
          </div>
          <div className="space-y-1">
            {exchangeContext.returnedItems.map((ri) => (
              <div key={ri.saleItemId} className="flex justify-between text-xs text-[var(--tone-ink)] opacity-80">
                <span>{ri.productName} ×{ri.quantity}</span>
                <span className="num">{formatCurrency(ri.lineTotal)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 space-y-3">
        <div className="flex justify-between text-base">
          <span className="text-fg-subtle">{t('common.subtotal')}</span>
          <span className="num font-semibold text-fg-muted">{formatCurrency(currentSubtotal)}</span>
        </div>
        {loyaltyDiscount > 0 && (
          <div className="flex justify-between text-base">
            <span className="text-[var(--positive)]">Remise fidélité</span>
            <span className="num font-bold text-[var(--positive)]">-{formatCurrency(loyaltyDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base">
          <span className="text-fg-subtle">{t('common.tax')}</span>
          <span className="num font-semibold text-fg-muted">{formatCurrency(taxAmount)}</span>
        </div>
        <div className="mt-3 flex justify-between border-t-2 border-border pt-4 text-2xl font-bold">
          <span className="text-fg">{t('common.total')}</span>
          <span className="num text-fg">{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="mb-5">
        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-fg-subtle">
          {t('pos.paymentMethod')} <KeyHint keys={['←', '→']} />
        </label>
        <Tabs
          variant="segmented"
          className="grid w-full grid-cols-2"
          items={[
            { value: 'Cash', label: t('sales.payments.cash') },
            { value: 'Card', label: t('sales.payments.card') },
          ]}
          value={paymentMethod}
          onChange={setPaymentMethod}
        />
      </div>

      {paymentMethod === 'Cash' && (
        <div className="mb-5">
          <Input
            ref={amountInputRef}
            type="number"
            label={
              <span className="flex items-center gap-2">
                {t('pos.amountTendered')} <KeyHint keys={['Entrée']} />
              </span>
            }
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            placeholder={total.toFixed(2)}
            size="lg"
            className="num font-semibold"
          />
          {amountPaid && (
            <p className="mt-2 text-sm text-fg-subtle">
              {t('pos.change')}: <span className="num text-lg font-bold text-fg">{formatCurrency(Math.max(0, change))}</span>
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

// Build a short text preview of the receipt for the dialog
function formatReceiptPreview(data: ReceiptData): string {
  const W = 32
  const lines: string[] = []

  lines.push('════════════════════════════════')
  lines.push(center('MY STORE', W))
  lines.push(center('Thank you for shopping with us', W))
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
