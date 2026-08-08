import { extendTailwindMerge } from 'tailwind-merge'
import { clsx, type ClassValue } from 'clsx'

/**
 * Class merger, taught about this design system's custom utilities.
 *
 * ── Why tailwind-merge at all ───────────────────────────────────────────────
 *
 * Every primitive here accepts `className`, and seven people will pass
 * overrides to them from 33 pages. Without a merge step, a caller's `px-6` and
 * a variant's `px-4` BOTH end up in the class list, and which one wins depends
 * on their order in the compiled stylesheet - which Tailwind is free to
 * reorder. That is a nondeterministic bug class you cannot debug from the
 * markup, and it is the single best argument for the ~9KB these three
 * packages cost.
 *
 * ── Why extendTailwindMerge and not the default export ──────────────────────
 *
 * Out of the box, tailwind-merge has never heard of `shadow-e2`,
 * `rounded-card` or `bg-surface-2`. It would treat `shadow-e2 shadow-e4` as
 * two unrelated classes and emit both - silently reintroducing the exact
 * conflict it exists to prevent. Every custom utility in theme.css has to be
 * declared here as a class group.
 *
 * If you add a utility to theme.css, add it here in the same commit.
 */
/**
 * Custom class-group ids must be declared to the generic, or tailwind-merge's
 * types reject them (it only knows its own DefaultClassGroupIds otherwise).
 */
type CustomGroup =
  | 'surface-treatment'
  | 'density-h'
  | 'density-px'
  | 'density-py'
  | 'density-text'

const twMerge = extendTailwindMerge<CustomGroup>({
  extend: {
    theme: {
      radius: ['inset', 'field', 'card', 'surface', 'chip'],
    },
    classGroups: {
      'bg-color': [
        {
          bg: [
            'canvas', 'surface', 'surface-2', 'surface-3', 'sunken',
            'accent', 'accent-hover', 'accent-soft',
            'positive', 'caution', 'negative', 'critical',
            'info', 'progress', 'special', 'neutral',
            'positive-soft', 'caution-soft', 'negative-soft', 'info-soft',
            'tone', 'tone-soft',
            'whatsapp', 'whatsapp-soft',
          ],
        },
      ],
      'text-color': [
        {
          text: [
            'fg', 'fg-muted', 'fg-subtle',
            'accent', 'accent-fg', 'accent-ink',
            'positive', 'caution', 'negative', 'critical',
            'info', 'progress', 'special', 'neutral',
            'positive-ink', 'caution-ink', 'negative-ink', 'info-ink',
            'tone', 'tone-ink',
            'whatsapp', 'whatsapp-ink',
          ],
        },
      ],
      'border-color': [
        { border: ['border', 'border-strong', 'border-glass', 'accent', 'tone'] },
      ],
      'ring-color': [{ ring: ['accent', 'tone', 'border'] }],
      'shadow': [{ shadow: ['e1', 'e2', 'e3', 'e4', 'glow', 'glow-soft'] }],
      'duration': [{ duration: ['instant', 'fast', 'base', 'slow', 'slower'] }],
      'ease': [{ ease: ['out-soft', 'in-out-soft', 'out-back'] }],
      // Standalone utilities from theme.css / components.css. Each is its own
      // group so a later one replaces an earlier one rather than stacking.
      'surface-treatment': ['surface-glass', 'surface-glass-blur', 'surface-plain'],
      'density-h': ['h-control', 'h-row'],
      'density-px': ['px-density'],
      'density-py': ['py-density'],
      'density-text': ['text-density'],
    },
    conflictingClassGroups: {
      // A density height utility and a plain Tailwind height are the same
      // decision; the last one written should win.
      'density-h': ['h'],
      'density-px': ['px'],
      'density-py': ['py'],
      'density-text': ['font-size'],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
