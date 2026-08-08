import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { scaleBand, scaleLinear } from '@visx/scale'
import { cn } from './cn'
import { DUR, EASE } from '../../design/motion'

/**
 * Chart kit.
 *
 * Replaces eleven hand-built visualisations, including a donut chart that was
 * duplicated VERBATIM between DashboardPage:556 and OnlineDashboardPage:361.
 *
 * ── Why visx and not Recharts ───────────────────────────────────────────────
 *
 * visx gives scales and path generators and nothing else - we still author the
 * SVG. That matters for this design direction specifically: the marks need
 * `currentColor` so they inherit --accent per section, <linearGradient> fills
 * for the luminous look, `pathLength` draw-on animation, and hue-tinted
 * feDropShadow glow. Recharts owns its DOM and styles via props, so every one
 * of those would be a fight.
 *
 * Every chart here derives its colour from --accent. A chart on Stock is
 * cyan-teal and the same component on Invoices is violet, automatically.
 */

/** Width observer - avoids pulling in @visx/responsive for one hook. */
function useMeasure() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

export interface ChartFrameProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  height?: number
  children: (width: number) => ReactNode
  empty?: boolean
  emptyMessage?: string
  className?: string
}

export function ChartFrame({
  title,
  subtitle,
  actions,
  height = 240,
  children,
  empty,
  emptyMessage = 'Aucune donnée',
  className,
}: ChartFrameProps) {
  const [ref, width] = useMeasure()
  return (
    <div className={cn('surface-glass p-4 sm:p-5', className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold tracking-tight text-fg">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-fg-subtle">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div ref={ref} style={{ height }} className="relative w-full">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-fg-subtle">
            {emptyMessage}
          </div>
        ) : width > 0 ? (
          children(width)
        ) : null}
      </div>
    </div>
  )
}

export interface BarDatum {
  label: string
  value: number
  /** Optional second series, drawn as a slimmer overlay bar. */
  secondary?: number
}

export interface BarChartProps {
  data: BarDatum[]
  width: number
  height?: number
  format?: (v: number) => string
  onBarClick?: (d: BarDatum, i: number) => void
}

/**
 * Vertical bars with a gradient fill and a glow on hover.
 *
 * Bars grow from the baseline on mount. `transformOrigin: bottom` plus scaleY
 * keeps that on the compositor instead of animating the `height` attribute,
 * which would relayout the SVG every frame.
 */
export function BarChart({ data, width, height = 200, format, onBarClick }: BarChartProps) {
  const reduce = useReducedMotion()
  const gid = useId().replace(/:/g, '')
  const [hover, setHover] = useState<number | null>(null)

  const margin = { top: 8, right: 0, bottom: 22, left: 0 }
  const innerW = Math.max(0, width - margin.left - margin.right)
  const innerH = Math.max(0, height - margin.top - margin.bottom)

  const x = scaleBand({ domain: data.map((d) => d.label), range: [0, innerW], padding: 0.32 })
  const max = Math.max(...data.map((d) => Math.max(d.value, d.secondary ?? 0)), 1)
  const y = scaleLinear({ domain: [0, max], range: [innerH, 0], nice: true })

  return (
    <svg width={width} height={height} role="img" className="overflow-visible">
      <defs>
        <linearGradient id={`bar-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.45" />
        </linearGradient>
        <filter id={`glow-${gid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="6" floodColor="var(--accent)" floodOpacity="0.5" />
        </filter>
      </defs>

      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* Gridlines sit behind everything, at low contrast. */}
        {y.ticks(4).map((t) => (
          <line
            key={t}
            x1={0}
            x2={innerW}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--border)"
            strokeDasharray="2 4"
          />
        ))}

        {data.map((d, i) => {
          const bx = x(d.label) ?? 0
          const bw = x.bandwidth()
          const bh = innerH - y(d.value)
          const active = hover === i
          return (
            <g key={d.label}>
              <motion.rect
                x={bx}
                y={y(d.value)}
                width={bw}
                height={Math.max(0, bh)}
                rx={Math.min(6, bw / 3)}
                fill={`url(#bar-${gid})`}
                filter={active ? `url(#glow-${gid})` : undefined}
                style={{ transformOrigin: `${bx + bw / 2}px ${innerH}px`, cursor: onBarClick ? 'pointer' : undefined }}
                initial={reduce ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: DUR.slower, ease: EASE.outSoft, delay: Math.min(i, 12) * 0.03 }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={onBarClick ? () => onBarClick(d, i) : undefined}
              />
              {d.secondary !== undefined && (
                <rect
                  x={bx + bw * 0.3}
                  y={y(d.secondary)}
                  width={bw * 0.4}
                  height={Math.max(0, innerH - y(d.secondary))}
                  rx={2}
                  fill="var(--fg)"
                  opacity={0.16}
                />
              )}
              {active && (
                <text
                  x={bx + bw / 2}
                  y={y(d.value) - 8}
                  textAnchor="middle"
                  className="num fill-[var(--fg)] text-[11px] font-semibold"
                >
                  {format ? format(d.value) : d.value}
                </text>
              )}
            </g>
          )
        })}

        {data.map((d) => (
          <text
            key={d.label}
            x={(x(d.label) ?? 0) + x.bandwidth() / 2}
            y={innerH + 15}
            textAnchor="middle"
            className="fill-[var(--fg-subtle)] text-[10px]"
          >
            {d.label}
          </text>
        ))}
      </g>
    </svg>
  )
}

