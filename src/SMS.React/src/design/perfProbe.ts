/**
 * Graphics performance probe.
 *
 * The Luminous Depth direction accepts real backdrop-filter on a handful of
 * fixed surfaces. On a mid-range Windows POS terminal with integrated
 * graphics, that can be the difference between 60fps and 12fps. Rather than
 * guess which machine we are on, we measure once and persist the answer.
 *
 * This is the honest response to an accepted risk: the risk is real, so it
 * gets a switch, and the switch has a sensible automatic default.
 *
 * Result is written to <html data-perf> and localStorage. Users can override
 * it from Settings; an explicit choice is never overwritten by the probe.
 */

export type PerfTier = 'full' | 'balanced' | 'lean'

export const PERF_KEY = 'sms-perf'
export const PERF_AUTO_KEY = 'sms-perf-auto'

/** p90 frame time above this is unusable; between is workable. */
const LEAN_THRESHOLD_MS = 22
const BALANCED_THRESHOLD_MS = 14
const SAMPLE_FRAMES = 48

export function applyPerfTier(tier: PerfTier) {
  document.documentElement.dataset.perf = tier
}

export function getStoredPerfTier(): PerfTier | null {
  const v = localStorage.getItem(PERF_KEY)
  return v === 'full' || v === 'balanced' || v === 'lean' ? v : null
}

/** An explicit user choice. Pins the tier and stops the probe re-deciding. */
export function setPerfTier(tier: PerfTier) {
  localStorage.setItem(PERF_KEY, tier)
  localStorage.setItem(PERF_AUTO_KEY, 'false')
  applyPerfTier(tier)
}

/** Hand control back to the probe. */
export function clearPerfOverride() {
  localStorage.setItem(PERF_AUTO_KEY, 'true')
  localStorage.removeItem(PERF_KEY)
}

const isAuto = () => localStorage.getItem(PERF_AUTO_KEY) !== 'false'

/**
 * Measure blur cost over ~48 frames against a moving backdrop.
 *
 * Uses p90 rather than the mean deliberately: a machine that holds 8ms most of
 * the time but spikes to 40ms every tenth frame feels broken while averaging
 * fine. Jank lives in the tail.
 */
function measureBlurCost(): Promise<number> {
  return new Promise((resolve) => {
    const host = document.createElement('div')
    host.setAttribute('aria-hidden', 'true')
    host.style.cssText =
      'position:fixed;left:-9999px;top:0;width:320px;height:320px;pointer-events:none;' +
      'contain:strict;background:linear-gradient(45deg,#f00,#00f,#0f0);background-size:200% 200%;'

    const blurred = document.createElement('div')
    blurred.style.cssText =
      'position:absolute;inset:0;backdrop-filter:blur(16px) saturate(1.6);' +
      '-webkit-backdrop-filter:blur(16px) saturate(1.6);'
    host.appendChild(blurred)
    document.body.appendChild(host)

    const frames: number[] = []
    let last = performance.now()
    let count = 0

    const tick = (now: number) => {
      frames.push(now - last)
      last = now
      // Keep the backdrop changing, or the compositor caches the blur and the
      // measurement flatters the machine.
      host.style.backgroundPosition = `${(count * 7) % 200}% ${(count * 5) % 200}%`
      count++

      if (count < SAMPLE_FRAMES) {
        requestAnimationFrame(tick)
      } else {
        host.remove()
        const sorted = frames.slice(1).sort((a, b) => a - b)
        resolve(sorted[Math.floor(sorted.length * 0.9)] ?? 16)
      }
    }
    requestAnimationFrame(tick)
  })
}

/**
 * Decide a tier and apply it. Safe to call unconditionally at boot.
 *
 * Runs off the critical path and resolves in roughly 350ms on a healthy
 * machine. Returns the tier actually in force.
 */
export async function runPerfProbe(): Promise<PerfTier> {
  // Respect an explicit user choice - never overrule it.
  if (!isAuto()) {
    const pinned = getStoredPerfTier() ?? 'full'
    applyPerfTier(pinned)
    return pinned
  }

  // Fast path: a low-core machine is not going to composite full-screen blur
  // at 60fps, and spending 350ms proving it is wasted startup time.
  const cores = navigator.hardwareConcurrency ?? 8
  if (cores <= 4) {
    localStorage.setItem(PERF_KEY, 'lean')
    applyPerfTier('lean')
    return 'lean'
  }

  // Reduced motion implies "calm and cheap"; do not burn frames measuring.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    localStorage.setItem(PERF_KEY, 'balanced')
    applyPerfTier('balanced')
    return 'balanced'
  }

  let tier: PerfTier = 'full'
  try {
    const p90 = await measureBlurCost()
    tier = p90 > LEAN_THRESHOLD_MS ? 'lean' : p90 > BALANCED_THRESHOLD_MS ? 'balanced' : 'full'
  } catch {
    // A probe failure must never block boot. Assume the middle.
    tier = 'balanced'
  }

  localStorage.setItem(PERF_KEY, tier)
  applyPerfTier(tier)
  return tier
}
