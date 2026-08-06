import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import Header from '../components/layout/Header'
import { clientsApi, settingsApi, type Client, type LoyaltySettingsConfig } from '../api/clients'
import type { Sale } from '../types/sale'
import { showToast } from '../components/shared/Toast'
import { formatCurrency, formatDate } from '../utils/format'
import { CATEGORY_BADGE, CATEGORY_LABELS, CATEGORY_ORDER, type ClientCategoryValue } from '../utils/clientCategory'
import ClientQrCard from '../components/loyalty/ClientQrCard'

type TransactionTab = 'purchases' | 'points'

export default function ClientsPage() {
  const { t } = useTranslation()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')

  const [detail, setDetail] = useState<Client | null>(null)
  const [detailTab, setDetailTab] = useState<TransactionTab>('purchases')
  const [clientSales, setClientSales] = useState<Sale[]>([])
  const [salesLoading, setSalesLoading] = useState(false)

  const [showAdjust, setShowAdjust] = useState<Client | null>(null)
  const [adjustPoints, setAdjustPoints] = useState(0)
  const [adjustReason, setAdjustReason] = useState('')

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [showQrCard, setShowQrCard] = useState<Client | null>(null)

  const [showLoyalty, setShowLoyalty] = useState(false)
  const [loyaltyForm, setLoyaltyForm] = useState<LoyaltySettingsConfig>({
    newClientRate: 5, ancientClientRate: 8, premiumClientRate: 12, pointsForRedemption: 10, dhPerRedemption: 1, welcomePoints: 50, enabled: true
  })
  const [recalculating, setRecalculating] = useState(false)

  const [categoryFilter, setCategoryFilter] = useState<ClientCategoryValue | null>(null)
  const [showCategoryEditor, setShowCategoryEditor] = useState(false)
  const [categoryChoice, setCategoryChoice] = useState<ClientCategoryValue | null>(null)
  const [categoryReason, setCategoryReason] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  const load = useCallback(async (search?: string, category?: ClientCategoryValue | null) => {
    setLoading(true)
    try {
      const data = await clientsApi.getAll(search || undefined, category ?? undefined)
      setClients(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(searchQuery, categoryFilter) }, [categoryFilter])

  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout)
    const timeout = setTimeout(() => load(searchQuery, categoryFilter), 400)
    setSearchTimeout(timeout)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  const openLoyaltySettings = async () => {
    try {
      const data = await settingsApi.getLoyalty()
      setLoyaltyForm(data)
      setShowLoyalty(true)
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleLoyaltySave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await settingsApi.updateLoyalty(loyaltyForm)
      showToast(t('loyalty.saveSuccess'), 'success')
      setShowLoyalty(false)
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleRecalculateCategories = async () => {
    setRecalculating(true)
    try {
      await clientsApi.recalculateCategories()
      showToast(t('loyalty.recalculateSuccess'), 'success')
      load(searchQuery, categoryFilter)
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setRecalculating(false)
    }
  }

  const openCategoryEditor = () => {
    if (!detail) return
    setCategoryChoice(detail.manualCategory ?? detail.effectiveCategory)
    setCategoryReason('')
    setShowCategoryEditor(true)
  }

  const handleSaveCategory = async (category: ClientCategoryValue | null) => {
    if (!detail) return
    setSavingCategory(true)
    try {
      const updated = await clientsApi.setCategory(detail.id, category, categoryReason.trim() || undefined)
      setDetail(updated)
      showToast(t('clients.categoryChangeSuccess'), 'success')
      setShowCategoryEditor(false)
      load(searchQuery, categoryFilter)
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setSavingCategory(false)
    }
  }

  const openCreate = () => {
    setEditingClient(null)
    setFormName('')
    setFormPhone('')
    setShowForm(true)
  }

  const openEdit = (client: Client) => {
    setEditingClient(client)
    setFormName(client.name)
    setFormPhone(client.phone)
    setShowForm(true)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formPhone.trim()) return
    try {
      if (editingClient) {
        await clientsApi.update(editingClient.id, { name: formName.trim(), phone: formPhone.trim() })
        showToast(t('clients.updateSuccess'), 'success')
      } else {
        await clientsApi.create({ name: formName.trim(), phone: formPhone.trim() })
        showToast(t('clients.createSuccess'), 'success')
        showToast(t('clients.welcomePoints'), 'success')
      }
      setShowForm(false)
      load(searchQuery)
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleDelete = async () => {
    if (!showDeleteConfirm) return
    setDeleting(true)
    try {
      await clientsApi.delete(showDeleteConfirm.id)
      showToast(t('clients.deleteSuccess'), 'success')
      setShowDeleteConfirm(null)
      load(searchQuery)
    } catch {
      showToast(t('clients.deleteError'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const openDetail = async (client: Client) => {
    try {
      const full = await clientsApi.getById(client.id)
      setDetail(full)
      setDetailTab('purchases')
      setSalesLoading(true)
      try {
        const sales = await clientsApi.getSales(client.id)
        setClientSales(sales)
      } finally {
        setSalesLoading(false)
      }
    } catch {
      setDetail(client)
      setDetailTab('purchases')
      setClientSales([])
    }
  }

  const openAdjust = (client: Client) => {
    setShowAdjust(client)
    setAdjustPoints(0)
    setAdjustReason('')
  }

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showAdjust || adjustPoints === 0) return
    try {
      await clientsApi.adjustPoints(showAdjust.id, adjustPoints, adjustReason.trim() || undefined)
      showToast(t('clients.adjustSuccess'), 'success')
      setShowAdjust(null)
      load(searchQuery)
      if (detail?.id === showAdjust.id) {
        const updated = await clientsApi.getById(showAdjust.id)
        setDetail(updated)
        const sales = await clientsApi.getSales(showAdjust.id)
        setClientSales(sales)
      }
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const pointsHistory = detail?.recentTransactions ?? []

  const txTypeBadge = (type: string) => {
    const styleMap: Record<string, string> = {
      Welcome: 'bg-violet-50 text-violet-700 border border-violet-200',
      Earn: 'bg-blue-50 text-blue-700 border border-blue-200',
      Redeem: 'bg-amber-50 text-amber-700 border border-amber-200',
      Adjust: 'bg-slate-100 text-slate-600 border border-slate-200',
    }
    const labelMap: Record<string, string> = {
      Welcome: t('clients.typeWelcome'),
      Earn: t('clients.typeEarn'),
      Redeem: t('clients.typeRedeem'),
      Adjust: t('clients.typeAdjust'),
    }
    return (
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styleMap[type] ?? 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
        {labelMap[type] ?? type}
      </span>
    )
  }

  return (
    <div className="flex flex-col flex-1">
      <Header
        title={t('clients.title')}
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={openLoyaltySettings}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m6-6H6" />
              </svg>
              {t('loyalty.title')}
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('clients.add')}
            </button>
          </div>
        }
      />
      <div className="p-6 flex-1 space-y-6">

        <div className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('clients.search')}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md p-1">
            <button
              onClick={() => setCategoryFilter(null)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                categoryFilter === null ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t('clients.categoryAll')}
            </button>
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  categoryFilter === cat ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-sm text-slate-500">{t('common.loading')}</span>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('clients.name')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('clients.phone')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('clients.category')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('clients.points')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('clients.totalSpent')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('clients.visits')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('clients.lastVisit')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-sm text-slate-400">{t('clients.noClients')}</td></tr>
                )}
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{client.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{client.phone}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${CATEGORY_BADGE[client.effectiveCategory]}`}>
                        {CATEGORY_LABELS[client.effectiveCategory]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{client.totalPoints}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600">{formatCurrency(client.totalSpent)}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                        {client.visitCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {client.lastVisitAt ? formatDate(client.lastVisitAt) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openDetail(client)}
                          className="text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors px-2 py-1 rounded hover:bg-slate-100"
                        >
                          {t('clients.viewDetail')}
                        </button>
                        <button
                          onClick={() => setShowQrCard(client)}
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors px-2 py-1 rounded hover:bg-emerald-50"
                        >
                          {t('clients.qrCard')}
                        </button>
                        <button
                          onClick={() => openEdit(client)}
                          className="text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors px-2 py-1 rounded hover:bg-slate-100"
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(client)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors px-2 py-1 rounded hover:bg-red-50"
                        >
                          {t('clients.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-[480px] max-h-[90vh] overflow-auto border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-5">
              {editingClient ? t('clients.edit') : t('clients.add')}
            </h2>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('clients.name')} *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t('clients.namePlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('clients.phone')} *</label>
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder={t('clients.phonePlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  {editingClient ? t('common.update') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-[420px] border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">{t('clients.delete')}</h2>
            <p className="text-sm text-slate-600 mb-2">{t('clients.deleteConfirm')}</p>
            <p className="text-sm text-slate-500 mb-5">{t('clients.deleteWarning')}</p>
            <p className="text-sm font-medium text-slate-800 mb-5">{showDeleteConfirm.name} — {showDeleteConfirm.phone}</p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? t('common.loading') : t('clients.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-[720px] max-h-[90vh] overflow-hidden border border-slate-200 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">{detail.name}</h3>
                    <button
                      onClick={openCategoryEditor}
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border hover:opacity-75 transition-opacity ${CATEGORY_BADGE[detail.effectiveCategory]}`}
                      title={t('clients.changeCategory')}
                    >
                      {CATEGORY_LABELS[detail.effectiveCategory]}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">{detail.phone}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 flex items-center gap-3">
                  {detail.qrCode && (
                    <QRCodeSVG
                      value={detail.qrCode}
                      size={48}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  )}
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-medium mb-0.5">{t('clients.qrCode')}</p>
                    <p className="font-mono text-xs text-slate-700 select-all">{detail.qrCode}</p>
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  <span>{t('clients.memberSince')}: {formatDate(detail.createdAt)}</span>
                </div>
              </div>
              <button onClick={() => { setDetail(null); setClientSales([]) }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              <div className="px-6 pt-5 pb-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <p className="text-xs font-medium text-blue-600 uppercase">{t('clients.pointsAvailable')}</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">{detail.totalPoints}</p>
                  </div>
                  <div className="bg-violet-50 border border-violet-100 rounded-lg p-4">
                    <p className="text-xs font-medium text-violet-600 uppercase">{t('clients.lifetimePoints')}</p>
                    <p className="text-2xl font-bold text-violet-900 mt-1">{detail.lifetimePoints}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                    <p className="text-xs font-medium text-emerald-600 uppercase">{t('clients.totalSpent')}</p>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">{formatCurrency(detail.totalSpent)}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                    <p className="text-xs font-medium text-amber-600 uppercase">{t('clients.totalVisits')}</p>
                    <p className="text-2xl font-bold text-amber-900 mt-1">{detail.visitCount}</p>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-2">
                <div className="flex items-center gap-1 border-b border-slate-200">
                  <button
                    onClick={() => setDetailTab('purchases')}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      detailTab === 'purchases'
                        ? 'text-blue-600 border-blue-600'
                        : 'text-slate-500 border-transparent hover:text-slate-700'
                    }`}
                  >
                    {t('clients.purchaseHistory')}
                  </button>
                  <button
                    onClick={() => setDetailTab('points')}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      detailTab === 'points'
                        ? 'text-blue-600 border-blue-600'
                        : 'text-slate-500 border-transparent hover:text-slate-700'
                    }`}
                  >
                    {t('clients.pointsHistory')}
                  </button>
                </div>
              </div>

              <div className="px-6 pb-5">
                {detailTab === 'purchases' && (
                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mt-3">
                    {salesLoading ? (
                      <div className="text-center py-6 text-sm text-slate-400">{t('common.loading')}</div>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50">
                            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('clients.saleDate')}</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('clients.saleNumber')}</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('clients.saleAmount')}</th>
                            <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('clients.pointsEarned')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {clientSales.length === 0 && (
                            <tr><td colSpan={4} className="text-center py-6 text-sm text-slate-400">{t('clients.noPurchases')}</td></tr>
                          )}
                          {clientSales.map((sale) => (
                            <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-sm text-slate-600">{formatDate(sale.createdAt)}</td>
                              <td className="px-4 py-3 text-sm text-slate-600 font-mono">{sale.saleNumber}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">{formatCurrency(sale.totalAmount)}</td>
                              <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-600">+{sale.loyaltyPointsEarned}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {detailTab === 'points' && (
                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mt-3">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('clients.txDate')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('clients.transactionType')}</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('clients.pointsChange')}</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('clients.description')}</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('clients.balanceAfter')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pointsHistory.length === 0 && (
                          <tr><td colSpan={5} className="text-center py-6 text-sm text-slate-400">{t('clients.noTransactions')}</td></tr>
                        )}
                        {pointsHistory.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-slate-600">{formatDate(tx.createdAt)}</td>
                            <td className="px-4 py-3 text-sm">{txTypeBadge(tx.type)}</td>
                            <td className={`px-4 py-3 text-sm text-right font-semibold ${tx.pointsChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {tx.pointsChange >= 0 ? '+' : ''}{tx.pointsChange}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-500">{tx.description ?? '-'}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-slate-700">{tx.balanceAfter}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => openAdjust(detail)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m6-6H6" />
                </svg>
                {t('clients.adjustPoints')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Points Modal */}
      {showAdjust && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-[420px] border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">{t('clients.adjustPoints')}</h2>
            <p className="text-sm text-slate-500 mb-5">{showAdjust.name} — {showAdjust.phone}</p>
            <form onSubmit={handleAdjust} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('clients.pointsValue')} *</label>
                <input
                  type="number"
                  required
                  value={adjustPoints || ''}
                  onChange={(e) => setAdjustPoints(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-400 mt-1">{t('clients.pointsHint')}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('clients.reason')}</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder={t('clients.reasonPlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjust(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={adjustPoints === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Editor Modal */}
      {showCategoryEditor && detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-[420px] border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">{t('clients.changeCategory')}</h2>
            <p className="text-sm text-slate-500 mb-5">{detail.name} — {detail.phone}</p>

            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md p-1 mb-2">
              {CATEGORY_ORDER.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryChoice(cat)}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                    categoryChoice === cat ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {detail.manualCategory ? (
              <p className="text-xs text-slate-400 mb-4">
                {t('clients.categorySuggestion', { category: CATEGORY_LABELS[detail.computedCategory] })}
              </p>
            ) : (
              <p className="text-xs text-slate-400 mb-4">{t('clients.categoryAuto')}</p>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('clients.reason')}</label>
              <input
                type="text"
                value={categoryReason}
                onChange={(e) => setCategoryReason(e.target.value)}
                placeholder={t('clients.categoryReasonPlaceholder')}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-2 justify-between pt-2">
              <button
                type="button"
                disabled={savingCategory || !detail.manualCategory}
                onClick={() => handleSaveCategory(null)}
                className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('clients.categoryAuto')}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryEditor(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={savingCategory || !categoryChoice}
                  onClick={() => handleSaveCategory(categoryChoice)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR / WhatsApp Card */}
      {showQrCard && (
        <ClientQrCard
          client={showQrCard}
          title={t('clients.qrCardTitle')}
          subtitle={showQrCard.phone}
          closeLabel={t('common.close')}
          onClose={() => setShowQrCard(null)}
        />
      )}

      {/* Loyalty Settings Modal */}
      {showLoyalty && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-[480px] border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-5">{t('loyalty.title')}</h2>
            <form onSubmit={handleLoyaltySave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('loyalty.newClientRate')}</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={loyaltyForm.newClientRate}
                    onChange={(e) => setLoyaltyForm({ ...loyaltyForm, newClientRate: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-400 mt-1">% sur 100 DH</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('loyalty.ancientClientRate')}</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={loyaltyForm.ancientClientRate}
                    onChange={(e) => setLoyaltyForm({ ...loyaltyForm, ancientClientRate: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-400 mt-1">% sur 100 DH</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('loyalty.premiumClientRate')}</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={loyaltyForm.premiumClientRate}
                    onChange={(e) => setLoyaltyForm({ ...loyaltyForm, premiumClientRate: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-400 mt-1">% sur 100 DH</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('loyalty.welcomePoints')}</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={loyaltyForm.welcomePoints}
                    onChange={(e) => setLoyaltyForm({ ...loyaltyForm, welcomePoints: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('loyalty.pointsForRedemption')}</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={loyaltyForm.pointsForRedemption}
                    onChange={(e) => setLoyaltyForm({ ...loyaltyForm, pointsForRedemption: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="loyaltyEnabled"
                  checked={loyaltyForm.enabled}
                  onChange={(e) => setLoyaltyForm({ ...loyaltyForm, enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="loyaltyEnabled" className="text-sm font-medium text-slate-700">{t('loyalty.enabled')}</label>
              </div>
              <div className="flex gap-2 justify-between items-center pt-2">
                <button
                  type="button"
                  disabled={recalculating}
                  onClick={handleRecalculateCategories}
                  className="px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {recalculating ? t('common.loading') : t('loyalty.recalculateCategories')}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLoyalty(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {t('loyalty.updateSettings')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}