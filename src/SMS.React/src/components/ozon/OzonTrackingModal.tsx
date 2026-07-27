import { useState, useEffect } from 'react'
import { ozonApi, OZON_STATUS_META, type OzonTracking, type OzonParcel } from '../../api/ozon'
import { formatCurrency, formatDateTime } from '../../utils/format'

export default function OzonTrackingModal({ parcel, onClose }: { parcel: OzonParcel; onClose: () => void }) {
  const [tracking, setTracking] = useState<OzonTracking | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ozonApi.track(parcel.id)
      .then((t) => { if (!cancelled) setTracking(t) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [parcel.id])

  const statusMeta = OZON_STATUS_META[tracking?.status ?? parcel.status]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[85vh] overflow-auto border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-start sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-base font-semibold text-slate-900 font-mono">{parcel.trackingNumber}</h3>
            <p className="text-xs text-slate-500">{parcel.receiver} · {parcel.cityName ?? '—'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full ${statusMeta.className}`}>
              <span className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
              {tracking?.statusText || statusMeta.label}
            </span>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">COD</p>
              <p className="text-sm font-semibold text-slate-900">{formatCurrency(parcel.price)}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
            </div>
          ) : tracking && !tracking.ok ? (
            <p className="text-sm text-slate-400 text-center py-6">{tracking.error || 'Suivi indisponible pour le moment'}</p>
          ) : tracking && tracking.events.length > 0 ? (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Historique de suivi</h4>
              <div className="relative pl-5">
                <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-200" />
                {tracking.events.map((e, i) => (
                  <div key={i} className="relative pb-4 last:pb-0">
                    <div className={`absolute -left-[13px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${i === 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <p className="text-sm font-medium text-slate-800">{e.status}</p>
                    {e.comment && <p className="text-xs text-slate-500">{e.comment}</p>}
                    {e.date && <p className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(e.date)}</p>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-6">Aucun événement de suivi pour le moment. Le colis vient probablement d'être créé.</p>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm border-t border-slate-100 pt-4">
            <div><span className="text-[11px] text-slate-400 uppercase tracking-wide block">Téléphone</span><span className="text-slate-700">{parcel.phone}</span></div>
            <div><span className="text-[11px] text-slate-400 uppercase tracking-wide block">Adresse</span><span className="text-slate-700">{parcel.address}</span></div>
            {parcel.orderNumber && <div><span className="text-[11px] text-slate-400 uppercase tracking-wide block">Commande</span><span className="text-slate-700 font-mono">{parcel.orderNumber}</span></div>}
            {parcel.deliveryNoteRef && <div><span className="text-[11px] text-slate-400 uppercase tracking-wide block">Bon de livraison</span><span className="text-slate-700 font-mono">{parcel.deliveryNoteRef}</span></div>}
          </div>
        </div>
      </div>
    </div>
  )
}
