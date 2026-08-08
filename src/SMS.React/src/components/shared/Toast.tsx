/**
 * COMPATIBILITY BRIDGE - deleted in Phase 2.
 *
 * The real implementation now lives in components/ui/Toast.tsx. Roughly sixty
 * files import `showToast` from this path; re-exporting means every one of
 * them picks up exit animations, hover-pause and the new styling without a
 * single import line changing - which keeps the Toast rewrite inside the
 * Presentation Boundary.
 *
 * Once the archetype workers have converted their pages to import from
 * `@/components/ui`, this file goes away.
 */
export { showToast, dismissToast, ToastViewport, default } from '../ui/Toast'
export type { ToastType, ToastOptions } from '../ui/Toast'
