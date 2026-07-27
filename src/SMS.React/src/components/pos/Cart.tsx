import { useTranslation } from 'react-i18next'
import { useCartStore } from '../../store/cartStore'
import { formatCurrency } from '../../utils/format'
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900">{t('pos.cart')}</h2>
          {items.length > 0 && (
            <span className="text-sm font-bold text-white bg-blue-600 px-2.5 py-0.5 rounded-full">
              {items.reduce((sum, i) => sum + i.quantity, 0)}
            </span>
          )}
        </div>
        {items.length > 0 && (
          <button
            onClick={clearCart}
            className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            {t('pos.clear')}
          </button>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-auto p-5 space-y-3">
        {items.length === 0 ? (
          <div className="text-center text-slate-400 py-20">
            <svg className="w-16 h-16 mx-auto mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-base font-medium">{t('pos.cartEmpty')}</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.productVariantId}
              className={`rounded-xl p-4 border-2 ${
                item.isLiquidation
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-white border-slate-100'
              }`}
            >
              {/* Product Name + Remove */}
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900 truncate">{item.name}</span>
                    {item.isLiquidation && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded uppercase">
                        Liquidation
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
                    {item.colorName && <span className="font-medium">{item.colorName}</span>}
                    {item.colorName && item.sizeValue && <span>·</span>}
                    {item.sizeValue && <span className="font-medium">{item.sizeValue}</span>}
                  </div>
                </div>
                <button
                  onClick={() => removeItem(item.productVariantId)}
                  className="text-slate-300 hover:text-red-500 transition-colors ml-2 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Quantity + Price */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateQuantity(item.productVariantId, Math.max(1, item.quantity - 1))}
                    className="w-9 h-9 rounded-lg border-2 border-slate-200 bg-white hover:bg-slate-50 text-lg font-bold text-slate-600 flex items-center justify-center transition-colors"
                  >
                    -
                  </button>
                  <span className="text-xl font-bold text-slate-900 w-10 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.productVariantId, item.quantity + 1)}
                    className="w-9 h-9 rounded-lg border-2 border-slate-200 bg-white hover:bg-slate-50 text-lg font-bold text-slate-600 flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-slate-900">{formatCurrency(item.lineTotal)}</div>
                  {item.quantity > 1 && (
                    <div className="text-xs text-slate-400">{formatCurrency(item.unitPrice)} × {item.quantity}</div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Summary */}
      <div className="border-t-2 border-slate-100 p-6 space-y-3 bg-white">
        <div className="flex justify-between text-base">
          <span className="text-slate-500">{t('common.subtotal')}</span>
          <span className="font-semibold text-slate-900">{formatCurrency(subtotal())}</span>
        </div>

        {loyaltyClient && loyaltyEnabled && pointsToRedeem > 0 && (
          <div className="flex justify-between text-base">
            <span className="text-emerald-600 font-medium">Remise fidélité</span>
            <span className="text-emerald-600 font-bold">-{formatCurrency(loyaltyDiscount)}</span>
          </div>
        )}

        <div className="flex justify-between text-base">
          <span className="text-slate-500">{t('common.tax')} ({(taxRate * 100).toFixed(0)}%)</span>
          <span className="font-semibold text-slate-900">{formatCurrency(tax())}</span>
        </div>

        <div className="flex justify-between text-xl font-bold border-t-2 border-slate-100 pt-4 mt-3">
          <span className="text-slate-900">{t('common.total')}</span>
          <span className="text-slate-900">{formatCurrency(finalTotal > 0 ? finalTotal : 0)}</span>
        </div>

        {loyaltyClient && (
          <div className={`text-sm font-medium p-3 rounded-lg ${loyaltyEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {loyaltyEnabled ? (
              <>
                {pointsToRedeem > 0 && <span>-{pointsToRedeem} points utilisés · </span>}
                +{pointsToEarn} points gagnés
              </>
            ) : (
              <span>+{pointsToEarn} points à gagner (fidélité désactivée)</span>
            )}
          </div>
        )}

        <button
          onClick={onCheckout}
          disabled={items.length === 0}
          className="w-full py-4 text-lg font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {t('pos.checkout')} · {formatCurrency(finalTotal > 0 ? finalTotal : 0)}
        </button>

        {items.length > 0 && (
          <p className="text-xs text-slate-400 text-center mt-2">
            Entrée pour valider · Esc pour vider
          </p>
        )}
      </div>
    </div>
  )
}
