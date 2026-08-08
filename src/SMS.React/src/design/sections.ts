/**
 * Section registry - the per-route identity map.
 *
 * Every route declares a hue (`h`), a chroma cap (`k`) and a layout archetype.
 * <Page section="stock"> stamps these onto the DOM and every descendant
 * inherits, so the same <Button> is cyan-teal on Stock and violet on Invoices
 * without a single prop being passed.
 *
 * ── How the hues were chosen ────────────────────────────────────────────────
 *
 * Three family arcs, so hue answers "where in the business am I":
 *
 *   LOCAL   H 196-290   cool. The daily instrument panel.
 *   ONLINE  H 285-345   violet through magenta. Unmistakably not the shop floor.
 *   ADMIN   H 185-215   desaturated cyan-slate at k 0.72, because admin is
 *                       chrome around the product, not the product.
 *
 * Within an arc, hues are quantised to at least 14-degree steps. Anything
 * closer is not distinguishable at these chroma levels, so it would be
 * variety on paper and noise in practice.
 *
 * ── Three deliberate arc breaks ─────────────────────────────────────────────
 *
 * Meaning beats symmetry. Three sections leave their family on purpose:
 *
 *   Sales AND OnlineFinance both sit at H 158 (green). Revenue is green
 *   everywhere in this business, and a cashier should not have to learn that
 *   "money in" is a different colour depending on which half of the app they
 *   are standing in.
 *
 *   Refunds sits at H 25 (red-orange), off the cool arc entirely. Money going
 *   out is risk, and the screen should say so before the operator reads a word.
 *
 *   OfflineSales sits at H 55 (amber). Amber is the universal degraded-mode
 *   signal; this screen only exists when the system is running on a fallback.
 *
 * `k` (chroma cap) encodes importance. POS is 1.00. Settings, the printer page
 * and the designers are 0.45 - they should recede. Admin sits at 0.72 as a
 * family. This is why the palette reads as engineered rather than assembled:
 * saturation carries hierarchy, not just decoration.
 */

import type { CSSProperties } from 'react'
import type { ArchetypeName } from './archetypes'
import { ACCENT_L_LIGHT, ACCENT_L_DARK, ACCENT_C_BASE, DARK_CHROMA_SCALE } from './accent.generated'
import { bestForeground, fitChroma } from './color'

export interface SectionDef {
  /** OKLCH hue angle. */
  h: number
  /** Chroma cap, 0-1. Lower = more recessive. */
  k: number
  arch: ArchetypeName
  /**
   * Render this section as a permanently dark island regardless of app theme.
   * Only the system health board, where a mission-control read is the point.
   */
  forceDark?: boolean
}

