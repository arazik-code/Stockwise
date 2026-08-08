import { create } from 'zustand'
import type { Density } from '../design/archetypes'
import { type PerfTier, setPerfTier, clearPerfOverride, getStoredPerfTier } from '../design/perfProbe'

/**
 * Appearance state.
 *
 * Deliberately NOT using zustand's persist middleware. The blocking script in
 * index.html has to read these values before React exists in order to prevent
 * a flash of the wrong theme, so localStorage is written directly with plain
 * keys that the inline script can read without parsing zustand's envelope.
 * Persist would wrap them in {state:{...},version:n} and the boot script would
 * have to JSON.parse it - more code in the blocking path, for nothing.
 */

export type ThemePreference = 'light' | 'dark' | 'system'
export type MotionPreference = 'auto' | 'reduced'

export const THEME_KEY = 'sms-theme'
export const DENSITY_KEY = 'sms-density'
export const MOTION_KEY = 'sms-motion'

const prefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

export const resolveTheme = (pref: ThemePreference): 'light' | 'dark' =>
  pref === 'system' ? (prefersDark() ? 'dark' : 'light') : pref

function readTheme(): ThemePreference {
  const v = localStorage.getItem(THEME_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

function readDensity(): Density {
  const v = localStorage.getItem(DENSITY_KEY)
  return v === 'comfortable' || v === 'compact' || v === 'touch' ? v : 'comfortable'
}

function readMotion(): MotionPreference {
  return localStorage.getItem(MOTION_KEY) === 'reduced' ? 'reduced' : 'auto'
}

interface ThemeState {
  theme: ThemePreference
  /** What `theme` actually resolves to right now. */
  resolved: 'light' | 'dark'
  density: Density
  motion: MotionPreference
  perf: PerfTier

  setTheme: (t: ThemePreference) => void
  setDensity: (d: Density) => void
  setMotion: (m: MotionPreference) => void
  setPerf: (p: PerfTier | 'auto') => void
  /** Called by the OS media-query listener. */
  syncSystemTheme: () => void
}

function applyTheme(pref: ThemePreference) {
  const resolved = resolveTheme(pref)
  const el = document.documentElement
  el.dataset.theme = resolved
  el.style.colorScheme = resolved
  return resolved
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readTheme(),
  resolved: resolveTheme(readTheme()),
  density: readDensity(),
  motion: readMotion(),
  perf: getStoredPerfTier() ?? 'full',

  setTheme: (t) => {
    localStorage.setItem(THEME_KEY, t)
    set({ theme: t, resolved: applyTheme(t) })
  },

  setDensity: (d) => {
    localStorage.setItem(DENSITY_KEY, d)
    document.documentElement.dataset.density = d
    set({ density: d })
  },

  setMotion: (m) => {
    localStorage.setItem(MOTION_KEY, m)
    // DIRECTION RULE: this attribute can only ever ADD reduction. The
    // prefers-reduced-motion media query in components.css is unconditional,
    // so a user choosing 'auto' can never re-enable motion the OS asked us to
    // suppress. Overriding a stated accessibility preference upward is a bug.
    if (m === 'reduced') document.documentElement.dataset.motion = 'reduced'
    else delete document.documentElement.dataset.motion
    set({ motion: m })
  },

  setPerf: (p) => {
    if (p === 'auto') {
      clearPerfOverride()
      set({ perf: 'full' })
    } else {
      setPerfTier(p)
      set({ perf: p })
    }
  },

  syncSystemTheme: () => {
    if (get().theme !== 'system') return
    set({ resolved: applyTheme('system') })
  },
}))

/**
 * Re-apply stored preferences to the DOM and start watching the OS theme.
 *
 * The inline boot script has already set these attributes; this re-asserts
 * them from the same source of truth so the store and the DOM cannot disagree
 * if localStorage was edited between page load and hydration.
 */
export function initTheme(): () => void {
  const s = useThemeStore.getState()
  applyTheme(s.theme)
  document.documentElement.dataset.density = s.density
  if (s.motion === 'reduced') document.documentElement.dataset.motion = 'reduced'

  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => useThemeStore.getState().syncSystemTheme()
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
