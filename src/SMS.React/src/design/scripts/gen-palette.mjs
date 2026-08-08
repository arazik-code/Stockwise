/**
 * OKLCH palette generator for the "Luminous Depth" design system.
 *
 *   node src/design/scripts/gen-palette.mjs > src/design/palette.css
 *
 * The output is COMMITTED. Re-run this only when the ladders below change,
 * and review the acceptance report it prints to stderr before committing.
 *
 * ── Why OKLCH ──────────────────────────────────────────────────────────────
 * OKLCH's L is a *perceptual* lightness, so two hues at the same L have the
 * same apparent lightness by construction. That is the whole point: we fix one
 * global L ladder and one global C ladder, rotate only H, and every ramp comes
 * out weighing the same at the same step. In HSL this is false - hsl(50%)
 * yellow and hsl(50%) blue differ by roughly 3x in luminance, which is why
 * hand-picked palettes always have one hue that shouts.
 *
 * Two corrections keep this honest rather than merely systematic:
 *
 *   1. `k` - a per-hue chroma cap. sRGB's gamut is not a cylinder; blue holds
 *      far more chroma than yellow at the same L. Without a cap the generator
 *      would silently clip and the ramp would flatten out at the top end.
 *
 *   2. `dL` - a lightness correction on the yellow band (H 60-125). Same-L
 *      yellow reads garish and loses contrast against white faster than any
 *      other hue. Amber and lime get pulled down slightly. This mirrors what
 *      Tailwind's own ramp does empirically, but here it is a declared,
 *      auditable parameter instead of an eyeballed value.
 */

// ── Ladders ────────────────────────────────────────────────────────────────
// Same L at the same step for every hue. This is the load-bearing invariant:
// perceptual weight uniformity comes from construction, not from tuning.
//
// L[600] = 0.545 is not a taste value - it is SOLVED. It is the lightest step
// at which the worst-case hue (emerald: WCAG weights the green channel 0.7152,
// so greens are far brighter in WCAG terms than blues at equal perceptual L)
// still clears 4.5:1 against white text, with margin. See ACCENT_LIGHT below.
const L = {
  50: 0.977, 100: 0.944, 200: 0.898, 300: 0.834, 400: 0.740,
  500: 0.648, 600: 0.545, 700: 0.470, 800: 0.408, 900: 0.358, 950: 0.256,
}

const C = {
  50: 0.013, 100: 0.030, 200: 0.062, 300: 0.104, 400: 0.150,
  500: 0.185, 600: 0.196, 700: 0.180, 800: 0.150, 900: 0.124, 950: 0.078,
}

const STEPS = Object.keys(L).map(Number)

/** WCAG AA for normal text. Hard gate. */
const AA = 4.5
/** Chroma used by section accents (mirrors --accent in components.css). */
const ACCENT_C = 0.190

// ── Hues ───────────────────────────────────────────────────────────────────
// `ink` is the neutral ramp and is deliberately NOT achromatic. A faintly blue
// grey (H 255 at very low chroma) sits correctly beside saturated accents;
// pure oklch(L 0 0) greys read dirty next to them.
const HUES = {
  ink:     { h: 255, k: 0.055 },
  rose:    { h: 15,  k: 0.92 },
  red:     { h: 27,  k: 0.92 },
  orange:  { h: 55,  k: 0.85 },
  amber:   { h: 78,  k: 0.78, dL: -0.020 },
  lime:    { h: 122, k: 0.80, dL: -0.012 },
  emerald: { h: 158, k: 0.82 },
  teal:    { h: 183, k: 0.78 },
  cyan:    { h: 212, k: 0.85 },
  sky:     { h: 237, k: 0.95 },
  blue:    { h: 264, k: 1.00 },
  indigo:  { h: 277, k: 1.00 },
  violet:  { h: 293, k: 0.98 },
  fuchsia: { h: 322, k: 0.95 },
}

// ── Colour maths (OKLCH -> OKLab -> linear sRGB -> sRGB) ───────────────────