export const SECTIONS = {
  // ── LOCAL ────────────────────────────────────────────────────────────────
  dashboard:     { h: 258, k: 1.0,  arch: 'command' },
  pos:           { h: 212, k: 1.0,  arch: 'console' },
  products:      { h: 272, k: 1.0,  arch: 'catalog' },
  stock:         { h: 196, k: 0.9,  arch: 'ledger'  },
  sales:         { h: 158, k: 0.95, arch: 'ledger'  },
  clients:       { h: 240, k: 1.0,  arch: 'profile' },
  invoices:      { h: 286, k: 1.0,  arch: 'ledger'  },
  fournisseurs:  { h: 300, k: 0.92, arch: 'ledger'  },
  reports:       { h: 228, k: 1.0,  arch: 'command' },
  refunds:       { h: 25,  k: 0.9,  arch: 'console' },
  offlineSales:  { h: 55,  k: 0.85, arch: 'ledger'  },
  settings:      { h: 250, k: 0.45, arch: 'config'  },
  printer:       { h: 250, k: 0.45, arch: 'config'  },
  invoiceDesign: { h: 250, k: 0.45, arch: 'config'  },
  receiptDesign: { h: 250, k: 0.45, arch: 'config'  },

  // ── ONLINE ───────────────────────────────────────────────────────────────
  onlineDash:    { h: 318, k: 1.0,  arch: 'command' },
  onlineOrders:  { h: 292, k: 1.0,  arch: 'ledger'  },
  onlineProducts:{ h: 306, k: 1.0,  arch: 'catalog' },
  onlineClients: { h: 332, k: 1.0,  arch: 'profile' },
  onlineCrm:     { h: 345, k: 0.95, arch: 'profile' },
  onlineDelivery:{ h: 288, k: 0.92, arch: 'ledger'  },
  onlineFinance: { h: 158, k: 0.95, arch: 'ledger'  },
  onlineConfirm: { h: 300, k: 1.0,  arch: 'console' },
  onlineSync:    { h: 296, k: 0.6,  arch: 'config'  },
  onlineLink:    { h: 310, k: 0.6,  arch: 'config'  },
  onlineWhatsApp:{ h: 152, k: 0.75, arch: 'config'  },
  onlineSettings:{ h: 300, k: 0.45, arch: 'config'  },

  // ── ADMIN ────────────────────────────────────────────────────────────────
  admin:         { h: 200, k: 0.72, arch: 'command' },
  adminUsers:    { h: 206, k: 0.72, arch: 'ledger'  },
  adminRoles:    { h: 194, k: 0.72, arch: 'config'  },
  adminHealth:   { h: 188, k: 0.85, arch: 'command', forceDark: true },
  adminAudit:    { h: 212, k: 0.65, arch: 'ledger'  },

  // ── STANDALONE (no sidebar) ──────────────────────────────────────────────
  auth:          { h: 258, k: 1.0,  arch: 'config'  },
  notFound:      { h: 250, k: 0.45, arch: 'config'  },
  design:        { h: 264, k: 1.0,  arch: 'command' },
} as const satisfies Record<string, SectionDef>

export type SectionName = keyof typeof SECTIONS

/**
 * The foreground a section's accent must use, per theme.
 *
 * Measured, not thresholded. gen-palette.mjs solved ACCENT_L_* so that every
 * hue clears 4.5:1 with SOME foreground; this works out which one, per hue.
 * In practice light accents take white and dark accents take near-black, but
 * deriving it means a future hue or chroma change cannot silently ship an
 * unreadable button.
 */
function onAccentFor(h: number, k: number, dark: boolean): 'white' | 'ink' {
  const l = dark ? ACCENT_L_DARK : ACCENT_L_LIGHT
  const cMax = ACCENT_C_BASE * k * (dark ? DARK_CHROMA_SCALE : 1)
  return bestForeground({ l, c: fitChroma(l, cMax, h), h }).fg
}

const CSS_FG = { white: 'oklch(1 0 0)', ink: 'var(--ink-950)' } as const

/**
 * Inline custom properties for a section root.
 *
 * Both themes' foregrounds are computed and the theme-appropriate one is
 * selected in CSS, so switching theme does not require a re-render.
 */
export function sectionVars(name: SectionName): CSSProperties {
  const s = SECTIONS[name]
  return {
    '--acc-h': String(s.h),
    '--acc-k': String(s.k),
    '--acc-on-light': CSS_FG[onAccentFor(s.h, s.k, false)],
    '--acc-on-dark': CSS_FG[onAccentFor(s.h, s.k, true)],
  } as CSSProperties
}

/**
 * Everything an element needs to own a section accent: the attribute AND the
 * variables that feed it.
 *
 *     <div {...sectionProps('stock')}>
 *
 * Always prefer this over calling sectionVars directly.
 *
 * The variables are only INPUTS. `--accent`, `--accent-hover`, `--accent-soft`
 * and the section-tinted shadow hue are all DERIVED from them by the
 * `[data-section]` rule in components.css. An element that sets the variables
 * without carrying the attribute never triggers that rule, so it silently
 * shows whatever accent it inherited from an ancestor - the variables are set,
 * but nothing reads them.
 *
 * That failure is invisible in code review and obvious only on screen, which
 * is exactly the kind of mistake worth designing out of the API.
 */
export function sectionProps(name: SectionName): {
  'data-section': SectionName
  style: CSSProperties
} {
  return { 'data-section': name, style: sectionVars(name) }
}

/** Every section, for the /design showcase. */
export const SECTION_NAMES = Object.keys(SECTIONS) as SectionName[]
