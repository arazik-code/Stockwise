import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, RefreshCw, Truck } from 'lucide-react'
import { showToast } from '../../components/shared/Toast'
import CreateOzonParcelModal from '../../components/ozon/CreateOzonParcelModal'
import OzonTrackingModal from '../../components/ozon/OzonTrackingModal'
import {
  ozonApi, ozonDeliveryNoteLabel10x10Url,
  type OzonDashboard, type OzonParcel, type OzonParcelStatus,
  type OzonDeliveryNote, type OzonConfigStatus,
} from '../../api/ozon'
import { formatCurrency, formatDateTime } from '../../utils/format'
import {
  Button, Card, Checkbox, DataTable, EmptyState, Input, Page,
  Pagination, SkeletonStats, StatCard, StatusBadge, Tabs, cn, type Column,
} from '../../components/ui'
import type { Tone } from '../../design/status'

type Tab = 'parcels' | 'notes'
type StatusFilter = 'all' | OzonParcelStatus

const PAGE_SIZE = 30

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'New', label: 'Nouveaux' },
  { key: 'InTransit', label: 'En transit' },
  { key: 'OutForDelivery', label: 'En livraison' },
  { key: 'Delivered', label: 'Livrés' },
  { key: 'Returned', label: 'Retournés' },
  { key: 'Refused', label: 'Refusés' },
]