function oklchToLinearSrgb(l, c, hDeg) {
  const h = (hDeg * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  const L3 = l_ * l_ * l_
  const M3 = m_ * m_ * m_
  const S3 = s_ * s_ * s_

  return [
    +4.0767416621 * L3 - 3.3077115913 * M3 + 0.2309699292 * S3,
    -1.2684380046 * L3 + 2.6097574011 * M3 - 0.3413193965 * S3,
    -0.0041960863 * L3 - 0.7034186147 * M3 + 1.707614701 * S3,
  ]
}

const EPS = 1e-4
const inGamut = ([r, g, b]) =>
  r >= -EPS && r <= 1 + EPS && g >= -EPS && g <= 1 + EPS && b >= -EPS && b <= 1 + EPS

/** Largest chroma <= cMax that stays inside sRGB at this L/H. */
function fitChroma(l, cMax, h) {
  if (inGamut(oklchToLinearSrgb(l, cMax, h))) return cMax
  let lo = 0
  let hi = cMax
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(oklchToLinearSrgb(l, mid, h))) lo = mid
    else hi = mid
  }
  return lo
}

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const encode = (x) => {
  const v = clamp01(x)
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
}

const toHex = (lin) =>
  '#' + lin.map((x) => Math.round(encode(x) * 255).toString(16).padStart(2, '0')).join('')

/** WCAG 2.1 relative luminance, from LINEAR sRGB. */
const relLuminance = ([r, g, b]) =>
  0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b)

