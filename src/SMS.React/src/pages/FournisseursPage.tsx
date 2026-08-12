import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Building2, ChevronRight, Pencil, Plus, Receipt, Search, Trash2, TrendingUp, Truck,
} from 'lucide-react'
import { fournisseursApi } from '../api/fournisseurs'
import { invoicesApi } from '../api/invoices'
import { showToast } from '../components/shared/Toast'
import { formatCurrency, formatDate } from '../utils/format'
import { useTableSelection } from '../hooks/useTableSelection'
import ReceiveDeliveryDialog from '../components/fournisseurs/ReceiveDeliveryDialog'
import {
  Badge, Button, DataTable, EmptyState, IconButton, Input, Modal, Page,
  SkeletonTable, StatusBadge, Tabs, Toolbar, cn,
  type Column,
} from '../components/ui'
import type {
  Fournisseur,
  CreateFournisseurRequest,
  FournisseurPerformance,
  FournisseurRecommendation,
} from '../types/fournisseur'
import type { FournisseurBalance, Invoice } from '../types/invoice'

type Tab = 'liste' | 'analytique' | 'factures'

const emptyForm: CreateFournisseurRequest = { nom: '', contact: '', email: '', telephone: '', adresse: '' }

export default function FournisseursPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('liste')
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [performance, setPerformance] = useState<FournisseurPerformance[]>([])
  const [recommendations, setRecommendations] = useState<FournisseurRecommendation[]>([])
  const [balances, setBalances] = useState<FournisseurBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Fournisseur | null>(null)
  const [form, setForm] = useState<CreateFournisseurRequest>(emptyForm)
  const [showDelivery, setShowDelivery] = useState(false)
  const [deliveryFournisseur, setDeliveryFournisseur] = useState<Fournisseur | null>(null)
  const [search, setSearch] = useState('')

  const [factureDetail, setFactureDetail] = useState<FournisseurBalance | null>(null)
  const [factureInvoices, setFactureInvoices] = useState<Invoice[]>([])
  const [factureLoading, setFactureLoading] = useState(false)
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const tableSelection = useTableSelection<Fournisseur>()

  const filteredFournisseurs = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return fournisseurs
    return fournisseurs.filter(
      (f) =>
        f.nom.toLowerCase().includes(q) ||
        (f.contact ?? '').toLowerCase().includes(q) ||
        (f.email ?? '').toLowerCase().includes(q)
    )
  }, [fournisseurs, search])

  const loadListe = useCallback(async () => {
    setLoading(true)
    try {
      setFournisseurs(await fournisseursApi.getAll())
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAnalytique = useCallback(async () => {
    setLoading(true)
    try {
      const [perf, recs] = await Promise.all([
        fournisseursApi.getPerformance(),
        fournisseursApi.getRecommendations(),
      ])
      setPerformance(perf)
      setRecommendations(recs)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadFactures = useCallback(async () => {
    setLoading(true)
    try {
      const summary = await invoicesApi.getSummary()
      setBalances(summary.fournisseurBalances)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'liste') loadListe()
    else if (tab === 'analytique') loadAnalytique()
    else loadFactures()
  }, [tab, loadListe, loadAnalytique, loadFactures])

  const openFactureDetail = async (b: FournisseurBalance) => {
    setFactureDetail(b)
    setExpandedInvoiceId(null)
    setFactureLoading(true)
    try {
      setFactureInvoices(await invoicesApi.getByFournisseur(b.fournisseurId))
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setFactureLoading(false)
    }
  }

  const closeFactureDetail = () => {
    setFactureDetail(null)
    setFactureInvoices([])
    setExpandedInvoiceId(null)
  }

  const handleTogglePaid = async (inv: Invoice) => {
    const willBePaid = inv.status !== 'Paid'
    const confirmMsg = willBePaid ? t('invoices.markPaidConfirm') : t('invoices.markUnpaidConfirm')
    if (!confirm(confirmMsg)) return

    setTogglingId(inv.id)
    try {
      const updated = await invoicesApi.togglePaid(inv.id)
      setFactureInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
      showToast(t('invoices.togglePaidSuccess'), 'success')
      // The fournisseur balance table behind this modal is a live aggregate over invoice status/
      // paid amount, so it needs an explicit refresh - it won't pick up this change on its own.
      loadFactures()
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setTogglingId(null)
    }
  }

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true) }
  const openEdit = (f: Fournisseur) => {
    setEditing(f)
    setForm({ nom: f.nom, contact: f.contact ?? '', email: f.email ?? '', telephone: f.telephone ?? '', adresse: f.adresse ?? '' })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await fournisseursApi.update(editing.id, form)
      } else {
        await fournisseursApi.create(form)
      }
      showToast(t('common.success'), 'success')
      setShowForm(false)
      loadListe()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('common.confirm'))) return
    try {
      await fournisseursApi.delete(id)
      showToast(t('common.success'), 'success')
      loadListe()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg || t('common.error'), 'error')
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'liste', label: t('fournisseurs.title') },
    { key: 'analytique', label: t('fournisseurs.performance') },
    { key: 'factures', label: t('invoices.title') },
  ]

  const trendBadge = (trend: string) => {
    if (trend === 'hausse') return <Badge tone="positive" size="sm">{t('fournisseurs.trendUp')}</Badge>
    if (trend === 'baisse') return <Badge tone="negative" size="sm">{t('fournisseurs.trendDown')}</Badge>
    return <Badge tone="neutral" size="sm">{t('fournisseurs.trendStable')}</Badge>
  }

  const fournisseurColumns: Column<Fournisseur>[] = [
    { key: 'nom', header: t('fournisseurs.name'), render: (f) => <span className="font-medium text-fg">{f.nom}</span> },
    { key: 'contact', header: t('fournisseurs.contact'), render: (f) => <span className="text-fg-muted">{f.contact ?? '-'}</span> },
    { key: 'email', header: t('fournisseurs.email'), render: (f) => <span className="text-fg-muted">{f.email ?? '-'}</span> },
    { key: 'phone', header: t('fournisseurs.phone'), render: (f) => <span className="text-fg-muted">{f.telephone ?? '-'}</span> },
    { key: 'products', header: t('fournisseurs.products'), numeric: true, render: (f) => <span className="text-fg-muted">{f.produitsCount}</span> },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'center',
      width: '8rem',
      render: (f) => (
        <div className="flex items-center justify-center gap-0.5">
          <IconButton
            icon={<Truck className="h-3.5 w-3.5" />}
            label={t('fournisseurs.receiveDelivery')}
            size="xs"
            onClick={() => { setDeliveryFournisseur(f); setShowDelivery(true) }}
          />
          <IconButton
            icon={<Pencil className="h-3.5 w-3.5" />}
            label={t('common.edit')}
            size="xs"
            onClick={() => openEdit(f)}
          />
          <IconButton
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label={t('common.delete')}
            size="xs"
            variant="danger-ghost"
            onClick={() => handleDelete(f.id)}
          />
        </div>
      ),
    },
  ]

  const performanceColumns: Column<FournisseurPerformance>[] = [
    { key: 'nom', header: t('fournisseurs.name'), render: (p) => <span className="font-medium text-fg">{p.nom}</span> },
    { key: 'revenue', header: t('fournisseurs.revenue'), numeric: true, render: (p) => <span className="text-fg-muted">{formatCurrency(p.revenuTotal)}</span> },
    { key: 'profit', header: t('fournisseurs.profit'), numeric: true, render: (p) => <span className="text-fg-muted">{formatCurrency(p.beneficeTotal)}</span> },
    { key: 'margin', header: t('fournisseurs.margin'), numeric: true, render: (p) => <span className="text-fg-muted">{p.margePct.toFixed(1)}%</span> },
    { key: 'sellThrough', header: t('fournisseurs.sellThrough'), numeric: true, render: (p) => <span className="text-fg-muted">{p.tauxEcoulement.toFixed(1)}%</span> },
    { key: 'turnover', header: t('fournisseurs.turnover'), numeric: true, render: (p) => <span className="text-fg-muted">{p.rotationStock.toFixed(2)}</span> },
    { key: 'trend', header: t('fournisseurs.trend'), align: 'center', render: (p) => trendBadge(p.tendance) },
  ]

  const balanceColumns: Column<FournisseurBalance>[] = [
    { key: 'nom', header: t('fournisseurs.name'), render: (b) => <span className="font-medium text-fg">{b.fournisseurNom}</span> },
    { key: 'balance', header: t('invoices.balanceDue'), numeric: true, render: (b) => <span className="font-semibold text-fg">{formatCurrency(b.totalOwed)}</span> },
    { key: 'count', header: t('invoices.title'), numeric: true, render: (b) => <span className="text-fg-muted">{b.invoiceCount}</span> },
    {
      key: 'chevron',
      header: '',
      align: 'center',
      width: '2.5rem',
      render: () => <ChevronRight className="h-4 w-4 text-fg-subtle" />,
    },
  ]

  return (
    <Page
      section="fournisseurs"
      title={t('fournisseurs.title')}
      actions={
        tab === 'liste' ? (
          <>
            <Button
              variant="soft"
              size="sm"
              icon={<Truck className="h-4 w-4" />}
              onClick={() => {
                if (fournisseurs.length === 0) { showToast(t('common.noData'), 'error'); return }
                setDeliveryFournisseur(fournisseurs[0])
                setShowDelivery(true)
              }}
            >
              {t('fournisseurs.receiveDelivery')}
            </Button>
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              {t('fournisseurs.add')}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <Tabs
          variant="underline"
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          items={tabs.map((tb) => ({ value: tb.key, label: tb.label }))}
        />

        {loading ? (
          <SkeletonTable rows={8} cols={tab === 'factures' ? 4 : tab === 'analytique' ? 7 : 6} />
        ) : tab === 'liste' ? (
          <div className="space-y-4">
            <Toolbar>
              {!loading && (
                <Badge tone="neutral" size="sm">
                  <span className="num">{filteredFournisseurs.length}</span> {t('fournisseurs.title').toLowerCase()}
                </Badge>
              )}
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); tableSelection.clear() }}
                placeholder={t('common.search')}
                leading={<Search />}
                size="sm"
                wrapperClassName="ml-auto w-full sm:w-72"
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
                  <span className="num">{tableSelection.selected.size}</span> {t('common.selected')}
                </span>
                <Button
                  size="xs"
                  variant="danger"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={async () => {
                    if (!confirm(t('common.confirm'))) return
                    try {
                      for (const id of tableSelection.selected) {
                        await fournisseursApi.delete(id)
                      }
                      tableSelection.clear()
                      showToast(t('common.success'), 'success')
                      loadListe()
                    } catch {
                      showToast(t('common.error'), 'error')
                    }
                  }}
                >
                  {t('common.delete')}
                </Button>
                <Button size="xs" variant="ghost" className="ml-auto" onClick={tableSelection.clear}>
                  {t('common.cancel')}
                </Button>
              </div>
            )}

            {filteredFournisseurs.length === 0 ? (
              <div className="surface-glass">
                <EmptyState
                  icon={Building2}
                  variant={search ? 'search' : 'default'}
                  title={search ? 'Aucun fournisseur ne correspond' : t('common.noData')}
                  description={search ? 'Essayez un autre nom, contact ou email.' : undefined}
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
              <DataTable<Fournisseur>
                columns={fournisseurColumns}
                data={filteredFournisseurs}
                keyField={(f) => f.id}
                selection={{
                  selected: tableSelection.selected as Set<string | number>,
                  onToggle: (key) => tableSelection.toggle(Number(key)),
                  onToggleAll: () => tableSelection.toggleAll(filteredFournisseurs),
                  allSelected: tableSelection.allSelected(filteredFournisseurs),
                  someSelected: tableSelection.someSelected,
                }}
              />
            )}
          </div>
        ) : tab === 'analytique' ? (
          <div className="space-y-6">
            {recommendations.length > 0 && (
              <div className="rounded-card border border-[color-mix(in_oklab,var(--info)_28%,transparent)] bg-[var(--info-soft)] p-4">
                <h3 className="mb-2 text-sm font-semibold text-[var(--info-ink)]">{t('fournisseurs.recommendation')}</h3>
                <p className="text-sm text-[var(--info-ink)]">
                  <span className="font-semibold">{recommendations[0].nom}</span> — {t('fournisseurs.bestPerformer')} ({recommendations[0].score.toFixed(1)})
                </p>
                <p className="mt-1 text-xs text-[var(--info-ink)] opacity-80">{recommendations[0].raisons.join(' · ')}</p>
              </div>
            )}
            {performance.length === 0 ? (
              <div className="surface-glass">
                <EmptyState icon={TrendingUp} title={t('common.noData')} />
              </div>
            ) : (
              <DataTable<FournisseurPerformance>
                columns={performanceColumns}
                data={performance}
                keyField={(p) => p.id}
              />
            )}
          </div>
        ) : (
          <>
            {balances.length === 0 ? (
              <div className="surface-glass">
                <EmptyState icon={Receipt} title={t('common.noData')} />
              </div>
            ) : (
              <DataTable<FournisseurBalance>
                columns={balanceColumns}
                data={balances}
                keyField={(b) => b.fournisseurId}
                onRowClick={(b) => openFactureDetail(b)}
              />
            )}
          </>
        )}
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        size="md"
        title={editing ? t('fournisseurs.edit') : t('fournisseurs.add')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={`${t('fournisseurs.name')} *`}
            required
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
          />
          <Input
            label={t('fournisseurs.contact')}
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="email"
              label={t('fournisseurs.email')}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label={t('fournisseurs.phone')}
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
            />
          </div>
          <Input
            label={t('fournisseurs.address')}
            value={form.adresse}
            onChange={(e) => setForm({ ...form, adresse: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      {showDelivery && deliveryFournisseur && (
        <ReceiveDeliveryDialog
          fournisseurId={deliveryFournisseur.id}
          fournisseurName={deliveryFournisseur.nom}
          onClose={() => { setShowDelivery(false); setDeliveryFournisseur(null) }}
          onSuccess={() => { loadListe() }}
        />
      )}

      <Modal
        open={!!factureDetail}
        onClose={closeFactureDetail}
        size="3xl"
        title={factureDetail?.fournisseurNom}
        description={
          factureDetail ? (
            <>
              {t('invoices.balanceDue')}: <span className="font-semibold text-fg-muted">{formatCurrency(factureDetail.totalOwed)}</span>
              {' · '}
              <span className="num">{factureDetail.invoiceCount}</span> {t('invoices.title').toLowerCase()}
            </>
          ) : undefined
        }
      >
        {factureLoading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : factureInvoices.length === 0 ? (
          <div className="surface-glass">
            <EmptyState icon={Receipt} title={t('invoices.noInvoices')} compact />
          </div>
        ) : (
          <div className="surface-glass divide-y divide-border/40 overflow-hidden">
            <div className="hidden items-center gap-3 border-b border-border bg-surface-2/90 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle sm:grid sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto_auto]">
              <span>{t('invoices.invoiceNumber')}</span>
              <span>{t('invoices.date')}</span>
              <span>{t('invoices.dueDate')}</span>
              <span className="text-right">{t('invoices.total')}</span>
              <span className="text-right">{t('invoices.paid')}</span>
              <span className="text-right">{t('invoices.balanceDue')}</span>
              <span className="text-center">{t('invoices.status')}</span>
              <span className="text-center">{t('common.actions')}</span>
            </div>
            {factureInvoices.map((inv) => {
              const isOverdue = inv.status !== 'Paid' && inv.status !== 'Cancelled' && !!inv.dueDate && new Date(inv.dueDate) < new Date()
              const isExpanded = expandedInvoiceId === inv.id
              return (
                <Fragment key={inv.id}>
                  <div
                    onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                    className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:grid sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto_auto]"
                  >
                    <span className="num flex items-center gap-1.5 text-sm font-medium text-fg">
                      <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-fg-subtle transition-transform duration-fast', isExpanded && 'rotate-90')} />
                      {inv.invoiceNumber}
                    </span>
                    <span className="text-sm text-fg-muted">{formatDate(inv.invoiceDate)}</span>
                    <span className={cn('text-sm', isOverdue ? 'font-medium text-[var(--negative)]' : 'text-fg-muted')}>
                      {inv.dueDate ? formatDate(inv.dueDate) : '-'}
                    </span>
                    <span className="num text-sm text-fg-muted sm:text-right">{formatCurrency(inv.totalAmount)}</span>
                    <span className="num text-sm text-fg-muted sm:text-right">{formatCurrency(inv.paidAmount)}</span>
                    <span className="num text-sm font-semibold text-fg sm:text-right">{formatCurrency(inv.balanceDue)}</span>
                    <span className="flex justify-center">
                      <StatusBadge domain="invoice" value={inv.status} size="xs" showIcon={false} animate={false} />
                    </span>
                    <span className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                      {inv.status !== 'Cancelled' && (
                        <Button
                          size="xs"
                          variant={inv.status === 'Paid' ? 'soft' : 'success'}
                          disabled={togglingId === inv.id}
                          loading={togglingId === inv.id}
                          onClick={() => handleTogglePaid(inv)}
                        >
                          {inv.status === 'Paid' ? t('invoices.markUnpaid') : t('invoices.markPaid')}
                        </Button>
                      )}
                    </span>
                  </div>
                  {isExpanded && (
                    <div className="bg-surface-2 px-4 py-4">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div>
                          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">{t('invoices.lineItems')}</p>
                          <DataTable
                            sticky={false}
                            columns={[
                              {
                                key: 'product',
                                header: t('invoices.products'),
                                render: (li: Invoice['items'][number]) => (
                                  <span className="text-xs text-fg">
                                    {li.productName}
                                    {(li.colorName || li.sizeValue) && (
                                      <span className="text-fg-subtle"> ({[li.colorName, li.sizeValue].filter(Boolean).join(' / ')})</span>
                                    )}
                                  </span>
                                ),
                              },
                              { key: 'qty', header: 'Qté', numeric: true, render: (li: Invoice['items'][number]) => <span className="text-xs text-fg-muted">{li.quantity}</span> },
                              { key: 'unitCost', header: t('invoices.unitCost'), numeric: true, render: (li: Invoice['items'][number]) => <span className="text-xs text-fg-muted">{formatCurrency(li.unitCost)}</span> },
                              { key: 'lineTotal', header: t('invoices.lineTotal'), numeric: true, render: (li: Invoice['items'][number]) => <span className="text-xs font-medium text-fg">{formatCurrency(li.lineTotal)}</span> },
                            ]}
                            data={inv.items}
                            keyField={(li) => li.id}
                            emptyMessage="-"
                          />
                        </div>
                        <div>
                          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">{t('invoices.paymentHistory')}</p>
                          <DataTable
                            sticky={false}
                            columns={[
                              { key: 'date', header: t('invoices.paymentDate'), render: (p: Invoice['payments'][number]) => <span className="text-xs text-fg-muted">{formatDate(p.paymentDate)}</span> },
                              { key: 'method', header: t('invoices.paymentMethod'), render: (p: Invoice['payments'][number]) => <span className="text-xs text-fg-muted">{p.paymentMethod}</span> },
                              { key: 'amount', header: t('invoices.paymentAmount'), numeric: true, render: (p: Invoice['payments'][number]) => <span className="text-xs font-medium text-fg">{formatCurrency(p.amount)}</span> },
                            ]}
                            data={inv.payments}
                            keyField={(p) => p.id}
                            emptyMessage={t('invoices.noPayments')}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </Fragment>
              )
            })}
          </div>
        )}
      </Modal>
    </Page>
  )
}