export default function OnlineDeliveryPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<OzonConfigStatus | null>(null)
  const [dashboard, setDashboard] = useState<OzonDashboard | null>(null)
  const [parcels, setParcels] = useState<OzonParcel[]>([])
  const [notes, setNotes] = useState<OzonDeliveryNote[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('parcels')

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [showCreate, setShowCreate] = useState(false)
  const [trackParcel, setTrackParcel] = useState<OzonParcel | null>(null)
  const [syncingCities, setSyncingCities] = useState(false)
  const [syncingTracking, setSyncingTracking] = useState(false)
  const [creatingNote, setCreatingNote] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const st = await ozonApi.getStatus()
      setStatus(st)
      if (st.configured) {
        const [d, p, n] = await Promise.all([ozonApi.getDashboard(), ozonApi.getParcels(), ozonApi.getDeliveryNotes()])
        setDashboard(d)
        setParcels(p)
        setNotes(n)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [statusFilter, search, tab])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return parcels.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (q && !(p.trackingNumber.toLowerCase().includes(q) || p.receiver.toLowerCase().includes(q) || p.phone.includes(q) || (p.cityName ?? '').toLowerCase().includes(q))) return false
      return true
    })
  }, [parcels, statusFilter, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const handleSyncCities = async () => {
    setSyncingCities(true)
    try {
      const r = await ozonApi.syncCities()
      showToast(`${r.count} villes synchronisées`, 'success')
      load()
    } catch {
      showToast('Erreur de synchronisation des villes', 'error')
    } finally {
      setSyncingCities(false)
    }
  }

  const handleSyncTracking = async () => {
    setSyncingTracking(true)
    try {
      const r = await ozonApi.syncTracking()
      showToast(`${r.synced} colis suivis, ${r.updated} mis à jour`, 'success')
      load()
    } catch {
      showToast('Erreur de synchronisation du suivi', 'error')
    } finally {
      setSyncingTracking(false)
    }
  }

  const toggleSelect = (tn: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(tn)) next.delete(tn); else next.add(tn)
      return next
    })
  }

  const handleCreateNote = async () => {
    if (selected.size === 0) { showToast('Sélectionnez au moins un colis', 'error'); return }
    setCreatingNote(true)
    try {
      const r = await ozonApi.createDeliveryNote(Array.from(selected))
      if (!r.ok || !r.deliveryNote) { showToast(r.error ?? 'Échec de création du BL', 'error'); return }
      showToast(`Bon de livraison ${r.deliveryNote.ref} créé (${r.deliveryNote.parcelCount} colis)`, 'success')
      setSelected(new Set())
      setTab('notes')
      load()
    } catch {
      showToast('Erreur lors de la création du bon de livraison', 'error')
    } finally {
      setCreatingNote(false)
    }
  }

  if (loading) {
    return (
      <Page section="onlineDelivery" title="Livraison — OzonExpress">
        <SkeletonStats count={6} />
      </Page>
    )
  }

  // Not configured → setup gate
  if (!status?.configured) {
    return (
      <Page section="onlineDelivery" title="Livraison — OzonExpress">
        <div className="flex flex-1 items-center justify-center p-6">
          <Card className="max-w-md text-center">
            <EmptyState
              icon={Truck}
              title="OzonExpress non configuré"
              description="Connectez votre compte OzonExpress pour créer des colis, suivre les livraisons et gérer vos bons de livraison directement depuis le système."
              action={
                <Button onClick={() => navigate('/online/settings')}>
                  Configurer dans Paramètres →
                </Button>
              }
            />
          </Card>
        </div>
      </Page>
    )
  }

  const citiesReady = (status.cityCount ?? 0) > 0

  const kpiTone: Record<'total' | 'transit' | 'delivered' | 'returned' | 'codPending' | 'codCollected', Tone> = {
    total: 'info',
    transit: 'special',
    delivered: 'positive',
    returned: 'negative',
    codPending: 'caution',
    codCollected: 'positive',
  }

  const parcelColumns: Column<OzonParcel>[] = [
    {
      key: 'select',
      header: '',
      width: '2.5rem',
      render: (p) => (
        <Checkbox
          checked={selected.has(p.trackingNumber)}
          onChange={() => toggleSelect(p.trackingNumber)}
          aria-label="Selectionner le colis"
        />
      ),
    },
    { key: 'tracking', header: 'Suivi', render: (p) => <span className="num font-mono font-medium text-fg">{p.trackingNumber}</span> },
    {
      key: 'receiver',
      header: 'Destinataire',
      render: (p) => (
        <div>
          <p className="font-medium text-fg">{p.receiver}</p>
          <p className="num text-xs text-fg-subtle">{p.phone}</p>
        </div>
      ),
    },
    { key: 'city', header: 'Ville', render: (p) => <span className="text-fg-muted">{p.cityName ?? '—'}</span> },
    { key: 'cod', header: 'COD', numeric: true, render: (p) => <span className="whitespace-nowrap font-semibold text-fg">{formatCurrency(p.price)}</span> },
    {
      key: 'status',
      header: 'Statut',
      align: 'center',
      render: (p) => (
        <div className="flex flex-col items-center gap-0.5">
          <StatusBadge domain="ozonParcel" value={p.status} size="xs" />
          {p.statusText && <span className="text-[10px] text-fg-subtle">{p.statusText}</span>}
        </div>
      ),
    },
    { key: 'created', header: 'Créé', render: (p) => <span className="whitespace-nowrap text-fg-muted">{formatDateTime(p.createdAt)}</span> },
    {
      key: 'bl',
      header: 'BL',
      align: 'center',
      render: (p) =>
        p.deliveryNoteRef ? (
          <a
            href={ozonDeliveryNoteLabel10x10Url(p.deliveryNoteRef)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
            title="Étiquette OzonExpress (code-barres + QR, à coller sur le colis)"
          >
            🖨 Étiquette
          </a>
        ) : (
          <span className="text-xs text-fg-subtle">—</span>
        ),
    },
  ]

  return (
    <Page
      section="onlineDelivery"
      title="Livraison — OzonExpress"
      actions={
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
          Nouveau colis
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Aperçu des livraisons</p>
          <div className="flex gap-2">
            <Button
              size="xs"
              variant="outline"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              loading={syncingTracking}
              disabled={syncingTracking}
              onClick={handleSyncTracking}
            >
              {syncingTracking ? 'Synchronisation…' : 'Actualiser le suivi'}
            </Button>
            <Button
              size="xs"
              variant="outline"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              loading={syncingCities}
              disabled={syncingCities}
              onClick={handleSyncCities}
            >
              {syncingCities ? 'Synchronisation…' : `Villes (${status.cityCount})`}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          <StatCard label="Total colis" value={String(dashboard?.totalParcels ?? 0)} tone={kpiTone.total} />
          <StatCard label="En transit" value={String(dashboard?.inTransit ?? 0)} tone={kpiTone.transit} />
          <StatCard label="Livrés" value={String(dashboard?.delivered ?? 0)} tone={kpiTone.delivered} />
          <StatCard label="Retours / refus" value={String((dashboard?.returned ?? 0) + (dashboard?.refused ?? 0))} tone={kpiTone.returned} />
          <StatCard label="COD à encaisser" value={formatCurrency(dashboard?.codPending ?? 0)} tone={kpiTone.codPending} />
          <StatCard label="COD encaissé" value={formatCurrency(dashboard?.codCollected ?? 0)} tone={kpiTone.codCollected} />
        </div>

        {!citiesReady && (
          <div
            data-tone="caution"
            className="flex items-center justify-between gap-3 rounded-card border border-[color-mix(in_oklab,var(--tone)_28%,transparent)] bg-[var(--tone-soft)] px-4 py-3 text-sm text-[var(--tone-ink)]"
          >
            <span>La liste des villes OzonExpress n'est pas encore synchronisée — nécessaire pour créer des colis.</span>
            <button
              onClick={handleSyncCities}
              disabled={syncingCities}
              className="shrink-0 text-xs font-medium underline-offset-2 hover:underline disabled:opacity-50"
            >
              {syncingCities ? 'Synchronisation…' : 'Synchroniser maintenant'}
            </button>
          </div>
        )}

        <Tabs
          variant="segmented"
          layoutGroupId="online-delivery-tab"
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          items={[
            { value: 'parcels', label: 'Colis' },
            { value: 'notes', label: `Bons de livraison (${notes.length})` },
          ]}
        />

        {tab === 'parcels' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher suivi, client, téléphone, ville..."
                size="sm"
                wrapperClassName="min-w-[220px] max-w-sm flex-1"
              />
              <Tabs
                variant="pill"
                size="sm"
                layoutGroupId="online-delivery-status-filter"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as StatusFilter)}
                items={STATUS_FILTERS.map((f) => ({ value: f.key, label: f.label }))}
              />
              {selected.size > 0 && (
                <Button size="sm" loading={creatingNote} disabled={creatingNote} onClick={handleCreateNote}>
                  {creatingNote ? 'Création…' : `Créer BL (${selected.size})`}
                </Button>
              )}
              <span className="num ml-auto text-xs text-fg-subtle">{filtered.length} colis</span>
            </div>

            <DataTable
              columns={parcelColumns}
              data={paged}
              keyField={(p) => p.id}
              onRowClick={(p) => setTrackParcel(p)}
              emptyMessage="Aucun colis"
            />
            <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} onChange={setPage} />
          </div>
        ) : (
          <DeliveryNotesTab notes={notes} />
        )}
      </div>

      {showCreate && (
        <CreateOzonParcelModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
        />
      )}
      {trackParcel && <OzonTrackingModal parcel={trackParcel} onClose={() => setTrackParcel(null)} />}
    </Page>
  )
}

