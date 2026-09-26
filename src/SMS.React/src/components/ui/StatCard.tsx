import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from './cn'
import { Skeleton } from './States'
import { SPRING, PULSE_THROTTLE_MS, PULSE_DURATION_MS } from '../../design/motion'
import type { Tone } from '../../design/status'

/**
 * KPI tile.
 *
 * Consolidates the summary rows currently hand-built on Dashboard,
 * OnlineDashboard, Sales, Invoices, Reports, Refunds and AdminOverview - seven
 * near-identical implementations.
 */

/**
 * Animated number.
 *
 * Count-up belongs on stat tiles only, never in a table: 2,957 springs would
 * destroy the frame budget for an effect nobody looks at.
 *
 * Triggers unconditionally on mount/value-change rather than gating on
 * `useInView` - a stat tile is never off-screen at the point a user can read
 * it, and gating a REQUIRED data value behind "did the intersection
 * observer happen to fire" means the number can get stuck at its initial 0
 * forever in any environment where that observer doesn't run on the usual
 * schedule (a backgrounded/prerendered tab, some webview hosts). An
 * animation is a nice-to-have; the number itself is not optional.
 *
 * `tabular-nums` (the `num` utility) is not optional here - with proportional
 * figures every digit change shifts the layout and the number visibly wobbles
 * for the whole animation.
 */
export function CountUp({
  value,
  format,
  className,
}: {
  value: number
  format?: (v: number) => string
  className?: string
}) {
  const reduce = useReducedMotion()
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, SPRING.float)
  const [display, setDisplay] = useState(reduce ? value : 0)

  useEffect(() => {
    if (reduce) {
      setDisplay(value)
      return
    }
    motionValue.set(value)
  }, [value, motionValue, reduce])

  useEffect(() => {
    if (reduce) return
    return spring.on('change', (v) => setDisplay(v))
  }, [spring, reduce])

  return (
    <span className={cn('num', className)}>
      {format ? format(display) : Math.round(display).toLocaleString('fr-FR')}
    </span>
  )
}

/**
 * True for a moment after `value` changes, throttled.
 *
 * Drives the live-data glow on SignalR-backed figures. The throttle is
 * load-bearing: a burst of inventory updates during a busy hour would
 * otherwise turn the screen into a strobe.
 */
export function useDataPulse(value: unknown): boolean {
  const [pulsing, setPulsing] = useState(false)
  const lastPulse = useRef(0)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const now = Date.now()
    if (now - lastPulse.current < PULSE_THROTTLE_MS) return
    lastPulse.current = now
    setPulsing(true)
    const t = setTimeout(() => setPulsing(false), PULSE_DURATION_MS)
    return () => clearTimeout(t)
  }, [value])

  return pulsing
}

export interface StatCardProps {
  label: ReactNode
  /** Pre-formatted display value. Optional when `numericValue` is supplied. */
  value?: ReactNode
  /** When set, the value counts up instead of appearing. */
  numericValue?: number
  format?: (v: number) => string
  sub?: ReactNode
  icon?: ComponentType<{ className?: string }>
  tone?: Tone | 'accent'
  /** Percentage change. Positive is not always good - see `invertDelta`. */
  delta?: number
  /** For metrics where down is good, e.g. refunds or overdue invoices. */
  invertDelta?: boolean
  loading?: boolean
  /** Glow briefly when the value changes (SignalR-backed figures). */
  live?: boolean
  onClick?: () => void
  className?: string
}

export function StatCard({
  label,
  value,
  numericValue,
  format,
  sub,
  icon: Icon,
  tone = 'accent',
  delta,
  invertDelta,
  loading,
  live,
  onClick,
  className,
}: StatCardProps) {
  const pulsing = useDataPulse(live ? value : null)
  const good = delta === undefined ? null : invertDelta ? delta < 0 : delta > 0

  return (
    <motion.div
      data-stat-card
      data-tone={tone === 'accent' ? undefined : tone}
      onClick={onClick}
      whileHover={onClick ? { y: -3 } : undefined}
      whileTap={onClick ? { scale: 0.995 } : undefined}
      transition={SPRING.float}
      className={cn(
        'surface-glass relative overflow-hidden p-4',
        onClick && 'cursor-pointer hover:shadow-e3',
        'transition-shadow duration-base ease-out-soft',
        pulsing && 'shadow-glow',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{label}</p>
        {Icon && (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-field',
              tone === 'accent'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'bg-[var(--tone-soft)] text-[var(--tone)]'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className="mt-2.5 h-7" width="60%" />
      ) : (
        <p className="mt-1.5 text-2xl font-bold tracking-tight text-fg num">
          {numericValue !== undefined ? <CountUp value={numericValue} format={format} /> : value}
        </p>
      )}

      <div className="mt-1 flex items-center gap-2">
        {delta !== undefined && !loading && (
          <span
            data-tone={good ? 'positive' : 'negative'}
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[var(--tone)]"
          >
            {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {sub && <p className="truncate text-[11px] text-fg-subtle">{sub}</p>}
      </div>
    </motion.div>
  )
}

export interface ProgressBarProps {
  /** 0-100. */
  value: number
  tone?: Tone | 'accent'
  size?: 'sm' | 'md'
  indeterminate?: boolean
  label?: ReactNode
  showValue?: boolean
  className?: string
}

export function ProgressBar({
  value,
  tone = 'accent',
  size = 'md',
  indeterminate,
  label,
  showValue,
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div data-tone={tone === 'accent' ? undefined : tone} className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          {label && <span className="text-xs text-fg-muted">{label}</span>}
          {showValue && <span className="num text-xs font-medium text-fg">{pct.toFixed(0)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          'w-full overflow-hidden rounded-chip bg-sunken',
          size === 'sm' ? 'h-1.5' : 'h-2.5'
        )}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: indeterminate ? '40%' : `${pct}%` }}
          transition={SPRING.float}
          className={cn(
            'h-full rounded-chip',
            tone === 'accent' ? 'bg-[var(--accent)]' : 'bg-[var(--tone)]',
            indeterminate && 'animate-pulse'
          )}
        />
      </div>
    </div>
  )
}
