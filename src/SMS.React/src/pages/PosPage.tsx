import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/layout/Header'
import ProductGrid from '../components/pos/ProductGrid'
import ProductSearch, { type ProductSearchHandle } from '../components/pos/ProductSearch'
import Cart from '../components/pos/Cart'
import CheckoutDialog from '../components/pos/CheckoutDialog'
import ExchangeDialog from '../components/pos/ExchangeDialog'
import ProductVariantsModal from '../components/pos/ProductVariantsModal'
import ClientLookup from '../components/loyalty/ClientLookup'
import ClientRegistration from '../components/loyalty/ClientRegistration'
import LoyaltyDisplay from '../components/loyalty/LoyaltyDisplay'
import CashDrawerModal from '../components/pos/CashDrawerModal'
import { useCartStore } from '../store/cartStore'
import { useAuthStore } from '../store/authStore'
import { useProducts } from '../hooks/useProducts'
import { useSignalR } from '../hooks/useSignalR'
import { productsApi } from '../api/products'
import { clientsApi, settingsApi, type LoyaltySettingsConfig } from '../api/clients'
import { showToast } from '../components/shared/Toast'
import { playScanSuccess, playScanError } from '../utils/sound'
import type { Client } from '../api/clients'
import type { Product, ProductVariant } from '../types/product'