function DeliveryNotesTab({ notes }: { notes: OzonDeliveryNote[] }) {
  if (notes.length === 0) {
    return (
      <div className="surface-glass">
        <EmptyState
          icon={FileText}
          title="Aucun bon de livraison"
          description="Sélectionnez des colis dans l'onglet « Colis » puis cliquez sur « Créer BL » pour générer un bon de livraison."
        />
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {notes.map((n) => (
        <Card key={n.id} className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-sunken text-fg-muted">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="num font-mono text-sm font-semibold text-fg">{n.ref}</p>
              <p className="text-xs text-fg-subtle">
                <span className="num">{n.parcelCount}</span> colis · {formatDateTime(n.createdAt)} · {n.status === 'Saved' ? 'Enregistré' : 'Brouillon'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a href={n.pdfUrl} target="_blank" rel="noopener noreferrer" className={cn(linkPillClass)}>BL PDF</a>
            <a href={n.labelsA4Url} target="_blank" rel="noopener noreferrer" className={cn(linkPillClass)}>Étiquettes A4</a>
            <a href={n.labels10x10Url} target="_blank" rel="noopener noreferrer" className={cn(linkPillClass)}>Étiquettes 10×10</a>
          </div>
        </Card>
      ))}
    </div>
  )
}

const linkPillClass =
  'rounded-field border border-border bg-sunken px-2.5 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-surface-2'
