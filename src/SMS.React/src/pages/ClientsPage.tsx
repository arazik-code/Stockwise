import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { Plus, Search, Sparkles } from 'lucide-react'
import { clientsApi, settingsApi, type Client, type LoyaltySettingsConfig } from '../api/clients'
import type { Sale } from '../types/sale'
import { showToast } from '../components/shared/Toast'
import { formatCurrency, formatDate } from '../utils/format'
import { CATEGORY_LABELS, CATEGORY_ORDER, type ClientCategoryValue } from '../utils/clientCategory'
import ClientQrCard from '../components/loyalty/ClientQrCard'
import {
  Button, Checkbox, ConfirmDialog, DataTable, Input, Modal, Page,
  StatCard, StatusBadge, Tabs, type Column,
} from '../components/ui'

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

  const columns: Column<Client>[] = [
    { key: 'name', header: t('clients.name'), render: (c) => <span className="font-medium text-fg">{c.name}</span> },
    { key: 'phone', header: t('clients.phone'), render: (c) => <span className="num text-fg-muted">{c.phone}</span> },
    {
      key: 'category',
      header: t('clients.category'),
      render: (c) => <StatusBadge domain="clientTier" value={c.effectiveCategory} animate={false} size="xs" />,
    },
    { key: 'points', header: t('clients.points'), numeric: true, render: (c) => <span className="num font-semibold text-fg">{c.totalPoints}</span> },
    { key: 'spent', header: t('clients.totalSpent'), numeric: true, render: (c) => <span className="num text-fg-muted">{formatCurrency(c.totalSpent)}</span> },
    {
      key: 'visits',
      header: t('clients.visits'),
      align: 'center',
      render: (c) => (
        <span className="num inline-flex h-7 w-7 items-center justify-center rounded-chip bg-sunken text-xs font-medium text-fg-muted">
          {c.visitCount}
        </span>
      ),
    },
    { key: 'lastVisit', header: t('clients.lastVisit'), render: (c) => <span className="text-fg-muted">{c.lastVisitAt ? formatDate(c.lastVisitAt) : '—'}</span> },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'center',
      render: (c) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="xs" variant="ghost" onClick={() => setShowQrCard(c)}>{t('clients.qrCard')}</Button>
          <Button size="xs" variant="ghost" onClick={() => openEdit(c)}>{t('common.edit')}</Button>
          <Button size="xs" variant="danger-ghost" onClick={() => setShowDeleteConfirm(c)}>{t('clients.delete')}</Button>
        </div>
      ),
    },
  ]

  return (
    <Page
      section="clients"
      title={t('clients.title')}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" icon={<Sparkles className="h-4 w-4" />} onClick={openLoyaltySettings}>
            {t('loyalty.title')}
          </Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            {t('clients.add')}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('clients.search')}
            leading={<Search />}
            wrapperClassName="flex-1"
          />
          <Tabs
            variant="segmented"
            layoutGroupId="clients-category-filter"
            value={categoryFilter ?? '__all'}
            onChange={(v) => setCategoryFilter(v === '__all' ? null : (v as ClientCategoryValue))}
            items={[
              { value: '__all', label: t('clients.categoryAll') },
              ...CATEGORY_ORDER.map((cat) => ({ value: cat, label: CATEGORY_LABELS[cat] })),
            ]}
          />
        </div>

        <DataTable
          columns={columns}
          data={clients}
          keyField={(c) => c.id}
          loading={loading}
          onRowClick={(c) => openDetail(c)}
          emptyMessage={t('clients.noClients')}
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingClient ? t('clients.edit') : t('clients.add')}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            <Button type="submit" form="client-form">
              {editingClient ? t('common.update') : t('common.save')}
            </Button>
          </>
        }
      >
        <form id="client-form" onSubmit={handleFormSubmit} className="space-y-4">
          <Input
            label={`${t('clients.name')} *`}
            required
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder={t('clients.namePlaceholder')}
          />
          <Input
            label={`${t('clients.phone')} *`}
            required
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
            placeholder={t('clients.phonePlaceholder')}
          />
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!showDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(null)}
        onConfirm={handleDelete}
        variant="danger"
        loading={deleting}
        title={t('clients.delete')}
        message={
          <>
            {t('clients.deleteConfirm')} {t('clients.deleteWarning')}
            <br />
            <span className="font-medium text-fg">{showDeleteConfirm?.name} — {showDeleteConfirm?.phone}</span>
          </>
        }
        confirmLabel={deleting ? t('common.loading') : t('clients.delete')}
        cancelLabel={t('common.cancel')}
      />

      {/* Detail Modal */}
      <Modal
        open={!!detail}
        onClose={() => { setDetail(null); setClientSales([]) }}
        size="2xl"
        bodyClassName="px-0 py-0"
        title={
          detail && (
            <div className="flex items-center gap-2">
              <span>{detail.name}</span>
              <button
                onClick={openCategoryEditor}
                className="transition-opacity hover:opacity-75"
                title={t('clients.changeCategory')}
              >
                <StatusBadge domain="clientTier" value={detail.effectiveCategory} animate={false} size="xs" />
              </button>
            </div>
          )
        }
        description={detail?.phone}
        footer={
          detail && (
            <Button variant="outline" onClick={() => openAdjust(detail)}>
              {t('clients.adjustPoints')}
            </Button>
          )
        }
      >
        {detail && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div className="flex items-center gap-3 rounded-field bg-sunken px-3 py-2">
                {detail.qrCode && <QRCodeSVG value={detail.qrCode} size={44} level="M" bgColor="transparent" fgColor="currentColor" className="text-fg" />}
                <div>
                  <p className="text-[10px] font-medium uppercase text-fg-subtle">{t('clients.qrCode')}</p>
                  <p className="num select-all font-mono text-xs text-fg-muted">{detail.qrCode}</p>
                </div>
              </div>
              <span className="text-xs text-fg-subtle">{t('clients.memberSince')}: {formatDate(detail.createdAt)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-4">
              <StatCard label={t('clients.pointsAvailable')} value={detail.totalPoints.toString()} tone="info" />
              <StatCard label={t('clients.lifetimePoints')} value={detail.lifetimePoints.toString()} tone="special" />
              <StatCard label={t('clients.totalSpent')} value={formatCurrency(detail.totalSpent)} tone="positive" />
              <StatCard label={t('clients.totalVisits')} value={detail.visitCount.toString()} tone="caution" />
            </div>

            <div className="px-5">
              <Tabs
                variant="underline"
                layoutGroupId="client-detail-tab"
                value={detailTab}
                onChange={(v) => setDetailTab(v as TransactionTab)}
                items={[
                  { value: 'purchases', label: t('clients.purchaseHistory') },
                  { value: 'points', label: t('clients.pointsHistory') },
                ]}
              />
            </div>

            <div className="px-5 pb-5 pt-3">
              {detailTab === 'purchases' && (
                <DataTable
                  loading={salesLoading}
                  emptyMessage={t('clients.noPurchases')}
                  keyField={(s) => s.id}
                  data={clientSales}
                  columns={[
                    { key: 'date', header: t('clients.saleDate'), render: (s) => <span className="text-fg-muted">{formatDate(s.createdAt)}</span> },
                    { key: 'number', header: t('clients.saleNumber'), render: (s) => <span className="num font-mono text-fg-muted">{s.saleNumber}</span> },
                    { key: 'amount', header: t('clients.saleAmount'), render: (s) => <span className="num text-fg-muted">{formatCurrency(s.totalAmount)}</span> },
                    { key: 'earned', header: t('clients.pointsEarned'), numeric: true, render: (s) => <span className="num font-semibold text-[var(--positive)]">+{s.loyaltyPointsEarned}</span> },
                  ]}
                />
              )}
              {detailTab === 'points' && (
                <DataTable
                  emptyMessage={t('clients.noTransactions')}
                  keyField={(tx) => tx.id}
                  data={pointsHistory}
                  columns={[
                    { key: 'date', header: t('clients.txDate'), render: (tx) => <span className="text-fg-muted">{formatDate(tx.createdAt)}</span> },
                    { key: 'type', header: t('clients.transactionType'), render: (tx) => <StatusBadge domain="loyaltyTx" value={tx.type} animate={false} size="xs" /> },
                    {
                      key: 'change',
                      header: t('clients.pointsChange'),
                      numeric: true,
                      render: (tx) => (
                        <span className={`num font-semibold ${tx.pointsChange >= 0 ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}`}>
                          {tx.pointsChange >= 0 ? '+' : ''}{tx.pointsChange}
                        </span>
                      ),
                    },
                    { key: 'desc', header: t('clients.description'), render: (tx) => <span className="text-fg-subtle">{tx.description ?? '—'}</span> },
                    { key: 'balance', header: t('clients.balanceAfter'), numeric: true, render: (tx) => <span className="num font-medium text-fg-muted">{tx.balanceAfter}</span> },
                  ]}
                />
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Adjust Points */}
      <Modal
        open={!!showAdjust}
        onClose={() => setShowAdjust(null)}
        title={t('clients.adjustPoints')}
        description={showAdjust ? `${showAdjust.name} — ${showAdjust.phone}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowAdjust(null)}>{t('common.cancel')}</Button>
            <Button disabled={adjustPoints === 0} type="submit" form="adjust-form">{t('common.confirm')}</Button>
          </>
        }
      >
        <form id="adjust-form" onSubmit={handleAdjust} className="space-y-4">
          <div>
            <Input
              type="number"
              label={`${t('clients.pointsValue')} *`}
              required
              value={adjustPoints || ''}
              onChange={(e) => setAdjustPoints(parseInt(e.target.value) || 0)}
              placeholder="0"
            />
            <p className="mt-1 text-xs text-fg-subtle">{t('clients.pointsHint')}</p>
          </div>
          <Input
            label={t('clients.reason')}
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
            placeholder={t('clients.reasonPlaceholder')}
          />
        </form>
      </Modal>

      {/* Category Editor */}
      <Modal
        open={showCategoryEditor && !!detail}
        onClose={() => setShowCategoryEditor(false)}
        title={t('clients.changeCategory')}
        description={detail ? `${detail.name} — ${detail.phone}` : undefined}
        size="sm"
        footer={
          <div className="flex w-full items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              disabled={savingCategory || !detail?.manualCategory}
              onClick={() => handleSaveCategory(null)}
            >
              {t('clients.categoryAuto')}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCategoryEditor(false)}>{t('common.cancel')}</Button>
              <Button disabled={savingCategory || !categoryChoice} loading={savingCategory} onClick={() => handleSaveCategory(categoryChoice)}>
                {t('common.confirm')}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <Tabs
            variant="segmented"
            layoutGroupId="category-choice"
            value={categoryChoice ?? ''}
            onChange={(v) => setCategoryChoice(v as ClientCategoryValue)}
            items={CATEGORY_ORDER.map((cat) => ({ value: cat, label: CATEGORY_LABELS[cat] }))}
          />
          {detail?.manualCategory ? (
            <p className="text-xs text-fg-subtle">
              {t('clients.categorySuggestion', { category: CATEGORY_LABELS[detail.computedCategory] })}
            </p>
          ) : (
            <p className="text-xs text-fg-subtle">{t('clients.categoryAuto')}</p>
          )}
          <Input
            label={t('clients.reason')}
            value={categoryReason}
            onChange={(e) => setCategoryReason(e.target.value)}
            placeholder={t('clients.categoryReasonPlaceholder')}
          />
        </div>
      </Modal>

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

      {/* Loyalty Settings */}
      <Modal
        open={showLoyalty}
        onClose={() => setShowLoyalty(false)}
        title={t('loyalty.title')}
        size="md"
        footer={
          <div className="flex w-full items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              disabled={recalculating}
              loading={recalculating}
              onClick={handleRecalculateCategories}
            >
              {t('loyalty.recalculateCategories')}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowLoyalty(false)}>{t('common.cancel')}</Button>
              <Button type="submit" form="loyalty-form">{t('loyalty.updateSettings')}</Button>
            </div>
          </div>
        }
      >
        <form id="loyalty-form" onSubmit={handleLoyaltySave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                type="number"
                label={t('loyalty.newClientRate')}
                required
                min={0}
                value={loyaltyForm.newClientRate}
                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, newClientRate: parseInt(e.target.value) || 0 })}
              />
              <p className="mt-1 text-xs text-fg-subtle">% sur 100 DH</p>
            </div>
            <div>
              <Input
                type="number"
                label={t('loyalty.ancientClientRate')}
                required
                min={0}
                value={loyaltyForm.ancientClientRate}
                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, ancientClientRate: parseInt(e.target.value) || 0 })}
              />
              <p className="mt-1 text-xs text-fg-subtle">% sur 100 DH</p>
            </div>
            <div>
              <Input
                type="number"
                label={t('loyalty.premiumClientRate')}
                required
                min={0}
                value={loyaltyForm.premiumClientRate}
                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, premiumClientRate: parseInt(e.target.value) || 0 })}
              />
              <p className="mt-1 text-xs text-fg-subtle">% sur 100 DH</p>
            </div>
            <Input
              type="number"
              label={t('loyalty.welcomePoints')}
              required
              min={0}
              value={loyaltyForm.welcomePoints}
              onChange={(e) => setLoyaltyForm({ ...loyaltyForm, welcomePoints: parseInt(e.target.value) || 0 })}
            />
            <Input
              type="number"
              label={t('loyalty.pointsForRedemption')}
              required
              min={1}
              value={loyaltyForm.pointsForRedemption}
              onChange={(e) => setLoyaltyForm({ ...loyaltyForm, pointsForRedemption: parseInt(e.target.value) || 1 })}
            />
          </div>
          <Checkbox
            checked={loyaltyForm.enabled}
            onChange={(e) => setLoyaltyForm({ ...loyaltyForm, enabled: e.target.checked })}
            label={t('loyalty.enabled')}
          />
        </form>
      </Modal>
    </Page>
  )
}
