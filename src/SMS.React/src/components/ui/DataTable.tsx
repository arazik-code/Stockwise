import { useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from './cn'
import { Checkbox } from './Field'
import { SkeletonTable } from './States'

/**
 * Tables.
 *
 * The old shared/DataTable was used by exactly 2 of 33 pages (and still used
 * `gray-*` while the rest of the app used `slate-*`). Every other table in the
 * application was a hand-rolled `<table className="w-full">`. This replaces
 * all of them.
 *
 * ══ How dense rows and luminous chrome coexist ══════════════════════════════
 *
 * The generous part - 18px radius, tinted shadow, glass wash, sticky filter
 * bar - exists ONCE per page and costs nothing. Inside it, rows run at
 * [data-density] scale: 38px tall with 13px tabular text in `compact`. So an
 * 11-column stock table still fits, inside an expensive-looking frame.
 *
 * Rows deliberately have: no radius, no shadow, no glass, no blur. Hover is a
 * single background-color change plus an inset accent bar via box-shadow,
 * which composites and never triggers layout.
 *
 * Zebra striping is off. On a tinted surface it muddies; low-opacity row
 * separators read cleaner.
 */

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T, index: number) => ReactNode
  /** Right-aligns and applies tabular figures. Use for money and counts. */
  numeric?: boolean
  align?: 'left' | 'center' | 'right'
  width?: string
  sortable?: boolean
  headerClassName?: string
  cellClassName?: string
}

export interface SortState {
  key: string
  dir: 'asc' | 'desc'
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: (row: T, index: number) => string | number
  loading?: boolean
  /** Rendered in place of the table body when data is empty. */
  empty?: ReactNode
  emptyMessage?: string
  onRowClick?: (row: T, index: number) => void
  sort?: SortState | null
  onSortChange?: (sort: SortState) => void
  selection?: {
    selected: Set<string | number>
    onToggle: (key: string | number) => void
    onToggleAll: () => void
    allSelected: boolean
    someSelected: boolean
  }
  /** Sticky header inside the scroll container. */
  sticky?: boolean
  /** Highlight a row, e.g. the one open in a detail panel. */
  activeKey?: string | number | null
  className?: string
  /** Applied to the scrolling wrapper, e.g. "max-h-[60vh]". */
  scrollClassName?: string
}

const alignClass = (c: Column<unknown>) =>
  c.align === 'right' || c.numeric ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'

