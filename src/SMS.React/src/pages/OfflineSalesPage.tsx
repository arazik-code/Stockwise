import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { salesApi } from '../api/sales'
import { showToast } from '../components/shared/Toast'
import { formatCurrency, formatDate } from '../utils/format'
import { Button, DataTable, Page, type Column } from '../components/ui'
import type { Sale } from '../types/sale'

// Manual reconciliation tooling (plan doc Phase 5) - sales rung up on the local fallback while
// the VPS was unreachable are never auto-pushed back (decision #3: automatic reconciliation risks
// silently overselling stock Shopify already sold online during the same outage window). This
// page is the owner's worklist: review each sale, re-key it into the VPS by hand, mark it done.
export default function OfflineSalesPage() {
  const { t } = useTranslation()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [reconcilingId, setReconcilingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSales(await salesApi.getOfflineSales())
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  const handleReconcile = async (sale: Sale) => {
    if (!confirm(t('offlineSales.reconcileConfirm'))) return
    setReconcilingId(sale.id)
    try {
      await salesApi.markReconciled(sale.id)
      showToast(t('offlineSales.reconcileSuccess'), 'success')
      load()
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setReconcilingId(null)
    }
  }

  const columns: Column<Sale>[] = [
    { key: 'saleNumber', header: t('sales.saleNumber'), render: (s) => <span className="num font-medium text-fg">{s.saleNumber}</span> },
    { key: 'date', header: t('offlineSales.date'), render: (s) => <span className="text-fg-muted">{formatDate(s.createdAt)}</span> },
    { key: 'client', header: t('offlineSales.client'), render: (s) => <span className="text-fg-muted">{s.clientName ?? '-'}</span> },
    {
      key: 'items',
      header: t('offlineSales.items'),
      render: (s) => (
        <span className="text-fg-muted">
          {s.items.map((i) => `${i.productName} (${[i.colorName, i.sizeValue].filter(Boolean).join(' / ')}) x${i.quantity}`).join(', ')}
        </span>
      ),
    },
    {
      key: 'total',
      header: t('offlineSales.total'),
      numeric: true,
      render: (s) => <span className="font-semibold text-fg">{formatCurrency(s.totalAmount)}</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'center',
      render: (s) => (
        <Button
          size="xs"
          variant="success"
          onClick={() => handleReconcile(s)}
          loading={reconcilingId === s.id}
        >
          {t('offlineSales.markReconciled')}
        </Button>
      ),
    },
  ]

  return (
    <Page section="offlineSales" title={t('offlineSales.title')}>
      <div className="space-y-4">
        {/* Informational, not an error - ErrorBanner is fixed to the negative
            tone by design, so this stays a plain toned panel instead. */}
        <div
          data-tone="caution"
          className="rounded-card border border-[color-mix(in_oklab,var(--tone)_28%,transparent)] bg-[var(--tone-soft)] px-4 py-3 text-sm text-[var(--tone-ink)]"
        >
          {t('offlineSales.explanation')}
        </div>

        <DataTable<Sale>
          columns={columns}
          data={sales}
          keyField={(s) => s.id}
          loading={loading}
          emptyMessage={t('offlineSales.noneFound')}
        />
      </div>
    </Page>
  )
}
