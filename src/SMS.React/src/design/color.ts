/**
 * Runtime OKLCH colour maths.
 *
 * Used by sections.ts to derive each section's on-accent foreground, and by
 * the /design showcase to render its live contrast report.
 *
 * NOTE: scripts/gen-palette.mjs carries its own copy of these formulas. That
 * duplication is deliberate - the generator is a plain node script that runs
 * before any TypeScript exists, so it cannot import this module. The two are
 * kept honest by the /design showcase, which recomputes the generator's gates
 * at runtime using THIS code and flags any disagreement.
 */

export interface Oklch {
  l: number
  c: number
  h: number
}

/** OKLCH -> linear sRGB. Values may fall outside [0,1] if out of gamut. */
export function oklchToLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  const L3 = l_ * l_ * l_
  const M3 = m_ * m_ * m_
  const S3 = s_ * s_ * s_

  return [
    4.0767416621 * L3 - 3.3077115913 * M3 + 0.2309699292 * S3,
    -1.2684380046 * L3 + 2.6097574011 * M3 - 0.3413193965 * S3,
    -0.0041960863 * L3 - 0.7034186147 * M3 + 1.707614701 * S3,
  ]
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

const GAMUT_EPS = 1e-4
export const inGamut = ([r, g, b]: [number, number, number]) =>
  r >= -GAMUT_EPS && r <= 1 + GAMUT_EPS &&
  g >= -GAMUT_EPS && g <= 1 + GAMUT_EPS &&
  b >= -GAMUT_EPS && b <= 1 + GAMUT_EPS

/** Largest chroma <= cMax that stays inside sRGB at this lightness and hue. */
export function fitChroma(l: number, cMax: number, h: number): number {
  if (inGamut(oklchToLinearSrgb({ l, c: cMax, h }))) return cMax
  let lo = 0
  let hi = cMax
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(oklchToLinearSrgb({ l, c: mid, h }))) lo = mid
    else hi = mid
  }
  return lo
}

/** WCAG 2.1 relative luminance, computed from LINEAR sRGB. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b)
}

/** WCAG 2.1 contrast ratio between two linear-sRGB colours. */
export function contrastRatio(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export const contrastOklch = (a: Oklch, b: Oklch) =>
  contrastRatio(oklchToLinearSrgb(a), oklchToLinearSrgb(b))

const encodeChannel = (x: number) => {
  const v = clamp01(x)
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
}

/** OKLCH -> #rrggbb, gamut-clamped. For canvas/SVG APIs that will not take oklch(). */
export function oklchToHex(color: Oklch): string {
  return (
    '#' +
    oklchToLinearSrgb(color)
      .map((x) => Math.round(encodeChannel(x) * 255).toString(16).padStart(2, '0'))
      .join('')
  )
}

export const oklchCss = ({ l, c, h }: Oklch, alpha?: number) =>
  alpha === undefined
    ? `oklch(${l} ${c} ${h})`
    : `oklch(${l} ${c} ${h} / ${alpha})`

/** Near-black used as the dark-on-light foreground. Mirrors --ink-950. */
export const INK_950: Oklch = { l: 0.256, c: 0.0043, h: 255 }
export const WHITE: Oklch = { l: 1, c: 0, h: 0 }

export type ForegroundChoice = 'white' | 'ink'

/**
 * Whichever of white / near-black reads better on this colour, with the ratio.
 *
 * This is the rule that AI-generated palettes reliably get wrong: at a single
 * fixed lightness, white text clears 4.5:1 on blue but fails on amber. Picking
 * the foreground by measurement rather than by a blanket `L < x ? white : black`
 * threshold is what keeps every accent readable.
 */
export function bestForeground(on: Oklch): { fg: ForegroundChoice; ratio: number } {
  const onWhite = contrastOklch(on, WHITE)
  const onInk = contrastOklch(on, INK_950)
  return onWhite >= onInk
    ? { fg: 'white', ratio: onWhite }
    : { fg: 'ink', ratio: onInk }
}