export default function PosPage() {
  const { t } = useTranslation()
  const { products, variants, loading, loadProducts, searchProducts } = useProducts()
  const isAdmin = useAuthStore((s) => s.user?.role === 'Admin')
  const [showCheckout, setShowCheckout] = useState(false)
  const [showExchange, setShowExchange] = useState(false)
  const [showClientLookup, setShowClientLookup] = useState(false)
  const [showRegistration, setShowRegistration] = useState(false)
  const [showCashDrawer, setShowCashDrawer] = useState(false)
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null)
  const [registrationPhone, setRegistrationPhone] = useState('')
  const [loyaltyClient, setLoyaltyClient] = useState<Client | null>(null)
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true)
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettingsConfig>({
    newClientRate: 5,
    ancientClientRate: 8,
    pointsForRedemption: 10,
    dhPerRedemption: 1.00,
    welcomePoints: 50,
    enabled: true,
  })
  const addItem = useCartStore((s) => s.addItem)
  const items = useCartStore((s) => s.items)
  const subtotal = useCartStore((s) => s.subtotal)
  const setTaxRate = useCartStore((s) => s.setTaxRate)
  const hasLiquidationItems = useCartStore((s) => s.hasLiquidationItems)
  const clearCart = useCartStore((s) => s.clearCart)
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const productSearchRef = useRef<ProductSearchHandle>(null)
  useSignalR()

  const isLiquidationCart = hasLiquidationItems()

  useEffect(() => {
    loadProducts()
    settingsApi.getLoyalty().then(setLoyaltySettings).catch(() => {})
    settingsApi.getTax().then((s) => setTaxRate(s.rate)).catch(() => {})
  }, [loadProducts, setTaxRate])

  useEffect(() => {
    if (isLiquidationCart && loyaltyEnabled) {
      setLoyaltyEnabled(false)
      showToast('Fidélité désactivée — les produits en liquidation ne bénéficient pas de points', 'info')
    }
  }, [isLiquidationCart])

  // Keyboard shortcuts — native listener with capture to beat the browser
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // The product-variants modal owns the keyboard while it's open (it has its own Escape handler)
      if (scannedProduct) return

      // Hidden admin shortcut - works even while a scanner/search input is focused, since a
      // cashier could be mid-scan when the owner needs to record a cash movement. Silently does
      // nothing for non-admins - not just disabled, genuinely invisible.
      if (isAdmin && e.ctrlKey && e.key.toLowerCase() === 'g' && !showCashDrawer) {
        e.preventDefault()
        e.stopPropagation()
        setShowCashDrawer(true)
        return
      }

      // The cash-drawer modal owns the keyboard while it's open (it has its own Escape/Enter handling)
      if (showCashDrawer) return

      // Don't trigger when typing in inputs (but allow Escape to blur)
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') {
          ;(e.target as HTMLElement).blur()
          e.stopPropagation()
        }
        return
      }

      switch (e.key) {
        case 'Insert':
          e.preventDefault()
          e.stopPropagation()
          productSearchRef.current?.focus()
          break
        case 'Home':
          e.preventDefault()
          e.stopPropagation()
          if (loyaltyClient) {
            setLoyaltyClient(null)
            showToast('Client retiré', 'info')
          } else {
            setShowClientLookup(true)
          }
          break
        case 'End':
          e.preventDefault()
          e.stopPropagation()
          if (loyaltyClient) {
            handleToggleLoyalty(!loyaltyEnabled)
          }
          break
        case 'Enter':
          e.preventDefault()
          e.stopPropagation()
          if (itemCount > 0) {
            setShowCheckout(true)
          }
          break
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          if (showCheckout) setShowCheckout(false)
          else if (showExchange) setShowExchange(false)
          else if (showClientLookup) setShowClientLookup(false)
          else if (showRegistration) setShowRegistration(false)
          else if (itemCount > 0) clearCart()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [loyaltyClient, loyaltyEnabled, itemCount, showCheckout, showExchange, showClientLookup, showRegistration, showCashDrawer, scannedProduct, isAdmin, clearCart])

  const { loyaltyDiscount, pointsToRedeem } = useMemo(() => {
    if (!loyaltyClient || !loyaltyEnabled || isLiquidationCart || !loyaltySettings.enabled) {
      return { loyaltyDiscount: 0, pointsToRedeem: 0 }
    }
    const { pointsForRedemption, dhPerRedemption } = loyaltySettings
    const currentSubtotal = subtotal()

    const maxRedeemable = loyaltyClient.totalPoints
    const maxDiscountUnits = Math.floor(maxRedeemable / pointsForRedemption)
    const maxDiscount = maxDiscountUnits * dhPerRedemption
    const discount = Math.min(maxDiscount, currentSubtotal)

    const points = Math.floor(discount / dhPerRedemption) * pointsForRedemption
    return { loyaltyDiscount: discount, pointsToRedeem: points }
  }, [loyaltyClient, loyaltyEnabled, loyaltySettings, subtotal, items, isLiquidationCart])

  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      // Try the regular per-variant barcode first (the common case)
      try {
        const variant = await productsApi.getVariantByBarcode(barcode)
        const product = products.find((p) => p.id === variant.productId)
        addItem(variant, product?.name ?? 'Product')
        playScanSuccess()
        showToast(`${t('pos.scanSuccess')}: ${product?.name ?? variant.sku}`, 'success')
        return
      } catch {
        // Not a variant barcode — fall through to the product-level barcode below
      }

      // Try the product-level barcode — scanning it shows all variants of that product
      try {
        const product = await productsApi.getByBarcode(barcode)
        setScannedProduct(product)
        playScanSuccess()
      } catch {
        playScanError()
        showToast(t('pos.scanError'), 'warning')
      }
    },
    [products, addItem, t]
  )

  const handleSelectScannedVariant = useCallback(
    (variant: ProductVariant) => {
      addItem(variant, scannedProduct?.name ?? 'Product')
      showToast(`${t('pos.scanSuccess')}: ${scannedProduct?.name ?? variant.sku} (${variant.colorName} / ${variant.sizeValue})`, 'success')
    },
    [addItem, scannedProduct, t]
  )

  const refreshClient = async (clientId: number) => {
    try {
      const updated = await clientsApi.getById(clientId)
      setLoyaltyClient(updated)
    } catch {}
  }

  const handleClientFound = (client: Client) => {
    setLoyaltyClient(client)
    setLoyaltyEnabled(true)
    setShowClientLookup(false)
  }

  const handleNewClient = (phone: string) => {
    setRegistrationPhone(phone)
    setShowClientLookup(false)
    setShowRegistration(true)
  }

  const handleRegistered = (client: Client) => {
    setLoyaltyClient(client)
    setLoyaltyEnabled(true)
    setShowRegistration(false)
  }

  const handleToggleLoyalty = (enabled: boolean) => {
    setLoyaltyEnabled(enabled)
    if (!enabled) {
      showToast('Fidélité désactivée - les points seront accumulés', 'info')
    } else {
      showToast('Fidélité activée - les points seront utilisés', 'success')
    }
  }

  const handleSaleComplete = () => {
    if (loyaltyClient) {
      refreshClient(loyaltyClient.id)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Header
        title={t('pos.title')}
        actions={
          <div className="flex items-center gap-3">
            {itemCount > 0 && (
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {itemCount} {t('common.items')}
              </span>
            )}
            <button
              onClick={() => setShowExchange(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              {t('pos.exchange.title')}
            </button>
            <button
              onClick={() => loyaltyClient ? setLoyaltyClient(null) : setShowClientLookup(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                loyaltyClient
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              {loyaltyClient ? loyaltyClient.name : t('pos.loyalty')}
            </button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[40%] p-4 overflow-auto bg-white border-r border-slate-200">
          <div className="mb-4">
            <ProductSearch ref={productSearchRef} onSearch={searchProducts} onBarcodeScan={handleBarcodeScan} />
          </div>
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">{t('pos.loadingProducts')}</div>
          ) : (
            <ProductGrid variants={variants} />
          )}
        </div>

        <div className="w-[60%] bg-slate-50 flex flex-col">
          {loyaltyClient && (
            <div className="p-4 bg-white border-b border-slate-200">
              <LoyaltyDisplay
                client={loyaltyClient}
                onRemove={() => {
                  setLoyaltyClient(null)
                  setLoyaltyEnabled(true)
                }}
                loyaltyEnabled={loyaltyEnabled}
                onToggleLoyalty={handleToggleLoyalty}
                isLiquidationCart={isLiquidationCart}
                loyaltySettings={loyaltySettings}
              />
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            <Cart
              onCheckout={() => setShowCheckout(true)}
              loyaltyClient={loyaltyClient}
              loyaltyEnabled={loyaltyEnabled}
              loyaltyDiscount={loyaltyDiscount}
              pointsToRedeem={pointsToRedeem}
              loyaltySettings={loyaltySettings}
            />
          </div>
        </div>
      </div>

      {showExchange && (
        <ExchangeDialog
          onClose={() => setShowExchange(false)}
          onReadyForCheckout={() => setShowCheckout(true)}
        />
      )}

      {showCheckout && (
        <CheckoutDialog
          onClose={() => setShowCheckout(false)}
          loyaltyClient={loyaltyClient}
          loyaltyEnabled={loyaltyEnabled}
          loyaltyDiscount={loyaltyDiscount}
          pointsToRedeem={pointsToRedeem}
          onSaleComplete={handleSaleComplete}
        />
      )}

      {showClientLookup && (
        <ClientLookup
          onClientFound={handleClientFound}
          onNewClient={handleNewClient}
          onClose={() => setShowClientLookup(false)}
        />
      )}

      {showRegistration && (
        <ClientRegistration
          onRegistered={handleRegistered}
          onCancel={() => setShowRegistration(false)}
          initialPhone={registrationPhone}
        />
      )}

      {scannedProduct && (
        <ProductVariantsModal
          product={scannedProduct}
          onClose={() => setScannedProduct(null)}
          onSelectVariant={handleSelectScannedVariant}
        />
      )}

      {showCashDrawer && <CashDrawerModal onClose={() => setShowCashDrawer(false)} />}
    </div>
  )
}
