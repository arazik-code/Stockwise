import { useState, useEffect } from 'react'
import { MapPin, PackageSearch, Phone, Receipt, ScrollText } from 'lucide-react'
import { ozonApi, OZON_STATUS_META, type OzonTracking, type OzonParcel } from '../../api/ozon'
import { formatCurrency, formatDateTime } from '../../utils/format'
import {
  EmptyState, ErrorState, Modal, Skeleton, StatusBadge, StatusDot,
} from '../ui'

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
    /* closeOnEsc: this component owns no keydown listener, and neither does the
       page that mounts it (OnlineDeliveryPage). Nothing else can claim Escape
       while it is open, so opting in is safe here. */
    <Modal
      open
      onClose={onClose}
      size="lg"
      closeOnEsc
      title={<span className="num">{parcel.trackingNumber}</span>}
      description={`${parcel.receiver} · ${parcel.cityName ?? '—'}`}
    >
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <StatusBadge
              domain="ozonParcel"
              value={tracking?.status ?? parcel.status}
              size="md"
              showDot
            />
            {/* The courier sometimes returns its own wording; surface it only
                when it says something the registry label does not. */}
            {tracking?.statusText && tracking.statusText !== statusMeta.label && (
              <p className="mt-1.5 text-xs text-fg-subtle">{tracking.statusText}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-wide text-fg-subtle">COD</p>
            <p className="num text-sm font-semibold text-fg">{formatCurrency(parcel.price)}</p>
          </div>
        </div>

        {loading ? (
          /* Layout-identical to the timeline below: dot rail plus two text
             lines per event, so nothing jumps when the events land. */
          <div role="status" aria-label="Chargement du suivi" className="space-y-4 pl-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="relative">
                <Skeleton variant="circle" className="absolute -left-[13px] top-1 h-3.5" />
                <Skeleton variant="text" width={i === 0 ? '52%' : '44%'} />
                <Skeleton variant="text" className="mt-1.5 h-2.5" width="30%" />
              </div>
            ))}
          </div>
        ) : tracking && !tracking.ok ? (
          <ErrorState
            compact
            title="Suivi indisponible"
            detail={tracking.error || 'OzonExpress n’a pas répondu pour ce colis.'}
          />
        ) : tracking && tracking.events.length > 0 ? (
          <div>
            <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-fg">
              <ScrollText className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
              Historique de suivi
            </h4>
            <div className="relative pl-5">
              <div className="absolute bottom-1 left-[7px] top-1 w-px bg-border" aria-hidden="true" />
              {tracking.events.map((e, i) => (
                <div key={i} className="relative pb-4 last:pb-0">
                  <StatusDot
                    tone={i === 0 ? 'positive' : 'neutral'}
                    size="lg"
                    pulse={i === 0}
                    className="absolute -left-[13px] top-1 ring-2 ring-surface"
                  />
                  <p className="text-sm font-medium text-fg">{e.status}</p>
                  {e.comment && <p className="text-xs text-fg-muted">{e.comment}</p>}
                  {e.date && <p className="num mt-0.5 text-[11px] text-fg-subtle">{formatDateTime(e.date)}</p>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            compact
            icon={PackageSearch}
            title="Aucun événement de suivi"
            description="Le colis vient probablement d’être créé. Les événements OzonExpress apparaîtront ici dès le premier scan."
          />
        )}

        <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <DetailCell icon={Phone} label="Téléphone" value={<span className="num">{parcel.phone}</span>} />
          <DetailCell icon={MapPin} label="Adresse" value={parcel.address} />
          {parcel.orderNumber && (
            <DetailCell icon={Receipt} label="Commande" value={<span className="num">{parcel.orderNumber}</span>} />
          )}
          {parcel.deliveryNoteRef && (
            <DetailCell
              icon={ScrollText}
              label="Bon de livraison"
              value={<span className="num">{parcel.deliveryNoteRef}</span>}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}

function DetailCell({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-fg-subtle">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {label}
      </span>
      <span className="mt-0.5 block text-sm text-fg">{value}</span>
    </div>
  )
}
