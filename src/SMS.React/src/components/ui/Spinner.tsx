import { cn } from './cn'

/**
 * The one spinner.
 *
 * Replaces 37 inline copies of
 *   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
 * scattered across the pages, plus the old shared/LoadingSpinner which
 * hardcoded the English string "Loading..." into a French-only app.
 *
 * Two arcs rather than one: a faint full ring plus a bright partial arc reads
 * as deliberate at any size, where a single spinning border-bottom reads as a
 * default.
 */

const SIZES = {
  xs: 'h-3.5 w-3.5 border-[1.5px]',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-9 w-9 border-[3px]',
} as const

export interface SpinnerProps {
  size?: keyof typeof SIZES
  /** Defaults to the section accent. */
  tone?: 'accent' | 'current' | 'muted'
  className?: string
  label?: string
}

export function Spinner({ size = 'md', tone = 'accent', className, label }: SpinnerProps) {
  const color =
    tone === 'accent'
      ? 'border-t-[var(--accent)]'
      : tone === 'muted'
        ? 'border-t-[var(--fg-subtle)]'
        : 'border-t-current'

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label ?? 'Chargement'}
      className={cn('inline-flex items-center justify-center', className)}
    >
      <span
        className={cn(
          'animate-spin rounded-full border-[color-mix(in_oklab,currentColor_14%,transparent)]',
          SIZES[size],
          color
        )}
      />
    </span>
  )
}
