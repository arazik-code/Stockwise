import { type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from './cn'
import { IconButton } from './Button'

/** Pagination, Avatar, KeyHint, SectionHeader - the small shared pieces. */

export interface PaginationProps {
  page: number
  pageCount: number
  onChange: (page: number) => void
  /** Total row count, shown as context. */
  total?: number
  pageSize?: number
  className?: string
}

export function Pagination({ page, pageCount, onChange, total, pageSize, className }: PaginationProps) {
  if (pageCount <= 1) return null

  const from = pageSize ? (page - 1) * pageSize + 1 : null
  const to = pageSize && total ? Math.min(page * pageSize, total) : null

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <p className="text-xs text-fg-subtle">
        {from && to && total != null ? (
          <>
            <span className="num font-medium text-fg-muted">{from}</span>
            {'–'}
            <span className="num font-medium text-fg-muted">{to}</span> sur{' '}
            <span className="num font-medium text-fg-muted">{total.toLocaleString('fr-FR')}</span>
          </>
        ) : (
          <>
            Page <span className="num font-medium text-fg-muted">{page}</span> sur{' '}
            <span className="num font-medium text-fg-muted">{pageCount}</span>
          </>
        )}
      </p>
      <div className="flex items-center gap-1.5">
        <IconButton
          icon={<ChevronLeft className="h-4 w-4" />}
          label="Page précédente"
          variant="outline"
          size="xs"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        />
        <span className="num px-2 text-xs font-medium text-fg-muted">
          {page} / {pageCount}
        </span>
        <IconButton
          icon={<ChevronRight className="h-4 w-4" />}
          label="Page suivante"
          variant="outline"
          size="xs"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
        />
      </div>
    </div>
  )
}

const AVATAR_SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
} as const

/**
 * Initials avatar.
 *
 * The hue is derived from the name, so the same person is always the same
 * colour everywhere they appear - and because it is a hue rotation at the
 * system's fixed lightness and chroma, every avatar carries identical visual
 * weight. No avatar can accidentally shout louder than its neighbours.
 */
export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string | null | undefined
  size?: keyof typeof AVATAR_SIZES
  className?: string
}) {
  const label = (name ?? '?').trim()
  const initials =
    label
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'

  let hash = 0
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) % 360

  return (
    <span
      aria-hidden="true"
      style={{
        background: `oklch(0.552 0.16 ${hash})`,
      }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-chip font-bold text-white shadow-e1',
        AVATAR_SIZES[size],
        className
      )}
    >
      {initials}
    </span>
  )
}

/**
 * Keyboard hint.
 *
 * The POS binds Insert / Home / End / Enter / Escape / Ctrl+G but has never
 * shown the cashier what they are.
 */
export function KeyHint({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((k, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-[10px] text-fg-subtle">+</span>}
          <kbd
            className={cn(
              'inline-flex h-5 min-w-5 items-center justify-center rounded-inset px-1.5',
              'border border-border-strong bg-surface-2 shadow-e1',
              'font-sans text-[10px] font-semibold text-fg-muted'
            )}
          >
            {k}
          </kbd>
        </span>
      ))}
    </span>
  )
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-fg-subtle">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
    </div>
  )
}

/** Sticky bar for filters and bulk actions above a table. */
export function Toolbar({
  children,
  className,
  sticky,
}: {
  children: ReactNode
  className?: string
  sticky?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 sm:gap-3',
        sticky && 'sticky top-0 z-20 -mx-1 rounded-card bg-surface/80 px-1 py-2 backdrop-blur-[var(--blur-1)]',
        className
      )}
    >
      {children}
    </div>
  )
}
