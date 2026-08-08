/**
 * Motion tokens - the TypeScript half.
 *
 * DUR and EASE MIRROR the @theme block in theme.css / components.css. They
 * have to exist in both places: CSS needs them so Tailwind emits `duration-*`
 * utilities for the primitives, and Framer Motion needs plain numbers.
 *
 * Rather than trusting discipline to keep them in sync, /design reads the
 * computed custom properties off <html> and compares them to DUR at runtime,
 * showing a drift banner on mismatch. See assertMotionTokensInSync below.
 *
 * SPRING and the variants in variants.ts live ONLY here - springs have no CSS
 * equivalent. Ambient keyframes (shimmer, pulse-ring, mesh-drift) live ONLY in
 * components.css. So no single motion value is ever defined twice.
 */

/** Seconds, for Framer Motion. */
export const DUR = {
  instant: 0.09,
  fast: 0.15,
  base: 0.24,
  slow: 0.34,
  slower: 0.46,
  ambient: 0.9,
} as const

export const EASE = {
  outSoft: [0.22, 1, 0.36, 1],
  inOutSoft: [0.65, 0, 0.35, 1],
  outBack: [0.34, 1.4, 0.64, 1],
} as const

/**
 * Spring presets. Named for what they are FOR, not for their numbers, so a
 * call site never has to reason about stiffness.
 */
export const SPRING = {
  /** Button press. Very stiff, barely any travel - must feel instant. */
  tap: { type: 'spring', stiffness: 520, damping: 30, mass: 0.5 },
  /** Modals, sheets, popovers settling into place. */
  panel: { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 },
  /** The floaty 300-450ms character of the Luminous Depth direction. */
  float: { type: 'spring', stiffness: 170, damping: 26, mass: 1.1 },
  /** Status changes, counters, anything that should feel decisive. */
  snappy: { type: 'spring', stiffness: 400, damping: 34, mass: 0.7 },
} as const

/** Stagger step for list entrances. */
export const STAGGER_STEP = 0.028

/**
 * Above this index a staggered child gets zero delay.
 *
 * Without the cap, a 200-row list would take almost six seconds to finish
 * appearing. Only the first screenful reads as choreography anyway.
 */
export const STAGGER_CAP = 12

/** Delay per item, capped. */
export const staggerDelay = (index: number) =>
  index < STAGGER_CAP ? index * STAGGER_STEP : 0

/**
 * Live-data pulse throttle, in ms.
 *
 * SignalR can deliver a burst of inventory updates during a busy POS hour.
 * Un-throttled, a glow-on-change turns the screen into a strobe.
 */
export const PULSE_THROTTLE_MS = 800
export const PULSE_DURATION_MS = 600

/**
 * Compare the CSS duration tokens to DUR. Returns the mismatches.
 *
 * Reading custom properties via getComputedStyle is reliable; only certain
 * shorthand/transform properties are not, and we never read those.
 */
export function assertMotionTokensInSync(): Array<{
  token: string
  css: string
  ts: number
}> {
  if (typeof window === 'undefined') return []
  const style = getComputedStyle(document.documentElement)
  const drift: Array<{ token: string; css: string; ts: number }> = []

  for (const [name, seconds] of Object.entries(DUR)) {
    if (name === 'ambient') continue // ambient is TS-only, no CSS counterpart
    const raw = style.getPropertyValue(`--duration-${name}`).trim()
    if (!raw) continue
    const ms = raw.endsWith('ms')
      ? parseFloat(raw)
      : raw.endsWith('s')
        ? parseFloat(raw) * 1000
        : NaN
    if (Number.isNaN(ms) || Math.abs(ms - seconds * 1000) > 1) {
      drift.push({ token: `--duration-${name}`, css: raw, ts: seconds * 1000 })
    }
  }
  return drift
}
