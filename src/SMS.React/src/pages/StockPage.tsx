import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/layout/Header'
import StockAdjustmentDialog from '../components/stock/StockAdjustmentDialog'
import StockMovementHistory from '../components/stock/StockMovementHistory'
import { stockApi } from '../api/stock'
import { showToast } from '../components/shared/Toast'
import { useTableSelection } from '../hooks/useTableSelection'
import type { StockItem, StockAdjustmentRequest } from '../types/stock'

export default function StockPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState<StockItem[]>([])
  const [showLowOnly, setShowLowOnly] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [showMovements, setShowMovements] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const tableSelection = useTableSelection<StockItem & { id: number }>()

  const loadStock = useCallback(async () => {
    setLoading(true)
    try {
      const data = showLowOnly ? await stockApi.getLowStock() : await stockApi.getAll()
      setItems(data)
    } finally {
      setLoading(false)
    }
  }, [showLowOnly])

  useEffect(() => { loadStock() }, [loadStock])

  const itemsWithId = useMemo(() => items.map(i => ({ ...i, id: i.productVariantId })), [items])

  const filteredItems = useMemo(() => {
    if (!search.trim()) return itemsWithId
    const q = search.toLowerCase()
    return itemsWithId.filter(
      i => i.productName.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || (i as any).barcode?.toLowerCase().includes(q)
    )
  }, [itemsWithId, search])

  // Keyboard shortcuts — native listener with capture to beat the browser
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.key) {
        case 'Insert':
          e.preventDefault()
          e.stopPropagation()
          setShowLowOnly((prev) => {
            const next = !prev
            showToast(next ? 'Filtrage stock bas activé' : 'Filtrage stock bas désactivé', 'info')
            return next
          })
          break
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          if (showAdjustDialog) { setShowAdjustDialog(false); setSelectedItem(null) }
          else if (showMovements) { setShowMovements(false); setSelectedItem(null) }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [showAdjustDialog, showMovements])

  const handleAdjust = async (data: StockAdjustmentRequest) => {
    if (!selectedItem) return
    try {
      await stockApi.adjust({ ...data, productVariantId: selectedItem.productVariantId })
      showToast(t('common.success'), 'success')
      setShowAdjustDialog(false)
      setSelectedItem(null)
      loadStock()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleDelete = async (variantId: number) => {
    try {
      await stockApi.deleteStock(variantId)
      showToast(t('common.success'), 'success')
      loadStock()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleBulkDelete = async (variantIds: number[]) => {
    try {
      await stockApi.bulkDeleteStock(variantIds)
      tableSelection.clear()
      showToast(t('common.success'), 'success')
      loadStock()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title={t('stock.title')} />
      <div className="p-6 flex-1">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showLowOnly}
                onChange={(e) => setShowLowOnly(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              {t('stock.lowStockFilter')}
            </label>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, or barcode..."
            className="w-72 text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {tableSelection.someSelected && (
          <div className="mb-3 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
            <span className="text-sm font-medium text-blue-800">
              {tableSelection.count} item{tableSelection.count !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => {
                tableSelection.clear()
                showToast('Bulk adjust coming soon', 'info')
              }}
              className="text-xs font-medium text-blue-700 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded-md transition-colors"
            >
              {t('stock.adjust')}
            </button>
            <button
              onClick={() => {
                const ids = Array.from(tableSelection.selected)
                if (ids.length > 0) handleBulkDelete(ids)
              }}
              className="text-xs font-medium text-red-700 hover:text-red-900 bg-red-100 hover:bg-red-200 px-3 py-1 rounded-md transition-colors"
            >
              Delete
            </button>
            <button
              onClick={tableSelection.clear}
              className="ml-auto text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <svg className="mx-auto h-10 w-10 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-sm font-medium text-slate-500">
              {search ? 'No stock items match your search' : 'No stock items found'}
            </p>
            {search && (
              <button onClick={() => setSearch('')} className="mt-2 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={tableSelection.allSelected(filteredItems)}
                      onChange={() => tableSelection.toggleAll(filteredItems)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('table.sku')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('stock.product')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('products.color')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('products.size')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('stock.onHand')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('stock.reserved')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('stock.available')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('stock.reorderLevel')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('sales.status')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.productVariantId} className={`transition-colors ${tableSelection.isSelected(item.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={tableSelection.isSelected(item.id)}
                        onChange={() => tableSelection.toggle(item.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{item.sku}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.productName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.colorName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.sizeValue}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600">{item.quantityOnHand}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600">{item.quantityReserved}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-slate-900">{item.quantityAvailable}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600">{item.reorderLevel}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      {item.isLowStock ? (
                        <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded">{t('stock.isLow')}</span>
                      ) : (
                        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setSelectedItem(item); setShowAdjustDialog(true) }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        >
                          {t('stock.adjust')}
                        </button>
                        <span className="text-slate-200">|</span>
                        <button
                          onClick={() => { setSelectedItem(item); setShowMovements(true) }}
                          className="text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors"
                        >
                          {t('stock.history')}
                        </button>
                        <span className="text-slate-200">|</span>
                        <button
                          onClick={() => handleDelete(item.productVariantId)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdjustDialog && selectedItem && (
        <StockAdjustmentDialog
          productVariantId={selectedItem.productVariantId}
          productName={`${selectedItem.productName} - ${selectedItem.colorName} / ${selectedItem.sizeValue}`}
          currentQuantity={selectedItem.quantityOnHand}
          onSubmit={handleAdjust}
          onCancel={() => { setShowAdjustDialog(false); setSelectedItem(null) }}
        />
      )}

      {showMovements && selectedItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[700px] max-h-[80vh] overflow-auto border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-900">
                {t('stock.history')}: {selectedItem.productName} - {selectedItem.colorName} / {selectedItem.sizeValue}
              </h3>
              <button onClick={() => { setShowMovements(false); setSelectedItem(null) }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <StockMovementHistory productVariantId={selectedItem.productVariantId} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
