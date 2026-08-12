import { useState, useEffect } from 'react'
import { History } from 'lucide-react'
import { stockApi } from '../../api/stock'
import { Badge, DataTable, EmptyState, SkeletonTable } from '../ui'
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
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    stockApi
      .getMovements(productVariantId)
      .then(setMovements)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [productVariantId])

  if (loading) {
    return <SkeletonTable rows={6} cols={6} />
  }

  return (
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
      ]}
      data={movements}
      keyField={(m) => m.id}
      scrollClassName="max-h-[60vh]"
      empty={
        <EmptyState compact icon={History} title="No movements recorded" />
      }
    />
  )
}
