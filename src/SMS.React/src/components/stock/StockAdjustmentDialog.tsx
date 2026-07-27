import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">{t('stock.adjust')}</h2>
        <p className="text-sm text-slate-500 mb-5">{productName} ({t('stock.onHand')}: {currentQuantity})</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('adjust')}
              className={`flex-1 py-2 text-sm font-medium rounded-md border transition-colors ${
                mode === 'adjust' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              +/- {t('stock.adjust')}
            </button>
            <button
              type="button"
              onClick={() => setMode('set')}
              className={`flex-1 py-2 text-sm font-medium rounded-md border transition-colors ${
                mode === 'set' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t('stock.setExact')}
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              {mode === 'set' ? t('stock.newQuantity') : t('stock.adjustmentPlusMinus')}
            </label>
            <input
              type="number"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === 'set' ? 'e.g. 50' : 'e.g. +10 ou -5'}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {mode === 'adjust' && value && (
              <p className="text-xs text-slate-400 mt-1">
                {t('stock.newTotal')}: <span className="font-medium text-slate-700">{currentQuantity + parseInt(value || '0')}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('invoices.notes')}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('stock.adjustmentReason')}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onCancel} className="px-3.5 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">
              {t('common.cancel')}
            </button>
            <button type="submit" className="px-3.5 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
              {t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
