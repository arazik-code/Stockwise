import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/layout/Header'
import { salesApi } from '../api/sales'
import { showToast } from '../components/shared/Toast'
import { formatCurrency, formatDate } from '../utils/format'
import type { Sale } from '../types/sale'

// Manual reconciliation tooling (plan doc Phase 5) - sales rung up on the local fallback while
// the VPS was unreachable are never auto-pushed back (decision #3: automatic reconciliation risks
// silently overselling stock Shopify already sold online during the same outage window). This
// page is the owner's worklist: review each sale, re-key it into the VPS by hand, mark it done.
export default function OfflineSalesPage() {
  const { t } = useTranslation()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [reconcilingId, setReconcilingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSales(await salesApi.getOfflineSales())
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  const handleReconcile = async (sale: Sale) => {
    if (!confirm(t('offlineSales.reconcileConfirm'))) return
    setReconcilingId(sale.id)
    try {
      await salesApi.markReconciled(sale.id)
      showToast(t('offlineSales.reconcileSuccess'), 'success')
      load()
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setReconcilingId(null)
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title={t('offlineSales.title')} />
      <div className="p-6 flex-1 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">{t('offlineSales.explanation')}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('sales.saleNumber')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('offlineSales.date')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('offlineSales.client')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('offlineSales.items')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('offlineSales.total')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-sm text-slate-400">{t('offlineSales.noneFound')}</td></tr>
                )}
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 font-mono">{sale.saleNumber}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(sale.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{sale.clientName ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {sale.items.map((i) => `${i.productName} (${[i.colorName, i.sizeValue].filter(Boolean).join(' / ')}) x${i.quantity}`).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{formatCurrency(sale.totalAmount)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleReconcile(sale)}
                        disabled={reconcilingId === sale.id}
                        className="text-xs font-medium px-2.5 py-1 rounded-md text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {reconcilingId === sale.id ? t('common.loading') : t('offlineSales.markReconciled')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
