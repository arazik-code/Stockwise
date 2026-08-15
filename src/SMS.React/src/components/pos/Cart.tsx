import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { ImageOff, Minus, Plus, ShoppingCart, X } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { formatCurrency } from '../../utils/format'
import {
  Badge, Button, CountUp, EmptyState, IconButton, KeyHint, cn, useDataPulse,
} from '../ui'
import { listItem } from '../../design/variants'
import type { Client, LoyaltySettingsConfig } from '../../api/clients'

interface CartProps {
  onCheckout: () => void
  loyaltyClient: Client | null
  loyaltyEnabled: boolean
  loyaltyDiscount: number
  pointsToRedeem: number
  loyaltySettings: LoyaltySettingsConfig
}

export default function Cart({ onCheckout, loyaltyClient, loyaltyEnabled, loyaltyDiscount, pointsToRedeem, loyaltySettings }: CartProps) {
  const { t } = useTranslation()
  const { items, subtotal, tax, total, taxRate, removeItem, updateQuantity, clearCart } = useCartStore()

  const finalTotal = total() - loyaltyDiscount
  const rate = loyaltyClient?.loyaltyRate ?? loyaltySettings.newClientRate
  const discountedSubtotal = subtotal() - loyaltyDiscount
  const pointsToEarn = loyaltyEnabled && loyaltySettings.enabled
    ? Math.floor(discountedSubtotal * rate / 100)
    : Math.floor(discountedSubtotal * loyaltySettings.newClientRate / 100)

  return (
    <div className="flex h-full flex-col bg-canvas">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-semibold tracking-tight text-fg">{t('pos.cart')}</h2>
          {items.length > 0 && (
            <Badge tone="info" size="md">
              <span className="num font-semibold">
                {items.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            </Badge>
          )}
        </div>
        {items.length > 0 && (
          <Button variant="danger-ghost" size="sm" onClick={clearCart}>
            {t('pos.clear')}
          </Button>
        )}
      </div>

      {/* Cart items. Solid rows, never glass - this list scrolls (see PosPage). */}
      <div className="flex-1 overflow-auto p-4">
        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title={t('pos.cartEmpty')}
            description="Scannez un article ou appuyez sur Inser pour rechercher."
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false} mode="popLayout">
              {items.map((item, i) => (
                <motion.div
                  key={item.productVariantId}
                  layout
                  custom={i}
                  variants={listItem}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  data-tone={item.isLiquidation ? 'caution' : undefined}
                  className={cn(
                    'rounded-card border p-4 shadow-e1',
                    item.isLiquidation
                      ? 'border-[color-mix(in_oklab,var(--tone)_38%,transparent)] bg-[var(--tone-soft)]'
                      : 'border-border bg-surface'
                  )}
                >
                  {/* Thumbnail + name + remove. The thumbnail is what makes this a
                      confirmation, not just a receipt line: on a fast scan burst the
                      cashier can catch "wrong size grabbed" at a glance instead of
                      having to parse text, the same way the product grid tile reads. */}
                  <div className="mb-2 flex items-start gap-3">
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-field border border-border bg-surface-2">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageOff className="h-5 w-5 text-fg-subtle" aria-hidden="true" />
                      )}
                      {item.colorHexCode && (
                        <span
                          className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-chip border border-[var(--surface-1)] shadow-e1"
                          style={{ backgroundColor: item.colorHexCode }}
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-base font-semibold text-fg">{item.name}</span>
                        {item.isLiquidation && (
                          <Badge tone="caution" size="xs" className="uppercase">
                            Liquidation
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-sm text-fg-subtle">
                        {item.colorName && <span className="font-medium">{item.colorName}</span>}
                        {item.colorName && item.sizeValue && <span aria-hidden="true">·</span>}
                        {item.sizeValue && <span className="num font-medium">{item.sizeValue}</span>}
                      </div>
                      {item.sku && <div className="num mt-0.5 text-xs text-fg-subtle">{item.sku}</div>}
                    </div>

                    <IconButton
                      icon={<X className="h-4 w-4" />}
                      label={t('common.delete')}
                      variant="danger-ghost"
                      size="sm"
                      onClick={() => removeItem(item.productVariantId)}
                      className="-mr-1 -mt-1 shrink-0"
                    />
                  </div>

                  {/* Quantity + price */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <IconButton
                        icon={<Minus className="h-4 w-4" />}
                        label="-"
                        variant="outline"
                        size="density"
                        onClick={() => updateQuantity(item.productVariantId, Math.max(1, item.quantity - 1))}
                      />
                      <span className="num w-10 text-center text-xl font-bold text-fg">
                        {item.quantity}
                      </span>
                      <IconButton
                        icon={<Plus className="h-4 w-4" />}
                        label="+"
                        variant="outline"
                        size="density"
                        onClick={() => updateQuantity(item.productVariantId, item.quantity + 1)}
                      />
                    </div>
                    <div className="text-right">
                      <div className="num text-xl font-bold text-fg">{formatCurrency(item.lineTotal)}</div>
                      {item.quantity > 1 && (
                        <div className="num text-xs text-fg-subtle">
                          {formatCurrency(item.unitPrice)} × {item.quantity}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer summary */}
      <div className="space-y-3 border-t border-border bg-surface p-5">
        <div className="flex items-baseline justify-between gap-3 text-base">
          <span className="text-fg-muted">{t('common.subtotal')}</span>
          <span className="num font-semibold text-fg">{formatCurrency(subtotal())}</span>
        </div>

        {loyaltyClient && loyaltyEnabled && pointsToRedeem > 0 && (
          <div data-tone="positive" className="flex items-baseline justify-between gap-3 text-base">
            <span className="font-medium text-[var(--tone-ink)]">Remise fidélité</span>
            <span className="num font-bold text-[var(--tone-ink)]">-{formatCurrency(loyaltyDiscount)}</span>
          </div>
        )}

        <div className="flex items-baseline justify-between gap-3 text-base">
          <span className="text-fg-muted">
            {t('common.tax')} (<span className="num">{(taxRate * 100).toFixed(0)}</span>%)
          </span>
          <span className="num font-semibold text-fg">{formatCurrency(tax())}</span>
        </div>

        <CartTotal label={t('common.total')} value={finalTotal > 0 ? finalTotal : 0} />

        {loyaltyClient && (
          <div
            data-tone="positive"
            className={cn(
              'rounded-field p-3 text-sm font-medium',
              loyaltyEnabled
                ? 'bg-[var(--tone-soft)] text-[var(--tone-ink)]'
                : 'bg-sunken text-fg-muted'
            )}
          >
            {loyaltyEnabled ? (
              <>
                {pointsToRedeem > 0 && (
                  <span>-<span className="num">{pointsToRedeem}</span> points utilisés · </span>
                )}
                +<span className="num">{pointsToEarn}</span> points gagnés
              </>
            ) : (
              <span>
                +<span className="num">{pointsToEarn}</span> points à gagner (fidélité désactivée)
              </span>
            )}
          </div>
        )}

        <Button
          variant="solid"
          size="density"
          fullWidth
          onClick={onCheckout}
          disabled={items.length === 0}
          className="mt-2 text-base font-bold"
        >
          {t('pos.checkout')} ·{' '}
          <span className="num">{formatCurrency(finalTotal > 0 ? finalTotal : 0)}</span>
        </Button>

        {items.length > 0 && (
          <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-fg-subtle">
            <span className="inline-flex items-center gap-1.5">
              <KeyHint keys={['Entrée']} /> valider
            </span>
            <span className="inline-flex items-center gap-1.5">
              <KeyHint keys={['Esc']} /> vider
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The total.
 *
 * Presentational only - it takes the already-computed figure as a prop, so no
 * hook, derived value or handler moves out of Cart above its `return (`.
 * useDataPulse lives here because the glow is a property of how the total is
 * DISPLAYED, not of how it is calculated. The pulse is throttled
 * (PULSE_THROTTLE_MS): a fast scan burst must read as a rhythm, not a strobe.
 */
function CartTotal({ label, value }: { label: string; value: number }) {
  const pulsing = useDataPulse(value)

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-card border border-border bg-surface-2 px-4 py-3',
        'transition-shadow duration-base ease-out-soft',
        pulsing && 'shadow-glow'
      )}
    >
      <span className="text-sm font-semibold uppercase tracking-wide text-fg-muted">{label}</span>
      <CountUp
        value={value}
        format={formatCurrency}
        className="text-2xl font-bold tracking-tight text-fg"
      />
    </div>
  )
}
