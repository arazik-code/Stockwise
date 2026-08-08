import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { cn } from './cn'
import { StatusDot } from './Badge'
import {
  getStatus,
  transitionDirection,
  type StatusDomain,
} from '../../design/status'
import { statusLabel } from '../../design/variants'
import { DUR, EASE } from '../../design/motion'

/**
 * StatusBadge - "the switch of the status of any element".
 *
 * Looks a value up in the registry (src/design/status.ts) and renders it with
 * the right tone, icon and label. When the value CHANGES it animates, and the
 * animation carries meaning rather than just being movement:
 *
 *   advancing along the lifecycle  ->  flashes positive (green)
 *   falling back                   ->  flashes caution  (amber)
 *   entering a terminal state      ->  flashes the section accent
 *
 * Direction comes from each status's `rank`, so Pending -> Delivered pulses
 * green while Delivered -> Refunded pulses amber, from one component with no
 * per-call-site configuration.
 *
 * `layout` on the wrapper is essential, not decorative: French status labels
 * vary enormously in width ("Prête à expédier" -> "Livrée"), and without it
 * the badge snaps to its new size while the label is still crossfading.
 */

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref.current
}

const SIZES = {
  xs: 'h-5 px-1.5 text-[10px] gap-1',
  sm: 'h-6 px-2 text-[11px] gap-1',
  md: 'h-7 px-2.5 text-xs gap-1.5',
} as const

export interface StatusBadgeProps {
  domain: StatusDomain
  value: string | null | undefined
  size?: keyof typeof SIZES
  /** Show the registry icon. */
  showIcon?: boolean
  /** Show a leading dot, pulsing for `live` states. */
  showDot?: boolean
  /** Set false inside long tables where dozens change at once. */
  animate?: boolean
  className?: string
}

export function StatusBadge({
  domain,
  value,
  size = 'sm',
  showIcon = true,
  showDot = false,
  animate = true,
  className,
}: StatusBadgeProps) {
  const { t } = useTranslation()
  const def = getStatus(domain, value)
  const prev = usePrevious(value)
  const reduce = useReducedMotion() ?? false

  const changed = animate && prev !== undefined && prev !== value
  const direction = value ? transitionDirection(domain, prev ?? undefined, value) : 'neutral'

  const flash =
    direction === 'forward'
      ? 'var(--positive)'
      : direction === 'backward'
        ? 'var(--caution)'
        : 'var(--accent, var(--info))'

  const Icon = def.icon
  const label = def.labelKey ? t(def.labelKey) : (def.label ?? value ?? '—')

  return (
    <motion.span
      layout
      data-tone={def.tone}
      className={cn(
        'relative inline-flex items-center rounded-chip font-medium whitespace-nowrap align-middle',
        'bg-[var(--tone-soft)] text-[var(--tone-ink)]',
        'border border-[color-mix(in_oklab,var(--tone)_22%,transparent)]',
        SIZES[size],
        className
      )}
      transition={{ duration: DUR.base, ease: EASE.outSoft }}
    >
      {showDot && <StatusDot tone={def.tone} size="sm" pulse={def.live} />}

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value ?? '__empty'}
          variants={statusLabel(reduce)}
          initial="initial"
          animate="animate"
          exit="exit"
          className="inline-flex items-center gap-1"
        >
          {showIcon && Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
          {label}
        </motion.span>
      </AnimatePresence>

      {/*
        The ring flash. Reduced motion keeps the colour signal but drops the
        expanding geometry - feedback preserved, movement removed.
      */}
      {changed && !reduce && (
        <motion.span
          key={`ring-${value}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-chip"
          initial={{ boxShadow: `0 0 0 0 ${flash}`, opacity: 0.85 }}
          animate={{ boxShadow: '0 0 0 9px rgba(0,0,0,0)', opacity: 0 }}
          transition={{ duration: 0.52, ease: EASE.outSoft }}
        />
      )}
      {changed && reduce && (
        <motion.span
          key={`flash-${value}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-chip"
          style={{ background: flash }}
          initial={{ opacity: 0.28 }}
          animate={{ opacity: 0 }}
          transition={{ duration: DUR.slow }}
        />
      )}
    </motion.span>
  )
}
