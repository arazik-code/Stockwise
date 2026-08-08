/**
 * Layout archetypes.
 *
 * ── Why archetypes, and not 33 bespoke designs ──────────────────────────────
 *
 * The brief asked for "every section with its own design". Read literally as
 * one hue per route that produces 33 hues; the twelve /online routes alone
 * would sit about 6 degrees apart in OKLCH and be indistinguishable from each
 * other while collectively reading as a rainbow. That is the exact failure
 * mode the brief was rejecting - variety without system.
 *
 * So identity is split in two:
 *
 *   HUE tells you WHERE IN THE BUSINESS you are (see sections.ts). Local is
 *   cool, Online is violet-magenta, Admin is desaturated cyan-slate.
 *
 *   ARCHETYPE tells you WHAT KIND OF WORK this screen does - and that is what
 *   actually makes a section feel distinct: its layout, its density, its
 *   motion signature, how it visualises data, whether it is glass or solid.
 *   A 6-degree hue shift is invisible; a different working surface is not.
 *
 * The result reads as one product because the lightness/chroma ladder never
 * varies, while each kind of screen genuinely has its own design.
 */

export type ArchetypeName =
  | 'command'
  | 'ledger'
  | 'console'
  | 'catalog'
  | 'profile'
  | 'config'

export type Density = 'comfortable' | 'compact' | 'touch'

export interface Archetype {
  /** Default density for screens of this kind. */
  density: Density
  /**
   * Whether page-level containers use translucent glass.
   *
   * `false` on Console is the deliberate exception: the POS is used standing,
   * at speed, under retail lighting, during barcode-scan bursts. Translucency
   * there costs cashier speed and GPU for no benefit. It still gets hue-tinted
   * shadows, the mesh backdrop, full motion and success bursts - it simply
   * earns its expensive look through clarity rather than blur.
   */
  glass: boolean
  /** Ambient mesh behind page content. */
  mesh: boolean
  /** Animate the mesh (only ever honoured at data-perf="full"). */
  meshLive: boolean
  /** Page-level max width, or null to fill. */
  maxWidth: string | null
  /** Body padding. */
  pad: string
  /** How lists/rows animate in. */
  entrance: 'stagger' | 'fade' | 'none'
  /** One-line description, rendered on the /design showcase. */
  note: string
}

export const ARCHETYPES: Record<ArchetypeName, Archetype> = {
  /**
   * COMMAND - dashboards and health boards. Read at a glance, from a distance,
   * often left open on a second screen. Big numbers, charts, live status.
   */
  command: {
    density: 'comfortable',
    glass: true,
    mesh: true,
    meshLive: true,
    maxWidth: '1400px',
    pad: 'p-4 sm:p-6',
    entrance: 'stagger',
    note: 'Glance-and-go. Stat rail, charts, live status, animated mesh.',
  },

  /**
   * LEDGER - tables of records. Invoices, orders, stock, audit. The user is
   * scanning for one row among thousands, so density wins and the chrome
   * stays out of the way.
   */
  ledger: {
    density: 'compact',
    glass: true,
    mesh: true,
    meshLive: false,
    maxWidth: '1600px',
    pad: 'p-4 sm:p-6',
    entrance: 'fade',
    note: 'Dense rows in a generous glass frame. Sticky filter bar, virtualised.',
  },

  /**
   * CONSOLE - POS and Refunds. Operated, not browsed. Standing, at speed,
   * sometimes gloved. Solid surfaces, big targets, glow reserved for state.
   */
  console: {
    density: 'touch',
    glass: false,
    mesh: true,
    meshLive: false,
    maxWidth: null,
    pad: 'p-3 sm:p-4',
    entrance: 'none',
    note: 'Solid, high-contrast, 60px targets. Glow only signals state changes.',
  },

  /**
   * CATALOG - product grids. Image-led, browsed visually.
   */
  catalog: {
    density: 'comfortable',
    glass: true,
    mesh: true,
    meshLive: false,
    maxWidth: '1600px',
    pad: 'p-4 sm:p-6',
    entrance: 'stagger',
    note: 'Image-first cards, hover lift, tinted shadow tracking the image.',
  },

  /**
   * PROFILE - people. Clients, users, CRM. Master list plus a rich detail
   * panel with history.
   */
  profile: {
    density: 'comfortable',
    glass: true,
    mesh: true,
    meshLive: false,
    maxWidth: '1500px',
    pad: 'p-4 sm:p-6',
    entrance: 'stagger',
    note: 'Master/detail with an activity timeline. Avatars, tier badges.',
  },

  /**
   * CONFIG - settings, integrations, designers. Deliberately recessive: the
   * user came to change one thing and leave. Low chroma, generous whitespace,
   * a single sticky save affordance.
   */
  config: {
    density: 'comfortable',
    glass: true,
    mesh: false,
    meshLive: false,
    maxWidth: '900px',
    pad: 'p-4 sm:p-6',
    entrance: 'fade',
    note: 'Recessive. Narrow measure, grouped forms, sticky save bar.',
  },
}
