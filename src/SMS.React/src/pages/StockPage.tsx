import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { History, PackageSearch, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import StockAdjustmentDialog from '../components/stock/StockAdjustmentDialog'
import StockMovementHistory from '../components/stock/StockMovementHistory'
import { stockApi } from '../api/stock'
import { showToast } from '../components/shared/Toast'
import { useTableSelection } from '../hooks/useTableSelection'
import {
  Badge, Button, Checkbox, DataTable, EmptyState, IconButton, Input, KeyHint,
  Modal, Page, Pagination, SkeletonTable, StatusBadge, Toolbar, cn,
  type Column,
} from '../components/ui'
import type { StockItem, StockAdjustmentRequest } from '../types/stock'

/**
 * ══ LEDGER ARCHETYPE - GOLDEN REFERENCE ═════════════════════════════════════
 *
 * Copy this page's structure for every table-driven screen (Invoices,
 * Fournisseurs, Sales, OnlineOrders, AdminUsers, AdminAuditLog...).
 *
 * The pattern, in order:
 *   <Page section=… title=… actions=…>     section supplies the accent + hue
 *     <Toolbar sticky>                     filters, search, right-aligned
 *     bulk-action bar                      only when a selection exists
 *     loading / empty / error              THREE states, always
 *     <DataTable>                          generous frame, dense rows
 *     <Pagination>
 *
 * Why the frame is luxurious and the rows are not: the glass container, its
 * 18px radius and its cyan-tinted shadow exist once and cost nothing. Inside,
 * `compact` density gives 38px rows with 13px tabular text, so all eleven
 * columns still fit. That is how "luminous depth" and a dense ledger coexist.
 *
 * ── On virtualization ───────────────────────────────────────────────────────
 *
 * This page has <VirtualTable> available and deliberately does not use it.
 * The freeze recorded at line 46 below was already solved by paginating the
 * render at 50 rows, and swapping that for virtualization would mean deleting
 * the pagination - a logic change, which the migration contract forbids in a
 * restyle. Fifty rows render fine. VirtualTable is there for pages that render
 * an unbounded list; see /design for it in use.
 */
export default function StockPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState<StockItem[]>([])
  const [showLowOnly, setShowLowOnly] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [showMovements, setShowMovements] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50
  const tableSelection = useTableSelection<StockItem & { id: number }>()

  const loadStock = useCallback(async () => {
    setLoading(true)
    try {
      const data = showLowOnly ? await stockApi.getLowStock() : await stockApi.getAll()
      setItems(data)
    } finally {
      setLoading(false)
    }
  }, [showLowOnly])

  useEffect(() => { loadStock() }, [loadStock])

  const itemsWithId = useMemo(() => items.map(i => ({ ...i, id: i.productVariantId })), [items])

  const filteredItems = useMemo(() => {
    if (!search.trim()) return itemsWithId
    const q = search.toLowerCase()
    return itemsWithId.filter(
      i => i.productName.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || (i as any).barcode?.toLowerCase().includes(q)
    )
  }, [itemsWithId, search])

  // Rendering all ~2,957 rows at once is what actually froze this page - the fetch itself is
  // fast, the DOM explosion isn't. Paginate the render only; the full filtered set is still
  // used for select-all/export/etc.
  useEffect(() => { setPage(1) }, [search, showLowOnly])
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const pagedItems = useMemo(
    () => filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredItems, page]
  )

  // Keyboard shortcuts — native listener with capture to beat the browser
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.key) {
        case 'Insert':
          e.preventDefault()
          e.stopPropagation()
          setShowLowOnly((prev) => {
            const next = !prev
            showToast(next ? 'Filtrage stock bas activé' : 'Filtrage stock bas désactivé', 'info')
            return next
          })
          break
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          if (showAdjustDialog) { setShowAdjustDialog(false); setSelectedItem(null) }
          else if (showMovements) { setShowMovements(false); setSelectedItem(null) }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [showAdjustDialog, showMovements])

  const handleAdjust = async (data: StockAdjustmentRequest) => {
    if (!selectedItem) return
    try {
      await stockApi.adjust({ ...data, productVariantId: selectedItem.productVariantId })
      showToast(t('common.success'), 'success')
      setShowAdjustDialog(false)
      setSelectedItem(null)
      loadStock()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleDelete = async (variantId: number) => {
    try {
      await stockApi.deleteStock(variantId)
      showToast(t('common.success'), 'success')
      loadStock()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleBulkDelete = async (variantIds: number[]) => {
    try {
      await stockApi.bulkDeleteStock(variantIds)
      tableSelection.clear()
      showToast(t('common.success'), 'success')
      loadStock()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  type Row = StockItem & { id: number }

  const columns: Column<Row>[] = [
    {
      key: 'sku',
      header: t('table.sku'),
      width: '9rem',
      render: (r) => <span className="num text-fg-muted">{r.sku}</span>,
    },
    {
      key: 'product',
      header: t('stock.product'),
      render: (r) => <span className="font-medium text-fg">{r.productName}</span>,
    },
    { key: 'color', header: t('products.color'), width: '7rem', render: (r) => <span className="text-fg-muted">{r.colorName}</span> },
    { key: 'size', header: t('products.size'), width: '5rem', render: (r) => <span className="text-fg-muted">{r.sizeValue}</span> },
    { key: 'onHand', header: t('stock.onHand'), numeric: true, width: '6rem', render: (r) => <span className="text-fg-muted">{r.quantityOnHand}</span> },
    { key: 'reserved', header: t('stock.reserved'), numeric: true, width: '6rem', render: (r) => <span className="text-fg-muted">{r.quantityReserved}</span> },
    {
      key: 'available',
      header: t('stock.available'),
      numeric: true,
      width: '6rem',
      render: (r) => <span className="font-semibold text-fg">{r.quantityAvailable}</span>,
    },
    { key: 'reorder', header: t('stock.reorderLevel'), numeric: true, width: '6rem', render: (r) => <span className="text-fg-subtle">{r.reorderLevel}</span> },
    {
      key: 'status',
      header: t('sales.status'),
      align: 'center',
      width: '7rem',
      // Behaviour is unchanged: this page's own isLowStock flag still decides.
      // Only the LOOK is unified - ProductsPage (<=10) and DashboardPage (<=3)
      // keep their own predicates, because a restyle must not quietly redefine
      // what "low stock" means for the business.
      render: (r) => (
        <StatusBadge
          domain="stockLevel"
          value={r.isLowStock ? 'low' : 'ok'}
          showIcon={false}
          animate={false}
        />
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'center',
      width: '8rem',
      render: (r) => (
        <div className="flex items-center justify-center gap-0.5">
          <IconButton
            icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            label={t('stock.adjust')}
            size="xs"
            onClick={() => { setSelectedItem(r); setShowAdjustDialog(true) }}
          />
          <IconButton
            icon={<History className="h-3.5 w-3.5" />}
            label={t('stock.history')}
            size="xs"
            onClick={() => { setSelectedItem(r); setShowMovements(true) }}
          />
          <IconButton
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label={t('common.delete')}
            size="xs"
            variant="danger-ghost"
            onClick={() => handleDelete(r.productVariantId)}
          />
        </div>
      ),
    },
  ]

  return (
    <Page
      section="stock"
      title={t('stock.title')}
      actions={
        <span className="hidden items-center gap-1.5 text-xs text-fg-subtle sm:flex">
          <KeyHint keys={['Inser']} />
          {t('stock.lowStockFilter')}
        </span>
      }
    >
      <div className="space-y-4">
        <Toolbar>
          <Checkbox
            checked={showLowOnly}
            onChange={(e) => setShowLowOnly(e.target.checked)}
            label={t('stock.lowStockFilter')}
          />
          {!loading && (
            <Badge tone="neutral" size="sm">
              <span className="num">{filteredItems.length.toLocaleString('fr-FR')}</span>
              &nbsp;article(s)
            </Badge>
          )}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, SKU ou code-barres…"
            leading={<Search />}
            size="sm"
            wrapperClassName="ml-auto w-full sm:w-72"
            trailing={
              search ? (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Effacer"
                  className="pointer-events-auto text-fg-subtle transition-colors hover:text-fg"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : undefined
            }
          />
        </Toolbar>

        {tableSelection.someSelected && (
          <div
            className={cn(
              'flex flex-wrap items-center gap-3 rounded-card border px-4 py-2.5',
              'border-[color-mix(in_oklab,var(--accent)_28%,transparent)] bg-[var(--accent-soft)]'
            )}
          >
            <span className="text-sm font-medium text-[var(--accent-ink)]">
              <span className="num">{tableSelection.count}</span> sélectionné
              {tableSelection.count !== 1 ? 's' : ''}
            </span>
            <Button
              size="xs"
              variant="soft"
              onClick={() => {
                tableSelection.clear()
                showToast('Bulk adjust coming soon', 'info')
              }}
            >
              {t('stock.adjust')}
            </Button>
            <Button
              size="xs"
              variant="danger"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => {
                const ids = Array.from(tableSelection.selected)
                if (ids.length > 0) handleBulkDelete(ids)
              }}
            >
              {t('common.delete')}
            </Button>
            <Button size="xs" variant="ghost" className="ml-auto" onClick={tableSelection.clear}>
              Effacer
            </Button>
          </div>
        )}

        {loading ? (
          <SkeletonTable rows={12} cols={11} />
        ) : filteredItems.length === 0 ? (
          <div className="surface-glass">
            <EmptyState
              icon={PackageSearch}
              variant={search ? 'search' : 'default'}
              title={search ? 'Aucun article ne correspond' : 'Aucun article en stock'}
              description={
                search
                  ? 'Essayez un autre nom, SKU ou code-barres.'
                  : 'Les articles apparaîtront ici une fois le stock reçu.'
              }
              action={
                search ? (
                  <Button size="sm" variant="outline" onClick={() => setSearch('')}>
                    Effacer la recherche
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <DataTable<Row>
              columns={columns}
              data={pagedItems}
              keyField={(r) => r.productVariantId}
              selection={{
                selected: tableSelection.selected as Set<string | number>,
                onToggle: (key) => tableSelection.toggle(Number(key)),
                onToggleAll: () => tableSelection.toggleAll(filteredItems),
                allSelected: tableSelection.allSelected(filteredItems),
                someSelected: tableSelection.someSelected,
              }}
            />
            <Pagination
              page={page}
              pageCount={totalPages}
              total={filteredItems.length}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          </>
        )}
      </div>

      {showAdjustDialog && selectedItem && (
        <StockAdjustmentDialog
          productVariantId={selectedItem.productVariantId}
          productName={`${selectedItem.productName} - ${selectedItem.colorName} / ${selectedItem.sizeValue}`}
          currentQuantity={selectedItem.quantityOnHand}
          onSubmit={handleAdjust}
          onCancel={() => { setShowAdjustDialog(false); setSelectedItem(null) }}
        />
      )}

      {/* closeOnEsc stays false: this page owns Escape in its own capture-phase
          listener above, which already closes this modal. */}
      <Modal
        open={showMovements && !!selectedItem}
        onClose={() => { setShowMovements(false); setSelectedItem(null) }}
        size="2xl"
        title={t('stock.history')}
        description={
          selectedItem
            ? `${selectedItem.productName} — ${selectedItem.colorName} / ${selectedItem.sizeValue}`
            : undefined
        }
      >
        {selectedItem && <StockMovementHistory productVariantId={selectedItem.productVariantId} />}
      </Modal>
    </Page>
  )
}
