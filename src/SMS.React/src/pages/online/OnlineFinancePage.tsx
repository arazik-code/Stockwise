import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, PiggyBank, Truck, Wallet } from 'lucide-react'
import { showToast } from '../../components/shared/Toast'
import { codFinanceApi, type CodFinanceDashboard, type CodOutstandingOrder, type CourierRemittance } from '../../api/codFinance'
import { formatCurrency, formatDateTime } from '../../utils/format'
import {
  Badge, Button, Checkbox, DataTable, Input, Modal, Page,
  SkeletonStats, SkeletonTable, StatCard, Tabs, cn, type Column,
} from '../../components/ui'

type Tab = 'overview' | 'remittances'

export default function OnlineFinancePage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [dashboard, setDashboard] = useState<CodFinanceDashboard | null>(null)
  const [remittances, setRemittances] = useState<CourierRemittance[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, r] = await Promise.all([codFinanceApi.getDashboard(), codFinanceApi.getRemittances()])
      setDashboard(d)
      setRemittances(r)
    } catch {
      showToast('Erreur lors du chargement des donnees financieres', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedTotal = dashboard?.oldestOutstanding
    .filter((o) => selected.has(o.onlineOrderId))
    .reduce((sum, o) => sum + o.codAmount, 0) ?? 0

  const handleCreateRemittance = async (formData: FormData) => {
    if (selected.size === 0) {
      showToast('Selectionnez au moins une commande a inclure', 'error')
      return
    }
    setCreating(true)
    try {
      await codFinanceApi.createRemittance({
        carrier: 'OzonExpress',
        reference: (formData.get('reference') as string) || undefined,
        periodStart: formData.get('periodStart') as string,
        periodEnd: formData.get('periodEnd') as string,
        declaredAmount: parseFloat(formData.get('declaredAmount') as string) || 0,
        bankRef: (formData.get('bankRef') as string) || undefined,
        onlineOrderIds: Array.from(selected),
      })
      showToast('Remise enregistree', 'success')
      setSelected(new Set())
      setShowCreate(false)
      load()
    } catch {
      showToast('Echec de l\'enregistrement de la remise', 'error')
    } finally {
      setCreating(false)
    }
  }

  if (loading && !dashboard) {
    return (
      <Page section="onlineFinance" title="Encaissements COD">
        <div className="space-y-5">
          <SkeletonStats count={4} />
          <SkeletonTable rows={8} cols={7} />
        </div>
      </Page>
    )
  }

  const outstandingColumns: Column<CodOutstandingOrder>[] = [
    {
      key: 'select',
      header: '',
      width: '2.5rem',
      render: (o) => (
        <Checkbox
          checked={selected.has(o.onlineOrderId)}
          onChange={() => toggleSelect(o.onlineOrderId)}
          aria-label="Selectionner la commande"
        />
      ),
    },
    { key: 'order', header: 'Commande', render: (o) => <span className="num font-medium text-fg">{o.orderNumber}</span> },
    { key: 'client', header: 'Client', render: (o) => <span className="text-fg-muted">{o.customerName}</span> },
    { key: 'tracking', header: 'Tracking', render: (o) => <span className="num text-fg-subtle">{o.trackingNumber ?? '-'}</span> },
    { key: 'delivered', header: 'Livree le', render: (o) => <span className="text-fg-muted">{o.deliveredAt ? formatDateTime(o.deliveredAt) : '-'}</span> },
    {
      key: 'days',
      header: 'Jours',
      numeric: true,
      render: (o) => (
        <span className={cn('font-medium', o.daysOutstanding > 30 ? 'text-[var(--negative)]' : 'text-fg-muted')}>
          {o.daysOutstanding}
        </span>
      ),
    },
    { key: 'amount', header: 'Montant COD', numeric: true, render: (o) => <span className="font-semibold text-fg">{formatCurrency(o.codAmount)}</span> },
  ]

  const remittanceColumns: Column<CourierRemittance>[] = [
    { key: 'reference', header: 'Reference', render: (r) => <span className="font-medium text-fg">{r.reference || `#${r.id}`}</span> },
    { key: 'period', header: 'Periode', render: (r) => <span className="text-fg-muted">{formatDateTime(r.periodStart)} - {formatDateTime(r.periodEnd)}</span> },
    { key: 'declared', header: 'Declare', numeric: true, render: (r) => <span className="text-fg">{formatCurrency(r.declaredAmount)}</span> },
    { key: 'matched', header: 'Rapproche', numeric: true, render: (r) => <span className="text-fg">{formatCurrency(r.matchedAmount)}</span> },
    {
      key: 'variance',
      header: 'Ecart',
      numeric: true,
      render: (r) => (
        <span className={cn('font-medium', Math.abs(r.varianceAmount) > 0.01 ? 'text-[var(--negative)]' : 'text-[var(--positive)]')}>
          {formatCurrency(r.varianceAmount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (r) => (
        <Badge
          size="sm"
          tone={r.status === 'Reconciled' ? 'positive' : r.status === 'Disputed' ? 'negative' : r.status === 'Closed' ? 'muted' : 'caution'}
        >
          {r.status === 'Reconciled' ? 'Reconcilie' : r.status === 'Disputed' ? 'Ecart' : r.status === 'Closed' ? 'Cloture' : 'Brouillon'}
        </Badge>
      ),
    },
    { key: 'orders', header: 'Commandes', numeric: true, render: (r) => <span className="text-fg-muted">{r.orderCount}</span> },
  ]

  return (
    <Page section="onlineFinance" title="Encaissements COD">
      <div className="space-y-5">
        <Tabs
          variant="segmented"
          layoutGroupId="online-finance-tab"
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          items={[
            { value: 'overview', label: "Vue d'ensemble" },
            { value: 'remittances', label: 'Remises courrier' },
          ]}
        />

        {tab === 'overview' && dashboard && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard label="COD en attente" value={formatCurrency(dashboard.outstandingCod)} sub={`${dashboard.outstandingCount} commande(s)`} tone="caution" icon={Wallet} />
              <StatCard label="Encaisse ce mois" value={formatCurrency(dashboard.collectedThisMonth)} tone="positive" icon={CheckCircle2} />
              <StatCard label="Frais coursier ce mois" value={formatCurrency(dashboard.courierFeesThisMonth)} tone="negative" icon={Truck} />
              <StatCard label="Net ce mois" value={formatCurrency(dashboard.netThisMonth)} icon={PiggyBank} />
            </div>

            <div className="surface-glass p-5">
              <h3 className="mb-4 text-sm font-semibold text-fg">Anciennete du COD en attente</h3>
              <div className="grid grid-cols-4 gap-3">
                {dashboard.aging.map((bucket) => (
                  <div
                    key={bucket.label}
                    className={cn(
                      'rounded-card border p-3',
                      bucket.label === '30+ jours' && bucket.count > 0
                        ? 'border-[color-mix(in_oklab,var(--negative)_28%,transparent)] bg-[var(--negative-soft)]'
                        : 'border-border bg-sunken'
                    )}
                  >
                    <p className="text-xs text-fg-subtle">{bucket.label}</p>
                    <p className="num text-lg font-semibold text-fg">{bucket.count}</p>
                    <p className="num text-xs text-fg-subtle">{formatCurrency(bucket.amount)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-fg">Commandes en attente de remise (les plus anciennes)</h3>
                {selected.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-fg-subtle">
                      <span className="num">{selected.size}</span> selectionnee(s) — <span className="num">{formatCurrency(selectedTotal)}</span>
                    </span>
                    <Button size="xs" onClick={() => setShowCreate(true)}>
                      Creer une remise
                    </Button>
                  </div>
                )}
              </div>
              <DataTable
                columns={outstandingColumns}
                data={dashboard.oldestOutstanding}
                keyField={(o) => o.onlineOrderId}
                emptyMessage="Rien en attente - tout est reconcilie."
              />
            </div>
          </div>
        )}

        {tab === 'remittances' && (
          <DataTable
            columns={remittanceColumns}
            data={remittances}
            keyField={(r) => r.id}
            emptyMessage="Aucune remise enregistree pour le moment."
          />
        )}
      </div>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nouvelle remise coursier"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button type="submit" form="remittance-form" loading={creating} disabled={creating}>
              {creating ? 'Enregistrement...' : 'Enregistrer la remise'}
            </Button>
          </>
        }
      >
        <form
          id="remittance-form"
          onSubmit={(e) => { e.preventDefault(); handleCreateRemittance(new FormData(e.currentTarget)) }}
          className="space-y-3"
        >
          <p className="rounded-card bg-sunken p-2 text-xs text-fg-subtle">
            <span className="num">{selected.size}</span> commande(s) selectionnee(s) — total du a solder : <span className="num">{formatCurrency(selectedTotal)}</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input name="periodStart" type="date" required label="Debut periode" />
            <Input name="periodEnd" type="date" required label="Fin periode" />
          </div>
          <Input name="declaredAmount" type="number" step="0.01" required defaultValue={selectedTotal.toFixed(2)} label="Montant declare par le coursier (MAD)" />
          <Input name="reference" type="text" label="Reference (optionnel)" />
          <Input name="bankRef" type="text" label="Reference bancaire (optionnel)" />
        </form>
      </Modal>
    </Page>
  )
}