function SortIcon({ active, dir }: { active: boolean; dir?: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 opacity-40" />
  return dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
}

export function DataTable<T>({
  columns,
  data,
  keyField,
  loading,
  empty,
  emptyMessage = 'Aucune donnée',
  onRowClick,
  sort,
  onSortChange,
  selection,
  sticky = true,
  activeKey,
  className,
  scrollClassName,
}: DataTableProps<T>) {
  if (loading) return <SkeletonTable cols={columns.length + (selection ? 1 : 0)} />

  const colSpan = columns.length + (selection ? 1 : 0)

  return (
    <div className={cn('surface-glass overflow-hidden', className)}>
      <div className={cn('overflow-x-auto', scrollClassName)}>
        <table className="w-full border-collapse">
          <thead className={cn(sticky && 'sticky top-0 z-10')}>
            <tr className="bg-surface-2/90 backdrop-blur-[2px]">
              {selection && (
                <th className="w-10 border-b border-border px-density py-2.5">
                  <Checkbox
                    checked={selection.allSelected}
                    indeterminate={selection.someSelected && !selection.allSelected}
                    onChange={selection.onToggleAll}
                    aria-label="Tout sélectionner"
                  />
                </th>
              )}
              {columns.map((col) => {
                const active = sort?.key === col.key
                return (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      'border-b border-border px-density py-2.5',
                      'text-[11px] font-semibold uppercase tracking-wider text-fg-subtle whitespace-nowrap',
                      alignClass(col as Column<unknown>),
                      col.headerClassName
                    )}
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSortChange({
                            key: col.key,
                            dir: active && sort?.dir === 'asc' ? 'desc' : 'asc',
                          })
                        }
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-inset transition-colors hover:text-fg',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]',
                          active && 'text-[var(--accent)]',
                          col.align === 'right' || col.numeric ? 'flex-row-reverse' : ''
                        )}
                      >
                        {col.header}
                        <SortIcon active={active} dir={sort?.dir} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-density py-0">
                  {empty ?? (
                    <p className="py-12 text-center text-sm text-fg-subtle">{emptyMessage}</p>
                  )}
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const key = keyField(row, index)
                const selected = selection?.selected.has(key)
                const isActive = activeKey != null && activeKey === key
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                    data-selected={selected || undefined}
                    className={cn(
                      'h-row border-b border-border/40 transition-colors duration-fast',
                      onRowClick && 'cursor-pointer',
                      // Composited: a background change plus an inset bar. No
                      // transform, no shadow spread, no layout.
                      'hover:bg-surface-2',
                      (selected || isActive) &&
                        'bg-[var(--accent-soft)] shadow-[inset_2px_0_0_var(--accent)]'
                    )}
                  >
                    {selection && (
                      <td className="px-density" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected ?? false}
                          onChange={() => selection.onToggle(key)}
                          aria-label="Sélectionner la ligne"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-density text-density text-fg',
                          alignClass(col as Column<unknown>),
                          col.numeric && 'num',
                          col.cellClassName
                        )}
                      >
                        {col.render(row, index)}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export interface VirtualTableProps<T> extends Omit<DataTableProps<T>, 'sticky' | 'scrollClassName'> {
  /** Scroll viewport height. Must be bounded for virtualization to work. */
  height?: number | string
  estimateRowHeight?: number
  overscan?: number
}

/**
 * Virtualized table.
 *
 * StockPage carries a comment at line 46 recording that rendering all ~2,957
 * rows froze the page, which is why it paginates at 50. This redesign makes
 * each row heavier - richer badges, real icons, more border work - so the
 * margin is thinner than it was, not wider.
 *
 * Rows are absolutely positioned inside a spacer, so this uses divs with
 * table-ish roles rather than a real <table>: you cannot absolutely position
 * <tr> elements reliably across browsers.
 *
 * Pick with `shouldVirtualize()` rather than by hand - below a couple of
 * hundred rows, plain DataTable is faster and keeps real table semantics.
 */
export const VIRTUALIZE_THRESHOLD = 200
export const shouldVirtualize = (count: number) => count >= VIRTUALIZE_THRESHOLD

export function VirtualTable<T>({
  columns,
  data,
  keyField,
  loading,
  empty,
  emptyMessage = 'Aucune donnée',
  onRowClick,
  sort,
  onSortChange,
  selection,
  activeKey,
  className,
  height = 560,
  estimateRowHeight = 44,
  overscan = 10,
}: VirtualTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
  })

  if (loading) return <SkeletonTable cols={columns.length + (selection ? 1 : 0)} />

  const gridTemplate = [
    selection ? '2.5rem' : null,
    ...columns.map((c) => c.width ?? 'minmax(6rem, 1fr)'),
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cn('surface-glass overflow-hidden', className)}>
      {/* Header - outside the scroller so it is genuinely fixed. */}
      <div
        role="row"
        style={{ gridTemplateColumns: gridTemplate }}
        className="grid items-center gap-0 border-b border-border bg-surface-2/90 px-0"
      >
        {selection && (
          <div className="px-density py-2.5">
            <Checkbox
              checked={selection.allSelected}
              indeterminate={selection.someSelected && !selection.allSelected}
              onChange={selection.onToggleAll}
              aria-label="Tout sélectionner"
            />
          </div>
        )}
        {columns.map((col) => {
          const active = sort?.key === col.key
          return (
            <div
              key={col.key}
              role="columnheader"
              className={cn(
                'px-density py-2.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle',
                'truncate',
                alignClass(col as Column<unknown>),
                col.headerClassName
              )}
            >
              {col.sortable && onSortChange ? (
                <button
                  type="button"
                  onClick={() =>
                    onSortChange({ key: col.key, dir: active && sort?.dir === 'asc' ? 'desc' : 'asc' })
                  }
                  className={cn(
                    'inline-flex items-center gap-1.5 transition-colors hover:text-fg',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]',
                    active && 'text-[var(--accent)]'
                  )}
                >
                  {col.header}
                  <SortIcon active={active} dir={sort?.dir} />
                </button>
              ) : (
                col.header
              )}
            </div>
          )
        })}
      </div>

      {data.length === 0 ? (
        empty ?? <p className="py-12 text-center text-sm text-fg-subtle">{emptyMessage}</p>
      ) : (
        <div
          ref={scrollRef}
          style={{ height: typeof height === 'number' ? `${height}px` : height }}
          className="overflow-auto"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map((v) => {
              const row = data[v.index]
              const key = keyField(row, v.index)
              const selected = selection?.selected.has(key)
              const isActive = activeKey != null && activeKey === key
              return (
                <div
                  key={key}
                  role="row"
                  data-index={v.index}
                  ref={virtualizer.measureElement}
                  onClick={onRowClick ? () => onRowClick(row, v.index) : undefined}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${v.start}px)`,
                    gridTemplateColumns: gridTemplate,
                  }}
                  className={cn(
                    'grid items-center border-b border-border/40 transition-colors duration-fast',
                    onRowClick && 'cursor-pointer',
                    'hover:bg-surface-2',
                    (selected || isActive) &&
                      'bg-[var(--accent-soft)] shadow-[inset_2px_0_0_var(--accent)]'
                  )}
                >
                  {selection && (
                    <div className="px-density py-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected ?? false}
                        onChange={() => selection.onToggle(key)}
                        aria-label="Sélectionner la ligne"
                      />
                    </div>
                  )}
                  {columns.map((col) => (
                    <div
                      key={col.key}
                      role="cell"
                      className={cn(
                        'min-w-0 truncate px-density py-2 text-density text-fg',
                        alignClass(col as Column<unknown>),
                        col.numeric && 'num',
                        col.cellClassName
                      )}
                    >
                      {col.render(row, v.index)}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
