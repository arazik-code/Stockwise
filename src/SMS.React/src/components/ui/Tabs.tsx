import { type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from './cn'
import { SPRING } from '../../design/motion'

/**
 * Tabs.
 *
 * Consolidates the underline tab bar in AdminLayout, the two-tab switchers in
 * RefundsPage / FournisseursPage / OnlineProductsPage / OnlineSyncPage /
 * OnlineSettingsPage / OnlineFinancePage / ClientsPage, and the segmented
 * filter pill rows in ProductsPage / SalesPage / OnlineDeliveryPage - all of
 * which were hand-rolled and none of which agreed on styling.
 *
 * The active indicator uses a shared `layoutId`, so it physically SLIDES
 * between tabs instead of disappearing and reappearing. That single detail is
 * most of what separates this from a set of styled buttons.
 */

export interface TabItem<T extends string = string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  /** Rendered as a count pill on the right of the label. */
  badge?: ReactNode
  disabled?: boolean
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  variant?: 'underline' | 'pill' | 'segmented'
  size?: 'sm' | 'md'
  className?: string
  /** Unique per tab group on screen - shared layoutIds would animate across groups. */
  layoutGroupId?: string
}

export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  variant = 'underline',
  size = 'md',
  className,
  layoutGroupId,
}: TabsProps<T>) {
  const indicatorId = `tab-indicator-${layoutGroupId ?? variant}-${items.map((i) => i.value).join('-')}`
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'

  if (variant === 'segmented') {
    return (
      <div
        role="tablist"
        className={cn('inline-flex gap-0.5 rounded-field bg-sunken p-0.5', className)}
      >
        {items.map((item) => {
          const active = item.value === value
          return (
            <button
              key={item.value}
              role="tab"
              type="button"
              aria-selected={active}
              disabled={item.disabled}
              onClick={() => onChange(item.value)}
              className={cn(
                'relative inline-flex items-center justify-center gap-1.5 rounded-[calc(var(--r-field)-3px)] font-medium',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]',
                'disabled:opacity-40 disabled:pointer-events-none',
                pad,
                active ? 'text-[var(--accent-fg)]' : 'text-fg-muted hover:text-fg'
              )}
            >
              {active && (
                <motion.span
                  layoutId={indicatorId}
                  transition={SPRING.snappy}
                  className="absolute inset-0 rounded-[calc(var(--r-field)-3px)] bg-[var(--accent)] shadow-e1"
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                {item.icon}
                {item.label}
                {item.badge != null && (
                  <span className="ml-0.5 text-[10px] opacity-80">{item.badge}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  if (variant === 'pill') {
    return (
      <div role="tablist" className={cn('flex flex-wrap gap-1.5', className)}>
        {items.map((item) => {
          const active = item.value === value
          return (
            <button
              key={item.value}
              role="tab"
              type="button"
              aria-selected={active}
              disabled={item.disabled}
              onClick={() => onChange(item.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-chip border font-medium',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]',
                'disabled:opacity-40 disabled:pointer-events-none',
                pad,
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                  : 'border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg'
              )}
            >
              {item.icon}
              {item.label}
              {item.badge != null && (
                <span className="ml-0.5 rounded-chip bg-[color-mix(in_oklab,currentColor_14%,transparent)] px-1.5 text-[10px]">
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn('border-b border-border', className)}>
      <div role="tablist" className="-mb-px flex gap-1 overflow-x-auto">
        {items.map((item) => {
          const active = item.value === value
          return (
            <button
              key={item.value}
              role="tab"
              type="button"
              aria-selected={active}
              disabled={item.disabled}
              onClick={() => onChange(item.value)}
              className={cn(
                'relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-medium',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-inset',
                'disabled:opacity-40 disabled:pointer-events-none',
                pad,
                active ? 'text-[var(--accent)]' : 'text-fg-muted hover:text-fg'
              )}
            >
              {item.icon}
              {item.label}
              {item.badge != null && (
                <span className="ml-0.5 rounded-chip bg-sunken px-1.5 text-[10px] text-fg-muted">
                  {item.badge}
                </span>
              )}
              {active && (
                <motion.span
                  layoutId={indicatorId}
                  transition={SPRING.snappy}
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-chip bg-[var(--accent)]"
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
