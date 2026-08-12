import { useEffect, useState, useCallback, useRef } from 'react'
import { AlertTriangle, CheckCircle2, RotateCw, XCircle } from 'lucide-react'
import { adminHealthApi, type HealthBoard, type HealthProbeResult } from '../../api/adminHealth'
import { Button, Page, SkeletonCards, StatusBadge, StatusDot } from '../../components/ui'
import type { Tone } from '../../design/status'

const REFRESH_INTERVAL_MS = 20_000

const OVERALL_TONE: Record<HealthBoard['overallStatus'], Tone> = {
  healthy: 'positive',
  degraded: 'caution',
  down: 'critical',
}

const OVERALL_ICON = {
  healthy: CheckCircle2,
  degraded: AlertTriangle,
  down: XCircle,
} as const

const OVERALL_LABEL: Record<HealthBoard['overallStatus'], string> = {
  healthy: 'Tous les systèmes sont opérationnels',
  degraded: 'Un ou plusieurs services sont dégradés',
  down: 'Un service critique est hors service',
}

/**
 * Mission-control health board.
 *
 * The `adminHealth` section is declared `forceDark: true` in
 * src/design/sections.ts, so <Page> renders this as a permanently dark island
 * regardless of the app theme, automatically. That replaces the old
 * `-mx-4 sm:-mx-6 lg:-mx-8 -mb-8 ... bg-slate-950` negative-margin hack with a
 * first-class pattern - zero conditional styling needed anywhere downstream.
 *
 * Probe cards use `surface-glass` (faux glass, zero blur), not
 * `surface-glass-blur`: real backdrop-filter inside a `.map()` is exactly the
 * case the blur budget forbids, since the cost multiplies with every probe.
 */
export default function AdminHealthPage() {
  const [board, setBoard] = useState<HealthBoard | null>(null)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const data = await adminHealthApi.getFull()
      setBoard(data)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, REFRESH_INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [load])

  const categories = board ? Array.from(new Set(board.probes.map((p) => p.category))) : []
  const OverallIcon = board ? OVERALL_ICON[board.overallStatus] : null

  return (
    <Page
      section="adminHealth"
      title={
        <span className="flex items-center gap-2">
          <StatusDot tone={board ? OVERALL_TONE[board.overallStatus] : 'muted'} pulse />
          Centre de contrôle système
        </span>
      }
      actions={
        <Button variant="outline" size="sm" icon={<RotateCw className="h-3.5 w-3.5" />} onClick={load} loading={refreshing}>
          Actualiser
        </Button>
      }
    >
      <div className="space-y-6">
        <p className="-mt-2 text-xs text-fg-subtle">
          Vérifications en direct — actualisation automatique toutes les {REFRESH_INTERVAL_MS / 1000}s
          {board && <> · dernière vérification {new Date(board.generatedAt).toLocaleTimeString('fr-FR')}</>}
        </p>

        {error && !board && (
          <div
            data-tone="negative"
            className="rounded-card border border-[color-mix(in_oklab,var(--tone)_28%,transparent)] bg-[var(--tone-soft)] px-4 py-3 text-sm text-[var(--tone-ink)]"
          >
            Impossible de contacter le serveur pour récupérer l'état du système.
          </div>
        )}

        {board && OverallIcon && (
          <div
            data-tone={OVERALL_TONE[board.overallStatus]}
            className="relative overflow-hidden rounded-surface border border-[color-mix(in_oklab,var(--tone)_25%,transparent)] bg-[var(--tone-soft)] px-6 py-5"
          >
            <div className="flex items-center gap-3">
              <OverallIcon className="h-8 w-8 text-[var(--tone)]" aria-hidden="true" />
              <div>
                <div className="font-semibold text-fg">{OVERALL_LABEL[board.overallStatus]}</div>
                <div className="num text-xs text-fg-subtle">{board.probes.length} vérification(s) effectuée(s)</div>
              </div>
            </div>
          </div>
        )}

        {!board && !error && <SkeletonCards count={6} />}

        {categories.map((category) => (
          <div key={category}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">{category}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {board!.probes.filter((p) => p.category === category).map((probe) => (
                <ProbeCard key={probe.name} probe={probe} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Page>
  )
}

function ProbeCard({ probe }: { probe: HealthProbeResult }) {
  return (
    <div className="surface-glass p-4 transition-shadow hover:shadow-e3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-fg">{probe.name}</span>
        <StatusBadge domain="health" value={probe.status} showDot showIcon={false} size="xs" />
      </div>
      <p className="text-xs leading-relaxed text-fg-subtle">{probe.message}</p>
      <div className="num mt-3 flex items-center justify-between text-[10px] text-fg-subtle">
        <span>{probe.latencyMs}ms</span>
        <span>{new Date(probe.checkedAt).toLocaleTimeString('fr-FR')}</span>
      </div>
    </div>
  )
}
