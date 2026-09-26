import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { History, Undo2 } from 'lucide-react'
import { stockApi } from '../../api/stock'
import { showToast } from '../shared/Toast'
import { Badge, DataTable, EmptyState, IconButton, Modal, Button, SkeletonTable } from '../ui'
import type { StockMovement } from '../../types/stock'

interface StockMovementHistoryProps {
  productVariantId?: number
}

const typeLabels: Record<string, string> = {
  Sale: 'Sale',
  Return: 'Return',
  Adjustment: 'Adjustment',
  Initial: 'Initial',
  ShopifySync: 'Shopify Sync',
  Purchase: 'Purchase',
}

export default function StockMovementHistory({ productVariantId }: StockMovementHistoryProps) {
  const { t } = useTranslation()
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [undoTarget, setUndoTarget] = useState<StockMovement | null>(null)
  const [undoing, setUndoing] = useState(false)

  const load = () => {
    setLoading(true)
    stockApi
      .getMovements(productVariantId)
      .then(setMovements)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [productVariantId])

  const handleUndo = async () => {
    if (!undoTarget) return
    setUndoing(true)
    try {
      await stockApi.undoAdjustment(undoTarget.id)
      showToast(t('stock.undoAdjustmentSuccess'), 'success')
      setUndoTarget(null)
      load()
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setUndoing(false)
    }
  }

  if (loading) {
    return <SkeletonTable rows={6} cols={6} />
  }

  // Only the most recent movement for a given variant can be reversed - matches the backend
  // guard, which refuses to undo an adjustment that isn't the latest movement for that variant.
  const latestMovementId = movements[0]?.id

  return (
    <>
    <DataTable<StockMovement>
      columns={[
        {
          key: 'date',
          header: 'Date',
          width: '11rem',
          render: (m) => (
            <span className="num text-fg-muted">{new Date(m.createdAt).toLocaleString()}</span>
          ),
        },
        {
          key: 'type',
          header: 'Type',
          width: '8rem',
          render: (m) => (
            <Badge
              size="xs"
              tone={
                (
                  {
                    Sale: 'negative',
                    Return: 'positive',
                    Adjustment: 'info',
                    Initial: 'muted',
                    ShopifySync: 'special',
                    Purchase: 'positive',
                  } as const
                )[m.type] ?? 'neutral'
              }
            >
              {typeLabels[m.type] ?? m.type}
            </Badge>
          ),
        },
        {
          key: 'product',
          header: 'Product',
          render: (m) => (
            <>
              <span className="font-medium text-fg">{m.productName}</span>
              <span className="ml-1 text-fg-subtle">
                ({m.colorName} / {m.sizeValue})
              </span>
            </>
          ),
        },
        {
          key: 'change',
          header: 'Change',
          numeric: true,
          width: '6rem',
          render: (m) => (
            <span
              data-tone={m.quantityChange < 0 ? 'negative' : 'positive'}
              className="font-bold text-[var(--tone)]"
            >
              {m.quantityChange > 0 ? '+' : ''}
              {m.quantityChange}
            </span>
          ),
        },
        {
          key: 'after',
          header: 'After',
          numeric: true,
          width: '6rem',
          render: (m) => <span className="text-fg">{m.quantityAfter}</span>,
        },
        {
          key: 'reference',
          header: 'Reference',
          width: '10rem',
          render: (m) => <span className="text-fg-subtle">{m.reference ?? '-'}</span>,
        },
        {
          key: 'actions',
          header: '',
          align: 'center',
          width: '3rem',
          render: (m) =>
            m.type === 'Adjustment' && m.id === latestMovementId ? (
              <IconButton
                icon={<Undo2 className="h-3.5 w-3.5" />}
                label={t('stock.undoAdjustment')}
                size="xs"
                variant="danger-ghost"
                onClick={() => setUndoTarget(m)}
              />
            ) : null,
        },
      ]}
      data={movements}
      keyField={(m) => m.id}
      scrollClassName="max-h-[60vh]"
      empty={
        <EmptyState compact icon={History} title="No movements recorded" />
      }
    />

    <Modal
      open={!!undoTarget}
      onClose={() => setUndoTarget(null)}
      size="sm"
      title={t('stock.undoAdjustment')}
    >
      <p className="mb-5 text-sm text-fg-muted">
        {undoTarget && t('stock.undoAdjustmentConfirm', { change: undoTarget.quantityChange > 0 ? `+${undoTarget.quantityChange}` : `${undoTarget.quantityChange}` })}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setUndoTarget(null)}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onClick={handleUndo} disabled={undoing} loading={undoing}>
          {t('common.confirm')}
        </Button>
      </div>
    </Modal>
    </>
  )
}
