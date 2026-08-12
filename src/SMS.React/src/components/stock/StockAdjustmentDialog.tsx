import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input, Modal, Tabs } from '../ui'
import type { StockAdjustmentRequest } from '../../types/stock'

interface StockAdjustmentDialogProps {
  productVariantId: number
  productName: string
  currentQuantity: number
  onSubmit: (data: StockAdjustmentRequest) => void
  onCancel: () => void
}

export default function StockAdjustmentDialog({
  productVariantId,
  productName,
  currentQuantity,
  onSubmit,
  onCancel,
}: StockAdjustmentDialogProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'set' | 'adjust'>('adjust')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const numValue = parseInt(value)
    if (isNaN(numValue)) return

    const request: StockAdjustmentRequest = {
      productVariantId,
      notes: notes || undefined,
    }

    if (mode === 'set') {
      request.newQuantity = numValue
    } else {
      request.adjustmentDelta = numValue
    }

    onSubmit(request)
  }

  return (
    /* closeOnEsc stays false: StockPage owns Escape in a capture-phase listener
       that already closes this dialog. Two handlers for one press would fire
       twice. */
    <Modal
      open
      onClose={onCancel}
      size="sm"
      title={t('stock.adjust')}
      description={`${productName} (${t('stock.onHand')}: ${currentQuantity})`}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="stock-adjustment-form" size="sm">
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="stock-adjustment-form" onSubmit={handleSubmit} className="space-y-4">
        <Tabs<'set' | 'adjust'>
          value={mode}
          onChange={setMode}
          variant="segmented"
          size="sm"
          layoutGroupId="stock-adjust-mode"
          className="w-full"
          items={[
            { value: 'adjust', label: `+/- ${t('stock.adjust')}` },
            { value: 'set', label: t('stock.setExact') },
          ]}
        />

        <Input
          type="number"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={mode === 'set' ? 'e.g. 50' : 'e.g. +10 ou -5'}
          label={mode === 'set' ? t('stock.newQuantity') : t('stock.adjustmentPlusMinus')}
          size="sm"
          className="num"
          hint={
            mode === 'adjust' && value ? (
              <>
                {t('stock.newTotal')}:{' '}
                <span className="num font-medium text-fg">
                  {currentQuantity + parseInt(value || '0')}
                </span>
              </>
            ) : undefined
          }
        />

        <Input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('stock.adjustmentReason')}
          label={t('invoices.notes')}
          size="sm"
        />
      </form>
    </Modal>
  )
}
