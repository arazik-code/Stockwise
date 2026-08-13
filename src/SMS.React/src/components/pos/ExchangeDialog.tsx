import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, ScanLine, Search } from 'lucide-react'
import { refundsApi, type SaleForRefund, type SaleItemForRefund, type ProductVariantForExchange } from '../../api/refunds'
import { formatCurrency } from '../../utils/format'
import { useCartStore } from '../../store/cartStore'
import { useExchangeStore, type ExchangeReturnedItem } from '../../store/exchangeStore'
import { Badge, Button, Checkbox, EmptyState, Input, Modal, Spinner, cn } from '../ui'

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
      <Modal
        open
        onClose={onClose}
        closeOnEsc={false}
        size="md"
        title={
          <div>
            <Badge tone="caution" size="xs" className="mb-1 uppercase tracking-wide">Échange</Badge>
            <div className="text-base font-bold text-fg">{t('pos.exchange.scanReceipt')}</div>
          </div>
        }
      >
        <Input
          ref={scanInputRef}
          type="text"
          size="lg"
          leading={<ScanLine className="h-5 w-5" />}
          trailing={loading ? <Spinner size="sm" /> : undefined}
          onChange={(e) => handleScanInput(e.target.value)}
          onKeyDown={handleScanKeyDown}
          placeholder={t('pos.exchange.scanPlaceholder')}
          autoFocus
        />

        <p className="mt-4 text-center text-xs text-fg-subtle">Scannez le bon de caisse ou entrez le numéro manuellement</p>
      </Modal>
    )
  }

  // ── Step: Select return items ──
  if (step === 'selectReturn' && sale) {
    const availableItems = sale.items.filter((i) => i.availableForRefund > 0)
    return (
      <Modal
        open
        onClose={onClose}
        closeOnEsc={false}
        size="xl"
        bodyClassName="p-0"
        title={
          <div>
            <Badge tone="caution" size="xs" className="mb-1 uppercase tracking-wide">Échange</Badge>
            <div className="text-base font-bold text-fg">{t('pos.exchange.selectReturnItems')}</div>
          </div>
        }
        footer={
          <>
            <Button variant="outline" onClick={() => { setSale(null); setStep('scan'); setSelectedReturnItems([]) }}>
              Retour
            </Button>
            <Button variant="solid" onClick={handleConfirmReturnItems} disabled={selectedReturnItems.length === 0}>
              Continuer
            </Button>
          </>
        }
      >
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-6 py-3 text-sm">
          <span className="text-fg-muted">
            Vente: <span className="font-semibold text-fg">{sale.saleNumber}</span>
            {sale.clientName && <span className="ml-2 text-fg-subtle">— {sale.clientName}</span>}
          </span>
          <span className="text-fg-subtle">{new Date(sale.createdAt).toLocaleDateString('fr-FR')}</span>
        </div>

        <div className="space-y-2 px-6 py-4">
          {availableItems.map((item) => {
            const selected = selectedReturnItems.find((i) => i.id === item.id)
            return (
              <div
                key={item.id}
                onClick={() => toggleReturnItem(item)}
                data-tone="caution"
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-card border p-3 transition-colors duration-fast',
                  selected ? 'border-[var(--tone)] bg-[var(--tone-soft)]' : 'border-border bg-surface hover:border-border-strong'
                )}
              >
                <Checkbox checked={!!selected} onChange={() => toggleReturnItem(item)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{item.productName}</p>
                  <p className="text-xs text-fg-subtle">
                    {item.colorName} · {item.sizeValue}
                    {item.productSku && <span className="ml-1 text-fg-subtle">({item.productSku})</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-sm font-medium text-fg">{formatCurrency(item.unitPrice)}</p>
                  <p className="num text-xs text-fg-subtle">×{item.availableForRefund} dispo</p>
                </div>
              </div>
            )
          })}
        </div>

        {selectedReturnItems.length > 0 && (
          <div
            data-tone="caution"
            className="mx-6 mb-4 flex items-center justify-between rounded-card bg-[var(--tone-soft)] px-3 py-2.5"
          >
            <span className="text-sm text-[var(--tone-ink)]">{selectedReturnItems.length} article(s) sélectionné(s)</span>
            <span className="num text-sm font-bold text-[var(--tone-ink)]">Crédit: {formatCurrency(totalRefund)}</span>
          </div>
        )}
      </Modal>
    )
  }

  // ── Step: Search replacement ──
  if (step === 'searchReplace') {
    return (
      <Modal
        open
        onClose={onClose}
        closeOnEsc={false}
        size="lg"
        bodyClassName="p-0"
        title={
          <div>
            <Badge tone="caution" size="xs" className="mb-1 uppercase tracking-wide">Échange</Badge>
            <div className="text-base font-bold text-fg">{t('pos.exchange.selectReplacement')}</div>
          </div>
        }
        footer={
          <Button variant="outline" onClick={() => { setStep('selectReturn'); setSearchQuery(''); setSearchResults([]) }}>
            Retour
          </Button>
        }
      >
        <div data-tone="caution" className="border-b border-border bg-[var(--tone-soft)] px-6 py-3 text-sm">
          <span className="text-[var(--tone-ink)]">
            Crédit retour: <span className="num font-bold">{formatCurrency(totalRefund)}</span>
          </span>
          <span className="mx-2 text-[var(--tone-ink)] opacity-50">·</span>
          <span className="text-[var(--tone-ink)] opacity-80">{selectedReturnItems.length} article(s) retourné(s)</span>
        </div>

        <div className="p-6">
          <Input
            ref={searchInputRef}
            type="text"
            leading={<Search className="h-4 w-4" />}
            trailing={searching ? <Spinner size="sm" /> : undefined}
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Rechercher le produit de remplacement... (ou scanner)"
            autoFocus
            wrapperClassName="mb-4"
          />

          {searchResults.length > 0 ? (
            <div className="space-y-2">
              {searchResults.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => handleConfirmExchange(variant)}
                  className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-3 text-left transition-colors duration-fast hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-chip bg-surface-2">
                    <span
                      className="h-3 w-3 rounded-chip border border-border"
                      style={{ backgroundColor: variant.colorHexCode }}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{variant.productName}</p>
                    <p className="text-xs text-fg-subtle">
                      {variant.colorName} · {variant.sizeValue}
                      {variant.sku && <span className="ml-1 text-fg-subtle">({variant.sku})</span>}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num text-sm font-medium text-fg">{formatCurrency(variant.price)}</p>
                    <p className="num text-xs text-fg-subtle">Stock: {variant.stockQuantity}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : searchQuery.trim() ? (
            <EmptyState compact variant="search" title="Aucun produit trouvé" />
          ) : (
            <p className="py-8 text-center text-sm text-fg-subtle">
              Tapez le nom, SKU ou scannez le code-barres du produit de remplacement
            </p>
          )}
        </div>
      </Modal>
    )
  }

  return null
}
