import { useEffect, useState, useCallback, useRef } from 'react'
import { adminHealthApi, type HealthBoard, type HealthProbeResult } from '../../api/adminHealth'

const REFRESH_INTERVAL_MS = 20_000

const STATUS_META: Record<HealthProbeResult['status'], { dot: string; text: string; ring: string; label: string }> = {
  healthy: { dot: 'bg-emerald-400', text: 'text-emerald-300', ring: 'ring-emerald-400/30', label: 'Opérationnel' },
  degraded: { dot: 'bg-amber-400', text: 'text-amber-300', ring: 'ring-amber-400/30', label: 'Dégradé' },
  down: { dot: 'bg-red-400', text: 'text-red-300', ring: 'ring-red-400/30', label: 'Hors service' },
  not_configured: { dot: 'bg-slate-500', text: 'text-slate-400', ring: 'ring-slate-500/20', label: 'Non configuré' },
}

const OVERALL_META: Record<HealthBoard['overallStatus'], { gradient: string; label: string }> = {
  healthy: { gradient: 'from-emerald-500/20 via-emerald-400/5 to-transparent', label: 'Tous les systèmes sont opérationnels' },
  degraded: { gradient: 'from-amber-500/20 via-amber-400/5 to-transparent', label: 'Un ou plusieurs services sont dégradés' },
  down: { gradient: 'from-red-500/20 via-red-400/5 to-transparent', label: 'Un service critique est hors service' },
}

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

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mb-8 px-4 sm:px-6 lg:px-8 pb-10 pt-6 rounded-b-2xl bg-slate-950 text-slate-100 min-h-[70vh]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${board ? STATUS_META[board.overallStatus === 'healthy' ? 'healthy' : board.overallStatus === 'degraded' ? 'degraded' : 'down'].dot : 'bg-slate-500'}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${board ? STATUS_META[board.overallStatus === 'healthy' ? 'healthy' : board.overallStatus === 'degraded' ? 'degraded' : 'down'].dot : 'bg-slate-500'}`} />
            </span>
            Centre de contrôle système
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Vérifications en direct - actualisation automatique toutes les {REFRESH_INTERVAL_MS / 1000}s
            {board && <> · dernière vérification {new Date(board.generatedAt).toLocaleTimeString('fr-FR')}</>}
          </p>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {refreshing ? 'Vérification...' : '↻ Actualiser'}
        </button>
      </div>

      {error && !board && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 mb-6">
          Impossible de contacter le serveur pour récupérer l'état du système.
        </div>
      )}

      {board && (
        <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${OVERALL_META[board.overallStatus].gradient} px-6 py-5 mb-8`}>
          <div className="flex items-center gap-3">
            <span className={`text-3xl font-bold ${STATUS_META[board.overallStatus === 'healthy' ? 'healthy' : board.overallStatus === 'degraded' ? 'degraded' : 'down'].text}`}>
              {board.overallStatus === 'healthy' ? '✓' : board.overallStatus === 'degraded' ? '!' : '✕'}
            </span>
            <div>
              <div className="font-semibold text-slate-100">{OVERALL_META[board.overallStatus].label}</div>
              <div className="text-xs text-slate-400">{board.probes.length} vérification(s) effectuée(s)</div>
            </div>
          </div>
        </div>
      )}

      {!board && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          ))}
        </div>
      )}

      {categories.map((category) => (
        <div key={category} className="mb-8">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">{category}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {board!.probes.filter((p) => p.category === category).map((probe) => (
              <ProbeCard key={probe.name} probe={probe} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ProbeCard({ probe }: { probe: HealthProbeResult }) {
  const meta = STATUS_META[probe.status]
  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur px-4 py-4 ring-1 ${meta.ring} transition-all hover:bg-white/[0.06]`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-medium text-slate-200">{probe.name}</span>
        <span className={`flex items-center gap-1.5 text-[11px] font-medium ${meta.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${probe.status === 'healthy' ? 'animate-pulse' : ''}`} />
          {meta.label}
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{probe.message}</p>
      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-600">
        <span>{probe.latencyMs}ms</span>
        <span>{new Date(probe.checkedAt).toLocaleTimeString('fr-FR')}</span>
      </div>
    </div>
  )
}
