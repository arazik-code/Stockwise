import { type ComponentType, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { AlertCircle, Inbox, RotateCw, SearchX, WifiOff } from 'lucide-react'
import { cn } from './cn'
import { Button } from './Button'
import { listItem } from '../../design/variants'

/**
 * Loading, empty and error states.
 *
 * The current app has four different loading treatments, only four skeletons
 * total, empty states ranging from polished down to a bare
 * `<td colSpan={9}>Aucune donnée</td>`, and essentially no error states at all -
 * most failures are swallowed by `.catch(() => [])` and render as an empty
 * screen with no explanation.
 *
 * The contract requires all three states on every list. These are them.
 */

/* ══ Skeleton ═══════════════════════════════════════════════════════════════
 *
 * Rule: a skeleton must be LAYOUT-IDENTICAL to what it replaces - same
 * heights, same gaps. A skeleton of the wrong size produces a jump on load
 * that reads worse than having no skeleton at all.
 */

export interface SkeletonProps {
  variant?: 'text' | 'rect' | 'circle'
  className?: string
  /** Vary widths slightly so a stack of lines does not look like a barcode. */
  width?: string
}

export function Skeleton({ variant = 'rect', className, width }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      style={width ? { width } : undefined}
      className={cn(
        'block bg-[color-mix(in_oklab,var(--fg)_8%,transparent)] skeleton-shimmer',
        variant === 'text' && 'h-3.5 rounded-inset',
        variant === 'rect' && 'rounded-inset',
        variant === 'circle' && 'rounded-chip aspect-square',
        className
      )}
    />
  )
}

/** Text block with naturally uneven line lengths. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ['100%', '92%', '96%', '78%', '88%']
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} variant="text" width={widths[i % widths.length]} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="surface-glass overflow-hidden" role="status" aria-label="Chargement">
      <div className="flex items-center gap-4 border-b border-border px-density py-3">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} variant="text" className="flex-1" width={i === 0 ? '18%' : undefined} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex h-row items-center gap-4 border-b border-border/40 px-density">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} variant="text" className="flex-1" width={c === 0 ? '22%' : undefined} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonCards({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)} role="status" aria-label="Chargement">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="surface-glass p-5">
          <Skeleton variant="circle" className="h-9" />
          <Skeleton variant="text" className="mt-4" width="45%" />
          <Skeleton className="mt-2 h-7" width="65%" />
          <Skeleton variant="text" className="mt-2" width="80%" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" role="status" aria-label="Chargement">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="surface-glass p-4">
          <Skeleton variant="text" width="55%" />
          <Skeleton className="mt-3 h-8" width="70%" />
          <Skeleton variant="text" className="mt-2" width="40%" />
        </div>
      ))}
    </div>
  )
}

/* ══ Empty ══════════════════════════════════════════════════════════════════ */

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  /** Use the search variant when a filter is active - the fix differs. */
  variant?: 'default' | 'search'
  className?: string
  compact?: boolean
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
  className,
  compact,
}: EmptyStateProps) {
  const Icon = icon ?? (variant === 'search' ? SearchX : Inbox)
  return (
    <motion.div
      variants={listItem}
      initial="initial"
      animate="animate"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-10' : 'px-6 py-16',
        className
      )}
    >
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-chip bg-[var(--accent-soft)] text-[var(--accent)]">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-fg">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-fg-subtle">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  )
}

/* ══ Error ══════════════════════════════════════════════════════════════════ */

export interface ErrorStateProps {
  title?: ReactNode
  detail?: ReactNode
  onRetry?: () => void
  retrying?: boolean
  /** Network failures get a different icon and wording from server errors. */
  variant?: 'error' | 'offline'
  className?: string
  compact?: boolean
}

export function ErrorState({
  title,
  detail,
  onRetry,
  retrying,
  variant = 'error',
  className,
  compact,
}: ErrorStateProps) {
  const Icon = variant === 'offline' ? WifiOff : AlertCircle
  const heading =
    title ?? (variant === 'offline' ? 'Connexion indisponible' : 'Impossible de charger les données')

  return (
    <div
      role="alert"
      data-tone={variant === 'offline' ? 'caution' : 'negative'}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-10' : 'px-6 py-16',
        className
      )}
    >
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-chip bg-[var(--tone-soft)] text-[var(--tone)]">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-fg">{heading}</p>
      {detail && <p className="mt-1.5 max-w-md text-sm text-fg-subtle">{detail}</p>}
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-5"
          onClick={onRetry}
          loading={retrying}
          icon={<RotateCw className="h-3.5 w-3.5" />}
        >
          Réessayer
        </Button>
      )}
    </div>
  )
}

/** Inline error banner, for form-level and section-level failures. */
export function ErrorBanner({
  children,
  onRetry,
  className,
}: {
  children: ReactNode
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      data-tone="negative"
      className={cn(
        'flex items-start gap-3 rounded-card border border-[color-mix(in_oklab,var(--tone)_28%,transparent)]',
        'bg-[var(--tone-soft)] px-4 py-3 text-sm text-[var(--tone-ink)]',
        className
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-inset px-2 py-0.5 text-xs font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
        >
          Réessayer
        </button>
      )}
    </div>
  )
}
