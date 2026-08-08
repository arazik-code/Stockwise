/**
 * Reusable Framer Motion choreography.
 *
 * Every animated pattern in the app comes from here. A page or component that
 * needs a motion behaviour not in this file must have it ADDED here first (and
 * shown on /design), rather than inventing a one-off - that is the mechanism
 * that keeps 33 pages moving like one product.
 */

import type { Variants } from 'motion/react'
import { DUR, EASE, SPRING, staggerDelay } from './motion'

/**
 * Page transition.
 *
 * Used with <AnimatePresence mode="wait">. `mode="wait"` is MANDATORY here and
 * is not a stylistic choice: the default mode mounts the incoming route while
 * the outgoing one is still alive, which would briefly double-register
 * PosPage's document-level key listeners and the SignalR subscriptions in
 * useSignalR. Two POS key handlers at once means every scan fires twice.
 *
 * Key the presence child on location.pathname ONLY - keying on the whole
 * location object re-runs the animation on every search-param change.
 */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8, filter: 'blur(3px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: DUR.base, ease: EASE.outSoft },
  },
  exit: {
    opacity: 0,
    y: -6,
    filter: 'blur(2px)',
    transition: { duration: DUR.fast, ease: EASE.inOutSoft },
  },
}

/** Container for a staggered list. Children use `listItem`. */
export const listContainer: Variants = {
  animate: { transition: { staggerChildren: 0 } },
}

/**
 * List item entrance. Pass the index as `custom`.
 *
 * The delay is capped (see staggerDelay) so long lists do not take seconds to
 * appear. Above ~100 rows, do not use this at all - render plain elements.
 */
export const listItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: DUR.base, ease: EASE.outSoft, delay: staggerDelay(i) },
  }),
  exit: { opacity: 0, y: -6, transition: { duration: DUR.fast } },
}

/** Modal / sheet scrim. */
export const scrimVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DUR.fast } },
  exit: { opacity: 0, transition: { duration: DUR.fast } },
}

/**
 * Modal panel.
 *
 * Enter springs, exit does NOT. A spring on exit reads as sluggish - the panel
 * appears to hesitate on the way out. Exits should be quick and linear-ish.
 */
export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0, transition: SPRING.panel },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 6,
    transition: { duration: DUR.fast, ease: EASE.inOutSoft },
  },
}

export const sheetVariants = {
  right: {
    initial: { x: '100%' },
    animate: { x: 0, transition: SPRING.panel },
    exit: { x: '100%', transition: { duration: DUR.base, ease: EASE.inOutSoft } },
  } satisfies Variants,
  bottom: {
    initial: { y: '100%' },
    animate: { y: 0, transition: SPRING.panel },
    exit: { y: '100%', transition: { duration: DUR.base, ease: EASE.inOutSoft } },
  } satisfies Variants,
  left: {
    initial: { x: '-100%' },
    animate: { x: 0, transition: SPRING.panel },
    exit: { x: '-100%', transition: { duration: DUR.base, ease: EASE.inOutSoft } },
  } satisfies Variants,
}

/** Popover / dropdown / tooltip. Small travel, fast, slight scale from origin. */
export const popoverVariants: Variants = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0, transition: SPRING.snappy },
  exit: { opacity: 0, scale: 0.98, y: -2, transition: { duration: DUR.instant } },
}

/** Toast. Enters from the right, exits the same way; the stack re-flows via `layout`. */
export const toastVariants: Variants = {
  initial: { opacity: 0, x: 24, scale: 0.96 },
  animate: { opacity: 1, x: 0, scale: 1, transition: SPRING.snappy },
  exit: { opacity: 0, x: 24, scale: 0.96, transition: { duration: DUR.fast } },
}

/**
 * Status label swap, used inside <AnimatePresence mode="popLayout">.
 *
 * The reduced-motion branch keeps the crossfade but drops transform and blur -
 * feedback is preserved, motion is not. That distinction matters: removing the
 * feedback entirely would make the reduced-motion experience worse than the
 * static original, not merely calmer.
 */
export const statusLabel = (reduce: boolean): Variants =>
  reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: DUR.instant } },
        exit: { opacity: 0, transition: { duration: DUR.instant } },
      }
    : {
        initial: { opacity: 0, y: 6, scale: 0.92, filter: 'blur(4px)' },
        animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: SPRING.snappy },
        exit: { opacity: 0, y: -6, scale: 0.92, filter: 'blur(4px)', transition: { duration: DUR.fast } },
      }

/** Skeleton -> content. No y offset: a shifting skeleton is worse than none. */
export const contentReveal: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.16, ease: EASE.outSoft } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
}

/** Card hover lift, for Catalog tiles. Transform-only, so it composites. */
export const cardHover = {
  rest: { y: 0, scale: 1 },
  hover: { y: -4, scale: 1.012, transition: SPRING.float },
  tap: { scale: 0.995, transition: SPRING.tap },
}

/** Accordion / expandable table row. */
export const collapseVariants: Variants = {
  initial: { height: 0, opacity: 0 },
  animate: {
    height: 'auto',
    opacity: 1,
    transition: { height: { duration: DUR.base, ease: EASE.outSoft }, opacity: { duration: DUR.fast, delay: 0.05 } },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: { height: { duration: DUR.fast, ease: EASE.inOutSoft }, opacity: { duration: DUR.instant } },
  },
}
