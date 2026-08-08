import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, Repeat2, ShoppingBag, UserRound } from 'lucide-react'
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
import { formatCurrency } from '../utils/format'
import { Badge, Button, Page, Spinner, cn } from '../components/ui'
import { SPRING } from '../design/motion'
import type { Client } from '../api/clients'
import type { Product, ProductVariant } from '../types/product'

/**
 * ══ CONSOLE ARCHETYPE - GOLDEN REFERENCE ════════════════════════════════════
 *
 * Copy this for Refunds and the online confirmation queue.
 *
 * ── Why the POS is the one screen that is NOT frosted glass ─────────────────
 *
 * The rest of the app is translucent, layered and blurred. This screen
 * deliberately is not, and that is a design decision rather than a compromise.
 *
 * The POS is operated standing, at speed, sometimes with a queue waiting,
 * under retail lighting that is nothing like a desk. Translucency lowers text
 * contrast exactly when the cashier can least afford to re-read a total, and
 * backdrop-filter costs frames precisely during a barcode-scan burst, when the
 * screen most needs to keep up.
 *
 * So Console keeps the whole Luminous Depth LANGUAGE - hue-tinted shadows, the
 * gradient mesh, spring motion, success bursts - but pays for its expensive
 * feel with clarity instead of blur:
 *
 *   solid opaque surfaces        no backdrop-filter anywhere on this route
 *   data-density="touch"         60px rows, 52px controls, 1rem text
 *   glow ONLY as a state signal  cart changes, scan hits, totals - never ambient
 *
 * It ends up looking more expensive than the glass version, not less. Frosted
 * chrome on a working till reads as a demo; this reads as an instrument.
 */

// The POS grid defaults to just this category until the cashier searches by name or scans a
// barcode - keeps the default screen small and fast to scan visually for the store's actual
// walk-up items, instead of drowning them in the full shoe catalog.
const DEFAULT_VIEW_CATEGORY = 'Accessoires'

export default function PosPage() {
  const { t } = useTranslation()
  const { products, variants, loading, loadProducts, searchProducts } = useProducts()
  const [searchQuery, setSearchQuery] = useState('')
  const isAdmin = useAuthStore((s) => s.user?.role === 'Admin')
  const [showCheckout, setShowCheckout] = useState(false)
  const [showExchange, setShowExchange] = useState(false)
  const [showClientLookup, setShowClientLookup] = useState(false)
  const [showRegistration, setShowRegistration] = useState(false)
  const [showCashDrawer, setShowCashDrawer] = useState(false)
  const [showMobileCart, setShowMobileCart] = useState(false)
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null)
  const [registrationPhone, setRegistrationPhone] = useState('')
  const [loyaltyClient, setLoyaltyClient] = useState<Client | null>(null)
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true)
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettingsConfig>({
    newClientRate: 5,
    ancientClientRate: 8,
    premiumClientRate: 12,
    pointsForRedemption: 10,
    dhPerRedemption: 1.00,
    welcomePoints: 50,
    enabled: true,
  })
  const addItem = useCartStore((s) => s.addItem)
  const items = useCartStore((s) => s.items)
  const subtotal = useCartStore((s) => s.subtotal)
  const cartTotal = useCartStore((s) => s.total)
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
    if (itemCount === 0) setShowMobileCart(false)
  }, [itemCount])

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

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query)
      searchProducts(query)
    },
    [searchProducts]
  )

  const isDefaultView = searchQuery.trim().length === 0
  const displayVariants = useMemo(
    () => (isDefaultView ? variants.filter((v) => v.categoryName === DEFAULT_VIEW_CATEGORY) : variants),
    [variants, isDefaultView]
  )

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
    <Page
      section="pos"
      fill
      bare
      title={t('pos.title')}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* The item count is a live signal, so it animates on change rather
              than silently swapping - the cashier should never have to check
              whether a scan registered. */}
          <AnimatePresence mode="popLayout">
            {itemCount > 0 && (
              <motion.span
                key={itemCount}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={SPRING.snappy}
              >
                <Badge tone="info" size="md">
                  <span className="num font-semibold">{itemCount}</span>
                  &nbsp;{t('common.items')}
                </Badge>
              </motion.span>
            )}
          </AnimatePresence>

          <Button
            size="sm"
            variant="outline"
            icon={<Repeat2 className="h-4 w-4" />}
            onClick={() => setShowExchange(true)}
          >
            {t('pos.exchange.title')}
          </Button>

          <Button
            size="sm"
            variant={loyaltyClient ? 'soft' : 'outline'}
            icon={<UserRound className="h-4 w-4" />}
            onClick={() => (loyaltyClient ? setLoyaltyClient(null) : setShowClientLookup(true))}
          >
            {loyaltyClient ? loyaltyClient.name : t('pos.loyalty')}
          </Button>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Product side. Solid surface, never glass - see the note at the top. */}
        <div className="w-full overflow-auto border-border bg-surface p-4 pb-28 lg:w-[40%] lg:border-r lg:pb-4">
          <div className="mb-4">
            <ProductSearch ref={productSearchRef} onSearch={handleSearch} onBarcodeScan={handleBarcodeScan} />
          </div>
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Spinner size="lg" />
              <p className="text-sm text-fg-subtle">{t('pos.loadingProducts')}</p>
            </div>
          ) : (
            <ProductGrid variants={displayVariants} defaultView={isDefaultView} defaultViewCategory={DEFAULT_VIEW_CATEGORY} />
          )}
        </div>

        {/* Cart side. */}
        <div className="hidden flex-col bg-canvas lg:flex lg:w-[60%]">
          {loyaltyClient && (
            <div className="border-b border-border bg-surface p-4">
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

      {/* Mobile: floating "view cart" bar. The one place on this route allowed
          real blur - a single fixed element over a static backdrop. */}
      <AnimatePresence>
        {itemCount > 0 && !showMobileCart && (
          <motion.button
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={SPRING.panel}
            whileTap={{ scale: 0.985 }}
            onClick={() => setShowMobileCart(true)}
            className={cn(
              'fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-surface px-5 py-3.5 lg:hidden',
              'bg-[var(--accent)] text-[var(--accent-fg)] shadow-glow backdrop-blur-[var(--blur-1)]'
            )}
          >
            <span className="flex items-center gap-2.5 text-sm font-semibold">
              <span className="num flex h-7 w-7 items-center justify-center rounded-chip bg-[color-mix(in_oklab,var(--accent-fg)_22%,transparent)]">
                {itemCount}
              </span>
              {t('pos.cart')}
            </span>
            <span className="num text-base font-bold">{formatCurrency(Math.max(0, cartTotal() - loyaltyDiscount))}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mobile: full-screen cart sheet */}
      <AnimatePresence>
        {showMobileCart && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING.panel}
            className="fixed inset-0 z-40 flex flex-col bg-canvas lg:hidden"
          >
            <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2.5">
              <Button
                variant="ghost"
                size="sm"
                icon={<ChevronLeft className="h-5 w-5" />}
                onClick={() => setShowMobileCart(false)}
                aria-label={t('common.close')}
                className="-ml-1"
              >
                {t('pos.backToProducts')}
              </Button>
              <span className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-fg">
                <ShoppingBag className="h-4 w-4 text-fg-subtle" />
                <span className="num">{formatCurrency(Math.max(0, cartTotal() - loyaltyDiscount))}</span>
              </span>
            </div>

            {loyaltyClient && (
              <div className="border-b border-border bg-surface p-4">
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
          </motion.div>
        )}
      </AnimatePresence>

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
    </Page>
  )
}