export interface DonutSlice {
  label: string
  value: number
  /** Any CSS colour. Defaults walk the tone tokens. */
  color?: string
}

const DONUT_FALLBACK = [
  'var(--info)', 'var(--positive)', 'var(--caution)',
  'var(--special)', 'var(--progress)', 'var(--negative)', 'var(--neutral)',
]

/**
 * Donut.
 *
 * The single implementation replacing the byte-identical copies in
 * DashboardPage and OnlineDashboardPage.
 *
 * Arcs draw themselves in by animating strokeDashoffset, which is a paint-only
 * property - no layout, no reflow, cheap even with a dozen slices.
 */
export function DonutChart({
  data,
  size = 180,
  thickness = 18,
  centerLabel,
  centerValue,
  format,
}: {
  data: DonutSlice[]
  size?: number
  thickness?: number
  centerLabel?: ReactNode
  centerValue?: ReactNode
  format?: (v: number) => string
}) {
  const reduce = useReducedMotion()
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  const [hover, setHover] = useState<number | null>(null)

  let offset = 0

  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <svg width={size} height={size} role="img" className="shrink-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-sunken)"
          strokeWidth={thickness}
        />
        {data.map((d, i) => {
          const frac = d.value / total
          const dash = frac * circumference
          const thisOffset = offset
          offset += dash
          const active = hover === i
          return (
            <motion.circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color ?? DONUT_FALLBACK[i % DONUT_FALLBACK.length]}
              strokeWidth={active ? thickness + 4 : thickness}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference - dash}`}
              initial={reduce ? false : { strokeDashoffset: -circumference }}
              animate={{ strokeDashoffset: -thisOffset }}
              transition={{ duration: DUR.slower, ease: EASE.outSoft, delay: i * 0.06 }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer', transition: 'stroke-width 150ms' }}
            />
          )
        })}
      </svg>

      <div className="min-w-0">
        {(centerValue || centerLabel) && (
          <div className="mb-3">
            {centerValue && <p className="num text-2xl font-bold text-fg">{centerValue}</p>}
            {centerLabel && <p className="text-xs text-fg-subtle">{centerLabel}</p>}
          </div>
        )}
        <ul className="space-y-1.5">
          {data.map((d, i) => (
            <li
              key={d.label}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className={cn(
                'flex items-center gap-2 text-xs transition-opacity',
                hover !== null && hover !== i && 'opacity-45'
              )}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-chip"
                style={{ background: d.color ?? DONUT_FALLBACK[i % DONUT_FALLBACK.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-fg-muted">{d.label}</span>
              <span className="num font-medium text-fg">{format ? format(d.value) : d.value}</span>
              <span className="num w-9 text-right text-fg-subtle">
                {((d.value / total) * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * Area/line sparkline.
 *
 * The line draws itself with pathLength, which is the one animation that
 * genuinely reads as "alive" on a trend without being distracting.
 */
export function Sparkline({
  values,
  width = 120,
  height = 32,
  className,
}: {
  values: number[]
  width?: number
  height?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const gid = useId().replace(/:/g, '')
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = width / (values.length - 1)

  const points = values.map((v, i) => [i * stepX, height - ((v - min) / span) * (height - 4) - 2])
  const line = points.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`

  return (
    <svg width={width} height={height} className={cn('overflow-visible', className)} role="img">
      <defs>
        <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${gid})`} />
      <motion.path
        d={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: DUR.slower, ease: EASE.outSoft }}
      />
    </svg>
  )
}

/** Horizontal breakdown bar - the "category share" row used on several pages. */
export function BreakdownRow({
  label,
  value,
  total,
  format,
  color,
  meta,
}: {
  label: ReactNode
  value: number
  total: number
  format?: (v: number) => string
  color?: string
  meta?: ReactNode
}) {
  const pct = total > 0 ? (value / total) * 100 : 0
  const reduce = useReducedMotion()
  return (
    <div className="group">
      <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
        <span className="min-w-0 truncate text-fg-muted">{label}</span>
        <span className="num shrink-0 font-medium text-fg">
          {format ? format(value) : value}
          {meta && <span className="ml-1.5 font-normal text-fg-subtle">{meta}</span>}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-chip bg-sunken">
        <motion.div
          className="h-full rounded-chip"
          style={{ background: color ?? 'var(--accent)' }}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: DUR.slower, ease: EASE.outSoft }}
        />
      </div>
    </div>
  )
}
