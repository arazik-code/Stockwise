import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { refundsApi, type SaleForRefund, type SaleItemForRefund, type ProductVariantForExchange } from '../../api/refunds'
import { formatCurrency } from '../../utils/format'
import { useCartStore } from '../../store/cartStore'
import { useExchangeStore, type ExchangeReturnedItem } from '../../store/exchangeStore'

interface ExchangeDialogProps {
  onClose: () => void
  onReadyForCheckout: () => void
}

export default function ExchangeDialog({ onClose, onReadyForCheckout }: ExchangeDialogProps) {
  const { t } = useTranslation()
  const addItem = useCartStore((s) => s.addItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const setExchangeContext = useExchangeStore((s) => s.setExchangeContext)

  const [step, setStep] = useState<'scan' | 'selectReturn' | 'searchReplace'>('scan')
  const [sale, setSale] = useState<SaleForRefund | null>(null)
  const [selectedReturnItems, setSelectedReturnItems] = useState<SaleItemForRefund[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProductVariantForExchange[]>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)

  const scanInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const scannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scannerKeyTimeRef = useRef<number>(0)
  const scannerLikelyRef = useRef(true)

  // ── Receipt scan ──
  const handleScanReceipt = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return
    setLoading(true)
    try {
      const data = await refundsApi.scanBarcode(barcode.trim())
      setSale(data)
      setStep('selectReturn')
    } catch {
      try {
        const data = await refundsApi.getSaleForRefund(parseInt(barcode.trim()))
        setSale(data)
        setStep('selectReturn')
      } catch {
        // Try finding by sale number
        try {
          const allSales = await import('../../api/sales').then(m => m.salesApi.getAll())
          const found = allSales.find((s: any) => s.saleNumber === barcode.trim())
          if (found) {
            const data = await refundsApi.getSaleForRefund(found.id)
            setSale(data)
            setStep('selectReturn')
          }
        } catch { }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const handleScanInput = useCallback((value: string) => {
    const now = performance.now()
    const gap = now - scannerKeyTimeRef.current
    scannerKeyTimeRef.current = now
    if (value.length <= 1) {
      scannerLikelyRef.current = true
    } else if (gap > 50) {
      scannerLikelyRef.current = false
    }

    if (scannerTimerRef.current) clearTimeout(scannerTimerRef.current)
    if (scannerLikelyRef.current && /^[A-Za-z0-9-]+$/.test(value) && value.length >= 10) {
      scannerTimerRef.current = setTimeout(() => {
        handleScanReceipt(value)
        scanInputRef.current && (scanInputRef.current.value = '')
      }, 80)
    }
  }, [handleScanReceipt])

  const handleScanKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (scannerTimerRef.current) clearTimeout(scannerTimerRef.current)
      const val = (e.target as HTMLInputElement).value
      if (val.trim()) handleScanReceipt(val)
    }
  }, [handleScanReceipt])

  // ── Return item selection ──
  const toggleReturnItem = (item: SaleItemForRefund) => {
    setSelectedReturnItems((prev) => {
      const exists = prev.find((i) => i.id === item.id)
      if (exists) return prev.filter((i) => i.id !== item.id)
      return [...prev, item]
    })
  }

  const totalRefund = selectedReturnItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)

  const handleConfirmReturnItems = () => {
    if (selectedReturnItems.length === 0) return
    setStep('searchReplace')
    setTimeout(() => searchInputRef.current?.focus(), 100)
  }

  // ── Replacement search ──
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) { setSearchResults([]); return }
    setSearching(true)
    try {
      const results = await refundsApi.searchVariants(query.trim())
      setSearchResults(results.filter((r) => r.stockQuantity > 0))
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const searchScannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchScannerKeyTimeRef = useRef<number>(0)
  const searchScannerLikelyRef = useRef(true)

  const handleSearchInput = useCallback((value: string) => {
    const now = performance.now()
    const gap = now - searchScannerKeyTimeRef.current
    searchScannerKeyTimeRef.current = now
    if (value.length <= 1) {
      searchScannerLikelyRef.current = true
    } else if (gap > 50) {
      searchScannerLikelyRef.current = false
    }

    setSearchQuery(value)
    if (value.length >= 2) handleSearch(value)
    else if (value.length === 0) setSearchResults([])

    if (searchScannerLikelyRef.current && /^[A-Za-z0-9-]+$/.test(value) && value.length >= 8) {
      if (searchScannerTimerRef.current) clearTimeout(searchScannerTimerRef.current)
      searchScannerTimerRef.current = setTimeout(() => {
        handleSearch(value)
      }, 80)
    }
  }, [handleSearch])

  // ── Confirm exchange: add to cart + set context + open checkout ──
  const handleConfirmExchange = (variant: ProductVariantForExchange) => {
    // Clear cart and add replacement item
    clearCart()

    // Build a ProductVariant-like object for the cart store
    const cartVariant = {
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      barcode: variant.barcode,
      price: variant.price,
      costPrice: 0,
      colorName: variant.colorName,
      sizeValue: variant.sizeValue,
      isLiquidation: false,
      imageUrl: variant.imageUrl,
      stockQuantity: variant.stockQuantity,
    } as any

    addItem(cartVariant, variant.productName)

    // Store exchange context
    const returnedItems: ExchangeReturnedItem[] = selectedReturnItems.map((ri) => ({
      saleItemId: ri.id,
      productVariantId: ri.productVariantId,
      productName: ri.productName,
      sku: ri.productSku,
      colorName: ri.colorName,
      sizeValue: ri.sizeValue,
      quantity: ri.quantity,
      unitPrice: ri.unitPrice,
      lineTotal: ri.lineTotal,
    }))

    setExchangeContext({
      originalSaleId: sale!.id,
      originalSaleNumber: sale!.saleNumber,
      clientId: sale!.clientId,
      clientName: sale!.clientName,
      returnedItems,
      totalRefundAmount: totalRefund,
    })

    onReadyForCheckout()
    onClose()
  }

  // ── Step: Scan ──
  if (step === 'scan') {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 w-[480px] border border-slate-200 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-700 rounded-full">ÉCHANGE</span>
              <h2 className="text-lg font-bold text-slate-900">{t('pos.exchange.scanReceipt')}</h2>
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <input
              ref={scanInputRef}
              type="text"
              onChange={(e) => handleScanInput(e.target.value)}
              onKeyDown={handleScanKeyDown}
              placeholder={t('pos.exchange.scanPlaceholder')}
              autoFocus
              className="w-full pl-10 pr-4 py-3 text-base border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            {loading && (
              <div className="absolute right-3 top-3.5 text-xs text-slate-400">{t('common.loading')}</div>
            )}
          </div>

          <p className="text-xs text-slate-400 text-center">Scannez le bon de caisse ou entrez le numéro manuellement</p>
        </div>
      </div>
    )
  }

  // ── Step: Select return items ──
  if (step === 'selectReturn' && sale) {
    const availableItems = sale.items.filter((i) => i.availableForRefund > 0)
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 w-[600px] max-h-[80vh] overflow-auto border border-slate-200 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-700 rounded-full">ÉCHANGE</span>
              <h2 className="text-lg font-bold text-slate-900">{t('pos.exchange.selectReturnItems')}</h2>
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 mb-4 flex items-center justify-between text-sm">
            <span className="text-slate-600">
              Vente: <span className="font-semibold text-slate-900">{sale.saleNumber}</span>
              {sale.clientName && <span className="ml-2 text-slate-500">— {sale.clientName}</span>}
            </span>
            <span className="text-slate-500">
              {new Date(sale.createdAt).toLocaleDateString('fr-FR')}
            </span>
          </div>

          <div className="space-y-2 mb-4">
            {availableItems.map((item) => {
              const selected = selectedReturnItems.find((i) => i.id === item.id)
              return (
                <div
                  key={item.id}
                  onClick={() => toggleReturnItem(item)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selected ? 'bg-orange-50 border-orange-300' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!selected}
                    onChange={() => toggleReturnItem(item)}
                    className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{item.productName}</p>
                    <p className="text-xs text-slate-500">
                      {item.colorName} · {item.sizeValue}
                      {item.productSku && <span className="ml-1 text-slate-400">({item.productSku})</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">{formatCurrency(item.unitPrice)}</p>
                    <p className="text-xs text-slate-500">×{item.availableForRefund} dispo</p>
                  </div>
                </div>
              )
            })}
          </div>

          {selectedReturnItems.length > 0 && (
            <div className="bg-orange-50 rounded-lg p-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-orange-700">
                {selectedReturnItems.length} article(s) sélectionné(s)
              </span>
              <span className="text-sm font-bold text-orange-700">
                Crédit: {formatCurrency(totalRefund)}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setSale(null); setStep('scan'); setSelectedReturnItems([]) }}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Retour
            </button>
            <button
              onClick={handleConfirmReturnItems}
              disabled={selectedReturnItems.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continuer
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step: Search replacement ──
  if (step === 'searchReplace') {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 w-[550px] max-h-[80vh] overflow-auto border border-slate-200 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-700 rounded-full">ÉCHANGE</span>
              <h2 className="text-lg font-bold text-slate-900">{t('pos.exchange.selectReplacement')}</h2>
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="bg-orange-50 rounded-lg p-3 mb-4 text-sm">
            <span className="text-orange-700">
              Crédit retour: <span className="font-bold">{formatCurrency(totalRefund)}</span>
            </span>
            <span className="mx-2 text-orange-300">·</span>
            <span className="text-orange-600">
              {selectedReturnItems.length} article(s) retourné(s)
            </span>
          </div>

          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Rechercher le produit de remplacement... (ou scanner)"
              autoFocus
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            {searching && (
              <div className="absolute right-3 top-3 text-xs text-slate-400">{t('common.loading')}</div>
            )}
          </div>

          {searchResults.length > 0 ? (
            <div className="space-y-2 mb-4">
              {searchResults.map((variant) => (
                <div
                  key={variant.id}
                  onClick={() => handleConfirmExchange(variant)}
                  className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
                    <span className="w-3 h-3 rounded-full border border-slate-300" style={{ backgroundColor: variant.colorHexCode }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{variant.productName}</p>
                    <p className="text-xs text-slate-500">
                      {variant.colorName} · {variant.sizeValue}
                      {variant.sku && <span className="ml-1 text-slate-400">({variant.sku})</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-slate-900">{formatCurrency(variant.price)}</p>
                    <p className="text-xs text-slate-400">Stock: {variant.stockQuantity}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          ) : searchQuery.trim() ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Aucun produit trouvé
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              Tapez le nom, SKU ou scannez le code-barres du produit de remplacement
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => { setStep('selectReturn'); setSearchQuery(''); setSearchResults([]) }}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Retour
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
