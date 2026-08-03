import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/layout/Header'
import { showToast } from '../../components/shared/Toast'
import CreateOzonParcelModal from '../../components/ozon/CreateOzonParcelModal'
import OzonTrackingModal from '../../components/ozon/OzonTrackingModal'
import {
  ozonApi, OZON_STATUS_META, ozonDeliveryNoteLabel10x10Url,
  type OzonDashboard, type OzonParcel, type OzonParcelStatus,
  type OzonDeliveryNote, type OzonConfigStatus,
} from '../../api/ozon'
import { formatCurrency, formatDateTime } from '../../utils/format'

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
      <div className="flex flex-col flex-1">
        <Header title="Livraison — OzonExpress" />
        <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
      </div>
    )
  }

  // Not configured → setup gate
  if (!status?.configured) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Livraison — OzonExpress" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md text-center bg-white border border-slate-200 rounded-2xl p-8">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1" /></svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">OzonExpress non configuré</h2>
            <p className="text-sm text-slate-500 mb-5">Connectez votre compte OzonExpress pour créer des colis, suivre les livraisons et gérer vos bons de livraison directement depuis le système.</p>
            <button onClick={() => navigate('/online/settings')} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700">
              Configurer dans Paramètres →
            </button>
          </div>
        </div>
      </div>
    )
  }

  const citiesReady = (status.cityCount ?? 0) > 0

  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Livraison — OzonExpress"
        actions={
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nouveau colis
          </button>
        }
      />

      {/* Hero KPI band */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-slate-300 uppercase tracking-wide">Aperçu des livraisons</p>
          <div className="flex gap-2">
            <button onClick={handleSyncTracking} disabled={syncingTracking} className="px-3 py-1.5 text-xs font-medium text-white bg-white/10 border border-white/20 rounded-md hover:bg-white/20 disabled:opacity-50">
              {syncingTracking ? 'Synchronisation…' : '↻ Actualiser le suivi'}
            </button>
            <button onClick={handleSyncCities} disabled={syncingCities} className="px-3 py-1.5 text-xs font-medium text-white bg-white/10 border border-white/20 rounded-md hover:bg-white/20 disabled:opacity-50">
              {syncingCities ? 'Synchronisation…' : `↻ Villes (${status.cityCount})`}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <KpiTile label="Total colis" value={String(dashboard?.totalParcels ?? 0)} accent="cyan" />
          <KpiTile label="En transit" value={String(dashboard?.inTransit ?? 0)} accent="violet" />
          <KpiTile label="Livrés" value={String(dashboard?.delivered ?? 0)} accent="emerald" />
          <KpiTile label="Retours / refus" value={String((dashboard?.returned ?? 0) + (dashboard?.refused ?? 0))} accent="rose" />
          <KpiTile label="COD à encaisser" value={formatCurrency(dashboard?.codPending ?? 0)} accent="amber" />
          <KpiTile label="COD encaissé" value={formatCurrency(dashboard?.codCollected ?? 0)} accent="emerald" />
        </div>
      </div>

      <div className="p-6 flex-1 space-y-4">
        {!citiesReady && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-center justify-between">
            <span>La liste des villes OzonExpress n'est pas encore synchronisée — nécessaire pour créer des colis.</span>
            <button onClick={handleSyncCities} disabled={syncingCities} className="text-xs font-medium text-amber-900 underline disabled:opacity-50">
              {syncingCities ? 'Synchronisation…' : 'Synchroniser maintenant'}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button onClick={() => setTab('parcels')} className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'parcels' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Colis</button>
          <button onClick={() => setTab('notes')} className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'notes' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Bons de livraison ({notes.length})</button>
        </div>

        {tab === 'parcels' ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <input type="text" placeholder="Rechercher suivi, client, téléphone, ville..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[220px] max-w-sm px-3.5 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
                {STATUS_FILTERS.map((f) => (
                  <button key={f.key} onClick={() => setStatusFilter(f.key)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${statusFilter === f.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{f.label}</button>
                ))}
              </div>
              {selected.size > 0 && (
                <button onClick={handleCreateNote} disabled={creatingNote} className="px-3.5 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50">
                  {creatingNote ? 'Création…' : `Créer BL (${selected.size})`}
                </button>
              )}
              <span className="text-xs text-slate-400 ml-auto">{filtered.length} colis</span>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16 text-slate-400 bg-white border border-slate-200 rounded-lg">Aucun colis</div>
            ) : (
              <>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px]">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="w-8 px-3 py-2.5"></th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Suivi</th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Destinataire</th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Ville</th>
                          <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">COD</th>
                          <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Statut</th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Créé</th>
                          <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">BL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paged.map((p) => {
                          const meta = OZON_STATUS_META[p.status]
                          return (
                            <tr key={p.id} onClick={() => setTrackParcel(p)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                              <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" checked={selected.has(p.trackingNumber)} onChange={() => toggleSelect(p.trackingNumber)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                              </td>
                              <td className="px-3 py-2.5 text-sm font-mono font-medium text-slate-900">{p.trackingNumber}</td>
                              <td className="px-3 py-2.5 text-sm">
                                <p className="font-medium text-slate-900">{p.receiver}</p>
                                <p className="text-xs text-slate-400">{p.phone}</p>
                              </td>
                              <td className="px-3 py-2.5 text-sm text-slate-600">{p.cityName ?? '—'}</td>
                              <td className="px-3 py-2.5 text-sm text-right font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(p.price)}</td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.className}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                  {p.statusText || meta.label}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-sm text-slate-500 whitespace-nowrap">{formatDateTime(p.createdAt)}</td>
                              <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                {p.deliveryNoteRef ? (
                                  <a href={ozonDeliveryNoteLabel10x10Url(p.deliveryNoteRef)} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-emerald-600 hover:text-emerald-800" title="Étiquette OzonExpress (code-barres + QR, à coller sur le colis)">
                                    🖨 Étiquette
                                  </a>
                                ) : (
                                  <span className="text-xs text-slate-300">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {pageCount > 1 && (
                    <div className="flex items-center justify-center gap-2 py-3 border-t border-slate-100">
                      <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40">Précédent</button>
                      <span className="text-sm text-slate-500 px-2">Page {currentPage} / {pageCount}</span>
                      <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount} className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40">Suivant</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
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
    </div>
  )
}

function DeliveryNotesTab({ notes }: { notes: OzonDeliveryNote[] }) {
  if (notes.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-slate-200 rounded-lg">
        <p className="text-sm text-slate-500 mb-1">Aucun bon de livraison</p>
        <p className="text-xs text-slate-400">Sélectionnez des colis dans l'onglet « Colis » puis cliquez sur « Créer BL » pour générer un bon de livraison.</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {notes.map((n) => (
        <div key={n.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 font-mono">{n.ref}</p>
              <p className="text-xs text-slate-400">{n.parcelCount} colis · {formatDateTime(n.createdAt)} · {n.status === 'Saved' ? 'Enregistré' : 'Brouillon'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a href={n.pdfUrl} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100">BL PDF</a>
            <a href={n.labelsA4Url} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100">Étiquettes A4</a>
            <a href={n.labels10x10Url} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100">Étiquettes 10×10</a>
          </div>
        </div>
      ))}
    </div>
  )
}

function KpiTile({ label, value, accent }: { label: string; value: string; accent: 'emerald' | 'cyan' | 'violet' | 'amber' | 'rose' }) {
  const ring = {
    emerald: 'from-emerald-400/20 to-emerald-400/0 ring-emerald-400/30',
    cyan: 'from-cyan-400/20 to-cyan-400/0 ring-cyan-400/30',
    violet: 'from-violet-400/20 to-violet-400/0 ring-violet-400/30',
    amber: 'from-amber-400/20 to-amber-400/0 ring-amber-400/30',
    rose: 'from-rose-400/20 to-rose-400/0 ring-rose-400/30',
  }[accent]
  return (
    <div className={`rounded-xl p-4 bg-gradient-to-br ${ring} ring-1 backdrop-blur-sm`}>
      <p className="text-[11px] font-medium text-slate-300 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-white mt-1 truncate">{value}</p>
    </div>
  )
}
