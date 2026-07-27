import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../utils/format'
import type { Client, LoyaltySettingsConfig } from '../../api/clients'

interface LoyaltyDisplayProps {
  client: Client
  onRemove: () => void
  onViewDetails?: () => void
  loyaltyEnabled: boolean
  onToggleLoyalty: (enabled: boolean) => void
  isLiquidationCart?: boolean
  loyaltySettings: LoyaltySettingsConfig
}

export default function LoyaltyDisplay({ client, onRemove, onViewDetails, loyaltyEnabled, onToggleLoyalty, isLiquidationCart, loyaltySettings }: LoyaltyDisplayProps) {
  const { t } = useTranslation()
  const { pointsForRedemption, dhPerRedemption } = loyaltySettings
  const maxRedeemableUnits = Math.floor(client.totalPoints / pointsForRedemption)
  const potentialDiscount = maxRedeemableUnits * dhPerRedemption

  return (
    <div className={`border-2 rounded-xl p-4 ${
      isLiquidationCart
        ? 'bg-amber-50 border-amber-200'
        : loyaltyEnabled
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-slate-50 border-slate-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isLiquidationCart ? 'bg-amber-100' : loyaltyEnabled ? 'bg-emerald-100' : 'bg-slate-100'
          }`}>
            <svg className={`w-5 h-5 ${
              isLiquidationCart ? 'text-amber-600' : loyaltyEnabled ? 'text-emerald-600' : 'text-slate-400'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className={`text-base font-bold ${isLiquidationCart ? 'text-amber-900' : loyaltyEnabled ? 'text-emerald-900' : 'text-slate-700'}`}>
              {client.name}
            </p>
            <p className={`text-sm ${isLiquidationCart ? 'text-amber-600' : loyaltyEnabled ? 'text-emerald-600' : 'text-slate-500'}`}>
              {client.phone}
            </p>
          </div>
        </div>
        <button onClick={onRemove} className={`${isLiquidationCart ? 'text-amber-400 hover:text-amber-600' : loyaltyEnabled ? 'text-emerald-400 hover:text-emerald-600' : 'text-slate-400 hover:text-slate-600'} transition-colors`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <svg className={`w-4 h-4 ${isLiquidationCart ? 'text-amber-500' : loyaltyEnabled ? 'text-emerald-500' : 'text-slate-400'}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span className={`text-lg font-bold ${isLiquidationCart ? 'text-amber-900' : loyaltyEnabled ? 'text-emerald-900' : 'text-slate-700'}`}>
            {client.totalPoints}
          </span>
          <span className={`text-sm ${isLiquidationCart ? 'text-amber-600' : loyaltyEnabled ? 'text-emerald-600' : 'text-slate-500'}`}>
            {t('pos.points')}
          </span>
        </div>

        {potentialDiscount > 0 && !isLiquidationCart && (
          <div className={`text-sm px-2.5 py-1 rounded-lg ${loyaltyEnabled ? 'text-emerald-700 bg-emerald-100' : 'text-slate-600 bg-slate-100'}`}>
            {formatCurrency(potentialDiscount)} {t('pos.available')}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
        {isLiquidationCart ? (
          <div className="flex items-center gap-2 text-amber-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm font-medium">Liquidation — fidélité non applicable</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${loyaltyEnabled ? 'text-emerald-700' : 'text-slate-600'}`}>
                {loyaltyEnabled ? 'Utiliser les points' : 'Accumuler les points'}
              </span>
              <button
                onClick={() => onToggleLoyalty(!loyaltyEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  loyaltyEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow ${
                    loyaltyEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {loyaltyEnabled
                ? 'Les points seront déduisés du total'
                : 'Les points seront accumulés pour plus tard'}
            </p>
          </>
        )}
      </div>

      {onViewDetails && (
        <button
          onClick={onViewDetails}
          className={`mt-2 text-sm font-medium transition-colors ${isLiquidationCart ? 'text-amber-600 hover:text-amber-800' : loyaltyEnabled ? 'text-emerald-600 hover:text-emerald-800' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t('pos.viewDetails')}
        </button>
      )}
    </div>
  )
}
