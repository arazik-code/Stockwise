import { useState, useEffect } from 'react'
import { stockApi } from '../../api/stock'
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

const typeColors: Record<string, string> = {
  Sale: 'text-red-600',
  Return: 'text-green-600',
  Adjustment: 'text-blue-600',
  Initial: 'text-gray-600',
  ShopifySync: 'text-purple-600',
  Purchase: 'text-green-600',
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
    return <div className="text-center py-4 text-gray-400">Loading movements...</div>
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="px-4 py-3 border-b font-medium">Movement History</div>
      {movements.length === 0 ? (
        <div className="px-4 py-8 text-center text-gray-400">No movements recorded</div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Date</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Type</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Product</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Change</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">After</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Reference</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2 text-sm">{new Date(m.createdAt).toLocaleString()}</td>
                <td className={`px-4 py-2 text-sm font-medium ${typeColors[m.type] ?? ''}`}>
                  {typeLabels[m.type] ?? m.type}
                </td>
                <td className="px-4 py-2 text-sm">
                  <span className="text-gray-900">{m.productName}</span>
                  <span className="text-gray-400 ml-1">({m.colorName} / {m.sizeValue})</span>
                </td>
                <td className={`px-4 py-2 text-sm text-right font-bold ${m.quantityChange < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {m.quantityChange > 0 ? '+' : ''}{m.quantityChange}
                </td>
                <td className="px-4 py-2 text-sm text-right">{m.quantityAfter}</td>
                <td className="px-4 py-2 text-sm text-gray-500">{m.reference ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
