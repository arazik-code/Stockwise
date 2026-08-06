import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/layout/Header'
import { fournisseursApi } from '../api/fournisseurs'
import { invoicesApi } from '../api/invoices'
import { showToast } from '../components/shared/Toast'
import { formatCurrency, formatDate } from '../utils/format'
import { useTableSelection } from '../hooks/useTableSelection'
import ReceiveDeliveryDialog from '../components/fournisseurs/ReceiveDeliveryDialog'
import type {
  Fournisseur,
  CreateFournisseurRequest,
  FournisseurPerformance,
  FournisseurRecommendation,
} from '../types/fournisseur'
import type { FournisseurBalance, Invoice, InvoiceStatus } from '../types/invoice'

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
    if (trend === 'hausse') return <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{t('fournisseurs.trendUp')}</span>
    if (trend === 'baisse') return <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded">{t('fournisseurs.trendDown')}</span>
    return <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{t('fournisseurs.trendStable')}</span>
  }

  const invoiceStatusStyle: Record<InvoiceStatus, string> = {
    Pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    Paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    PartiallyPaid: 'bg-blue-50 text-blue-700 border border-blue-200',
    Overdue: 'bg-red-50 text-red-700 border border-red-200',
    Cancelled: 'bg-slate-100 text-slate-500 border border-slate-200',
    Received: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  }
  const invoiceStatusLabel: Record<InvoiceStatus, string> = {
    Pending: t('invoices.statuses.pending'),
    Paid: t('invoices.statuses.paid'),
    PartiallyPaid: t('invoices.statuses.partiallyPaid'),
    Overdue: t('invoices.statuses.overdue'),
    Cancelled: t('invoices.statuses.cancelled'),
    Received: t('invoices.statuses.received'),
  }
  const invoiceStatusBadge = (status: InvoiceStatus) => (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${invoiceStatusStyle[status]}`}>
      {invoiceStatusLabel[status]}
    </span>
  )

  return (
    <div className="flex flex-col flex-1">
      <Header
        title={t('fournisseurs.title')}
        actions={
          tab === 'liste' ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (fournisseurs.length === 0) { showToast(t('common.noData'), 'error'); return }
                  setDeliveryFournisseur(fournisseurs[0])
                  setShowDelivery(true)
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t('fournisseurs.receiveDelivery')}
              </button>
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('fournisseurs.add')}
              </button>
            </div>
          ) : undefined
        }
      />
      <div className="p-6 flex-1">
        <div className="mb-4 flex gap-1 border-b border-slate-200">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === tb.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
        ) : tab === 'liste' ? (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <input
                type="text"
                placeholder={t('common.search')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); tableSelection.clear() }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {tableSelection.selected.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border-b border-blue-100 text-sm">
                <span className="font-medium text-blue-800">{tableSelection.selected.size} {t('common.selected')}</span>
                <button
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
                  className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
                >
                  {t('common.delete')}
                </button>
              </div>
            )}
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filteredFournisseurs.length > 0 && filteredFournisseurs.every((f) => tableSelection.isSelected(f.id))}
                      onChange={() => tableSelection.toggleAll(filteredFournisseurs)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('fournisseurs.name')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('fournisseurs.contact')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('fournisseurs.email')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('fournisseurs.phone')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('fournisseurs.products')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFournisseurs.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-sm text-slate-400">{t('common.noData')}</td></tr>
                )}
                {filteredFournisseurs.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={tableSelection.isSelected(f.id)}
                        onChange={() => tableSelection.toggle(f.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{f.nom}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{f.contact ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{f.email ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{f.telephone ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600">{f.produitsCount}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setDeliveryFournisseur(f); setShowDelivery(true) }}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium transition-colors"
                        >
                          {t('fournisseurs.receiveDelivery')}
                        </button>
                        <span className="text-slate-200">|</span>
                        <button onClick={() => openEdit(f)} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                          {t('common.edit')}
                        </button>
                        <span className="text-slate-200">|</span>
                        <button onClick={() => handleDelete(f.id)} className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors">
                          {t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'analytique' ? (
          <div className="space-y-6">
            {recommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">{t('fournisseurs.recommendation')}</h3>
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">{recommendations[0].nom}</span> — {t('fournisseurs.bestPerformer')} ({recommendations[0].score.toFixed(1)})
                </p>
                <p className="text-xs text-blue-700 mt-1">{recommendations[0].raisons.join(' · ')}</p>
              </div>
            )}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('fournisseurs.name')}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('fournisseurs.revenue')}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('fournisseurs.profit')}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('fournisseurs.margin')}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('fournisseurs.sellThrough')}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('fournisseurs.turnover')}</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('fournisseurs.trend')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {performance.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-sm text-slate-400">{t('common.noData')}</td></tr>
                  )}
                  {performance.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{p.nom}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-600">{formatCurrency(p.revenuTotal)}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-600">{formatCurrency(p.beneficeTotal)}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-600">{p.margePct.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-600">{p.tauxEcoulement.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-600">{p.rotationStock.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-center">{trendBadge(p.tendance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('fournisseurs.name')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('invoices.balanceDue')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('invoices.title')}</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {balances.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-sm text-slate-400">{t('common.noData')}</td></tr>
                )}
                {balances.map((b) => (
                  <tr
                    key={b.fournisseurId}
                    onClick={() => openFactureDetail(b)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{b.fournisseurNom}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{formatCurrency(b.totalOwed)}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600">{b.invoiceCount}</td>
                    <td className="px-4 py-3 text-slate-300">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[440px] border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-5">
              {editing ? t('fournisseurs.edit') : t('fournisseurs.add')}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('fournisseurs.name')} *</label>
                <input
                  type="text"
                  required
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('fournisseurs.contact')}</label>
                <input
                  type="text"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('fournisseurs.email')}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('fournisseurs.phone')}</label>
                  <input
                    type="text"
                    value={form.telephone}
                    onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('fournisseurs.address')}</label>
                <input
                  type="text"
                  value={form.adresse}
                  onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDelivery && deliveryFournisseur && (
        <ReceiveDeliveryDialog
          fournisseurId={deliveryFournisseur.id}
          fournisseurName={deliveryFournisseur.nom}
          onClose={() => { setShowDelivery(false); setDeliveryFournisseur(null) }}
          onSuccess={() => { loadListe() }}
        />
      )}

      {/* Fournisseur Facture Detail Modal */}
      {factureDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[900px] max-h-[85vh] overflow-hidden border border-slate-200 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{factureDetail.fournisseurNom}</h3>
                <p className="text-xs text-slate-500">
                  {t('invoices.balanceDue')}: <span className="font-semibold text-slate-700">{formatCurrency(factureDetail.totalOwed)}</span>
                  {' · '}
                  {factureDetail.invoiceCount} {t('invoices.title').toLowerCase()}
                </p>
              </div>
              <button onClick={closeFactureDetail} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {factureLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('invoices.invoiceNumber')}</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('invoices.date')}</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('invoices.dueDate')}</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('invoices.total')}</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('invoices.paid')}</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('invoices.balanceDue')}</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('invoices.status')}</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {factureInvoices.length === 0 && (
                      <tr><td colSpan={8} className="text-center py-8 text-sm text-slate-400">{t('invoices.noInvoices')}</td></tr>
                    )}
                    {factureInvoices.map((inv) => {
                      const isOverdue = inv.status !== 'Paid' && inv.status !== 'Cancelled' && !!inv.dueDate && new Date(inv.dueDate) < new Date()
                      const isExpanded = expandedInvoiceId === inv.id
                      return (
                        <Fragment key={inv.id}>
                          <tr
                            onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                            className="hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-3 text-sm font-medium text-slate-900 font-mono">{inv.invoiceNumber}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{formatDate(inv.invoiceDate)}</td>
                            <td className={`px-4 py-3 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                              {inv.dueDate ? formatDate(inv.dueDate) : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-slate-600">{formatCurrency(inv.totalAmount)}</td>
                            <td className="px-4 py-3 text-sm text-right text-slate-600">{formatCurrency(inv.paidAmount)}</td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{formatCurrency(inv.balanceDue)}</td>
                            <td className="px-4 py-3 text-center">{invoiceStatusBadge(inv.status)}</td>
                            <td className="px-4 py-3 text-center">
                              {inv.status !== 'Cancelled' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleTogglePaid(inv) }}
                                  disabled={togglingId === inv.id}
                                  className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors disabled:opacity-50 ${
                                    inv.status === 'Paid'
                                      ? 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                                      : 'text-white bg-emerald-600 hover:bg-emerald-700'
                                  }`}
                                >
                                  {togglingId === inv.id
                                    ? t('common.loading')
                                    : inv.status === 'Paid' ? t('invoices.markUnpaid') : t('invoices.markPaid')}
                                </button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50">
                              <td colSpan={8} className="px-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-[10px] font-medium text-slate-400 uppercase mb-2">{t('invoices.lineItems')}</p>
                                    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="border-b border-slate-100 bg-slate-50">
                                            <th className="text-left px-3 py-2 font-medium text-slate-500">{t('invoices.products')}</th>
                                            <th className="text-right px-3 py-2 font-medium text-slate-500">Qté</th>
                                            <th className="text-right px-3 py-2 font-medium text-slate-500">{t('invoices.unitCost')}</th>
                                            <th className="text-right px-3 py-2 font-medium text-slate-500">{t('invoices.lineTotal')}</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {inv.items.length === 0 && (
                                            <tr><td colSpan={4} className="text-center py-3 text-slate-400">-</td></tr>
                                          )}
                                          {inv.items.map((li) => (
                                            <tr key={li.id}>
                                              <td className="px-3 py-2 text-slate-700">
                                                {li.productName}
                                                {(li.colorName || li.sizeValue) && (
                                                  <span className="text-slate-400"> ({[li.colorName, li.sizeValue].filter(Boolean).join(' / ')})</span>
                                                )}
                                              </td>
                                              <td className="px-3 py-2 text-right text-slate-600">{li.quantity}</td>
                                              <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(li.unitCost)}</td>
                                              <td className="px-3 py-2 text-right font-medium text-slate-700">{formatCurrency(li.lineTotal)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-medium text-slate-400 uppercase mb-2">{t('invoices.paymentHistory')}</p>
                                    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="border-b border-slate-100 bg-slate-50">
                                            <th className="text-left px-3 py-2 font-medium text-slate-500">{t('invoices.paymentDate')}</th>
                                            <th className="text-left px-3 py-2 font-medium text-slate-500">{t('invoices.paymentMethod')}</th>
                                            <th className="text-right px-3 py-2 font-medium text-slate-500">{t('invoices.paymentAmount')}</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {inv.payments.length === 0 && (
                                            <tr><td colSpan={3} className="text-center py-3 text-slate-400">{t('invoices.noPayments')}</td></tr>
                                          )}
                                          {inv.payments.map((p) => (
                                            <tr key={p.id}>
                                              <td className="px-3 py-2 text-slate-600">{formatDate(p.paymentDate)}</td>
                                              <td className="px-3 py-2 text-slate-600">{p.paymentMethod}</td>
                                              <td className="px-3 py-2 text-right font-medium text-slate-700">{formatCurrency(p.amount)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