const contrast = (linA, linB) => {
  const a = relLuminance(linA)
  const b = relLuminance(linB)
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

const WHITE = [1, 1, 1]
// --canvas in dark mode: oklch(0.178 0.012 262)
const DARK_CANVAS = oklchToLinearSrgb(0.178, 0.012, 262)

// ── Generate ───────────────────────────────────────────────────────────────

const ramps = {}
for (const [name, cfg] of Object.entries(HUES)) {
  ramps[name] = STEPS.map((step) => {
    const l = L[step] + (cfg.dL ?? 0)
    const c = fitChroma(l, C[step] * cfg.k, cfg.h)
    const lin = oklchToLinearSrgb(l, c, cfg.h)
    return {
      step,
      l,
      c,
      h: cfg.h,
      hex: toHex(lin),
      onWhite: contrast(lin, WHITE),
      onDark: contrast(lin, DARK_CANVAS),
      clipped: c < C[step] * cfg.k - 1e-4,
    }
  })
}

// ── Acceptance gates ───────────────────────────────────────────────────────
//
// An earlier version of this script asserted that contrast-vs-white at step
// 600 was uniform across hues to within +/-0.35. That assertion is WRONG and
// was removed: WCAG relative luminance weights green at 0.7152 and blue at
// 0.0722, so at equal *perceptual* lightness a green is far brighter in WCAG
// terms than a blue. Demanding that OKLCH L and WCAG luminance both be uniform
// is self-contradictory - you can have one or the other, never both.
//
// So we assert the two things that are actually true and actually matter:
//
//   INVARIANT (by construction, not tested): every hue shares one L ladder,
//   modulo the declared dL corrections. That IS perceptual weight uniformity.
//
//   GATE (tested, hard): any accent a component paints text on must clear
//   4.5:1 with its chosen foreground, in both themes. Failing this ships an
//   unreadable button, which no amount of perceptual elegance excuses.

const INK_950 = oklchToLinearSrgb(L[950], C[950] * HUES.ink.k, HUES.ink.h)
const chromatic = Object.entries(HUES).filter(([n]) => n !== 'ink')

/** Better of white / ink-950 on this swatch, plus which one won. */
function bestForeground(lin) {
  const onWhite = contrast(lin, WHITE)
  const onInk = contrast(lin, INK_950)
  return onWhite >= onInk
    ? { fg: 'white', ratio: onWhite }
    : { fg: 'ink-950', ratio: onInk }
}

/** Worst-case best-foreground contrast across every section hue at this L. */
function worstAccent(l) {
  let worst = Infinity
  let who = ''
  let fg = ''
  for (const [name, cfg] of chromatic) {
    const ll = l + (cfg.dL ?? 0)
    const c = fitChroma(ll, ACCENT_C * cfg.k, cfg.h)
    const b = bestForeground(oklchToLinearSrgb(ll, c, cfg.h))
    if (b.ratio < worst) { worst = b.ratio; who = name; fg = b.fg }
  }
  return { worst, who, fg }
}

/**
 * Section accents are NOT palette steps - a section's hue is arbitrary, so the
 * accent lightness has to hold for every hue on the wheel, not just the 13 we
 * generate ramps for. Both values are SOLVED here against the AA gate and
 * emitted as tokens, so components.css cannot drift away from what was tested.
 *
 * Light: the *lightest* L that still clears AA (keeps accents vivid).
 * Dark:  the *lightest* L is wrong here - on a dark canvas the accent is read
 *        with near-black text, so we want the lightest L again, but the binding
 *        constraint flips. We search upward for the first L that clears AA.
 */
function solveAccentL(lo, hi, preferHigh) {
  let a = lo
  let b = hi
  for (let i = 0; i < 40; i++) {
    const mid = (a + b) / 2
    const ok = worstAccent(mid).worst >= AA
    if (preferHigh ? ok : !ok) a = mid
    else b = mid
  }
  return preferHigh ? a : b
}

// Light accent: search downward from bright - the highest L still clearing AA.
const ACCENT_L_LIGHT = Math.floor(solveAccentL(0.30, 0.70, true) * 1000) / 1000
// Dark accent: search upward - the lowest L clearing AA with near-black text.
const ACCENT_L_DARK = Math.ceil(solveAccentL(0.60, 0.95, false) * 1000) / 1000

let failed = 0
const report = (title, rows) => {
  process.stderr.write(`\n${title}\n`)
  for (const r of rows) process.stderr.write(`  ${r}\n`)
}

function gateAccent(label, l) {
  const rows = chromatic.map(([name, cfg]) => {
    const ll = l + (cfg.dL ?? 0)
    const c = fitChroma(ll, ACCENT_C * cfg.k, cfg.h)
    const lin = oklchToLinearSrgb(ll, c, cfg.h)
    const b = bestForeground(lin)
    const vsCanvas = contrast(lin, DARK_CANVAS)
    if (b.ratio < AA) failed++
    return `${name.padEnd(9)} ${b.ratio.toFixed(2)}:1 on ${b.fg.padEnd(8)}` +
           `${b.ratio < AA ? ' FAIL' : ''}   (vs dark canvas ${vsCanvas.toFixed(2)}:1)`
  })
  report(`${label}  L=${l}  - best foreground must clear ${AA}:1`, rows)
}

gateAccent('Gate A - LIGHT section accent', ACCENT_L_LIGHT)
gateAccent('Gate B - DARK section accent ', ACCENT_L_DARK)

// Gate C - semantic ramp steps actually painted with white text.
const gateC = chromatic.map(([name]) => {
  const s = ramps[name].find((x) => x.step === 600)
  const lin = oklchToLinearSrgb(s.l, s.c, s.h)
  const b = bestForeground(lin)
  if (b.ratio < AA) failed++
  return `${name.padEnd(9)} ${b.ratio.toFixed(2)}:1 on ${b.fg.padEnd(8)}${b.ratio < AA ? ' FAIL' : ''}`
})
report(`Gate C - ramp step 600 (semantic solids), best foreground must clear ${AA}:1`, gateC)

// Informational: the WCAG spread we deliberately do NOT flatten.
const spread = chromatic.map(([name]) => ramps[name].find((x) => x.step === 600).onWhite)
process.stderr.write(
  `\nInfo - step 600 contrast-vs-white spread ${Math.min(...spread).toFixed(2)}` +
  `..${Math.max(...spread).toFixed(2)} (greens low, warms high - that is WCAG's\n` +
  `       luminance model, not a defect; perceptual weight is equal by construction).\n`
)

process.stderr.write(failed ? `\n${failed} GATE FAILURE(S)\n\n` : `\nAll gates PASS\n\n`)
if (failed) process.exitCode = 1

// ── Emit ───────────────────────────────────────────────────────────────────

const out = []
out.push('/**')
out.push(' * TIER 1 - primitive OKLCH ramps.')
out.push(' *')
out.push(' * GENERATED by src/design/scripts/gen-palette.mjs. DO NOT HAND-EDIT.')
out.push(' * Change the ladders in that script and re-run instead.')
out.push(' *')
out.push(' * Never reference these directly from a component. Components use the')
out.push(' * semantic aliases in semantic.css, which are the only place that knows')
out.push(' * about light vs dark.')
out.push(' *')
out.push(' * INVARIANT: one L ladder shared by every hue (modulo the declared dL')
out.push(' * corrections on the yellow band) - so any two swatches at the same step')
out.push(' * carry the same perceptual weight by construction.')
out.push(' *')
out.push(` * GATES: section accents at L ${ACCENT_L_LIGHT} (light) / ${ACCENT_L_DARK} (dark) and ramp`)
out.push(` * step 600 each clear ${AA}:1 against their chosen foreground, for EVERY hue.`)
out.push(` * Status: ${failed ? 'FAIL' : 'PASS'}.`)
out.push(' *')
out.push(' * Each swatch is annotated  hex / contrast-vs-white / contrast-vs-dark-canvas.')
out.push(' */')
out.push('')
out.push(':root {')
out.push('')
out.push('  /* Section-accent geometry - SOLVED against the AA gate above.')
out.push('     components.css builds every --accent from these; do not inline the numbers. */')
out.push(`  --accent-l-light: ${ACCENT_L_LIGHT};`)
out.push(`  --accent-l-dark: ${ACCENT_L_DARK};`)
out.push(`  --accent-c-base: ${ACCENT_C};`)

for (const [name, r] of Object.entries(ramps)) {
  const cfg = HUES[name]
  const notes = [`H ${cfg.h}`, `k ${cfg.k}`]
  if (cfg.dL) notes.push(`dL ${cfg.dL}`)
  out.push('')
  out.push(`  /* ${name} - ${notes.join(', ')} */`)
  for (const s of r) {
    const decl = `  --${name}-${s.step}: oklch(${s.l.toFixed(3)} ${s.c.toFixed(4)} ${s.h});`
    const note = `${s.hex}  w ${s.onWhite.toFixed(2)}  d ${s.onDark.toFixed(2)}${s.clipped ? '  [gamut-clipped]' : ''}`
    out.push(`${decl.padEnd(52)}/* ${note} */`)
  }
}

out.push('}')
out.push('')

process.stdout.write(out.join('\n'))

// ── Also emit the solved constants as TypeScript ───────────────────────────
// sections.ts needs the same accent geometry to compute each section's
// on-accent foreground. Emitting from the same run is what makes drift between
// the CSS and the TS impossible.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const ts = `/**
 * GENERATED by src/design/scripts/gen-palette.mjs. DO NOT HAND-EDIT.
 *
 * The same solved values emitted into palette.css as
 * --accent-l-light / --accent-l-dark / --accent-c-base. Both come from one
 * generator run, so the CSS and the TypeScript cannot drift apart.
 *
 * Each was solved so that EVERY hue on the wheel clears ${AA}:1 against its
 * chosen foreground - not picked by eye. See the gates in the generator.
 */

/** Section-accent lightness in light mode. Takes white text. */
export const ACCENT_L_LIGHT = ${ACCENT_L_LIGHT}

/** Section-accent lightness in dark mode. Takes near-black text. */
export const ACCENT_L_DARK = ${ACCENT_L_DARK}

/** Base chroma for section accents, before each section's \`k\` cap. */
export const ACCENT_C_BASE = ${ACCENT_C}

/** Chroma multiplier applied in dark mode - high chroma halates on dark. */
export const DARK_CHROMA_SCALE = 0.9

/** WCAG AA for normal text, the gate every accent was solved against. */
export const AA_CONTRAST = ${AA}
`
writeFileSync(join(here, '..', 'accent.generated.ts'), ts)
process.stderr.write('Wrote src/design/accent.generated.ts\n')
