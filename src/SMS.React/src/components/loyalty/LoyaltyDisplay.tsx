import { useTranslation } from 'react-i18next'
import { AlertTriangle, Star, User, X } from 'lucide-react'
import { formatCurrency } from '../../utils/format'
import type { Client, LoyaltySettingsConfig } from '../../api/clients'
import { IconButton, Switch } from '../ui'

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
    <div
      data-tone={isLiquidationCart ? 'caution' : loyaltyEnabled ? 'positive' : 'muted'}
      className="rounded-card border border-[color-mix(in_oklab,var(--tone)_28%,transparent)] bg-[var(--tone-soft)] p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-chip bg-[color-mix(in_oklab,var(--tone)_16%,transparent)] text-[var(--tone)]">
            <User className="h-5 w-5" />
          </span>
          <div>
            <p className="text-base font-bold text-[var(--tone-ink)]">{client.name}</p>
            <p className="num text-sm text-[var(--tone)]">{client.phone}</p>
          </div>
        </div>
        <IconButton
          icon={<X className="h-4 w-4" />}
          label={t('common.close')}
          variant="ghost"
          size="xs"
          onClick={onRemove}
          className="text-[var(--tone)] hover:text-[var(--tone-ink)]"
        />
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-[var(--tone)]" fill="currentColor" />
          <span className="num text-lg font-bold text-[var(--tone-ink)]">{client.totalPoints}</span>
          <span className="text-sm text-[var(--tone)]">{t('pos.points')}</span>
        </div>

        {potentialDiscount > 0 && !isLiquidationCart && (
          <div className="num rounded-chip bg-[color-mix(in_oklab,var(--tone)_14%,transparent)] px-2.5 py-1 text-sm text-[var(--tone-ink)]">
            {formatCurrency(potentialDiscount)} {t('pos.available')}
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-dashed border-[color-mix(in_oklab,var(--tone)_24%,transparent)] pt-3">
        {isLiquidationCart ? (
          <div className="flex items-center gap-2 text-[var(--tone-ink)]">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Liquidation — fidélité non applicable</span>
          </div>
        ) : (
          <>
            <Switch
              checked={loyaltyEnabled}
              onChange={(e) => onToggleLoyalty(e.target.checked)}
              label={
                <span className="text-sm font-medium text-[var(--tone-ink)]">
                  {loyaltyEnabled ? 'Utiliser les points' : 'Accumuler les points'}
                </span>
              }
            />
            <p className="mt-1 text-xs text-fg-subtle">
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
          className="mt-2 text-sm font-medium text-[var(--tone)] transition-colors hover:text-[var(--tone-ink)]"
        >
          {t('pos.viewDetails')}
        </button>
      )}
    </div>
  )
}
