import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { cn } from './cn'
import { SPRING } from '../../design/motion'

/**
 * Surfaces.
 *
 * Replaces several hundred instances of
 *   "bg-white rounded-lg border border-slate-200 p-4"
 * and its many near-variants.
 *
 * ── The blur budget is enforced HERE, in code ───────────────────────────────
 *
 * `blur` is not a free-form prop. Real backdrop-filter re-samples its backdrop
 * every frame the backdrop changes, which inside a scroll container means
 * every frame of every scroll, multiplied by the number of blurred elements.
 * On an integrated-GPU POS terminal that is 60fps versus 12fps.
 *
 * So <Card> has no blur option at all - cards appear in lists and grids, which
 * is exactly where blur is forbidden. Only <Surface>, used for fixed chrome,
 * can opt in, and its prop is documented with the six places it is allowed.
 *
 * `surface-glass` (the default) gets the glass LOOK with zero GPU cost:
 * layered translucent gradient, 1px top highlight, hue-tinted shadow. Real
 * glass is about 80% those three things and only 20% blur.
 */

const ELEVATION = {
  0: 'shadow-none',
  1: 'shadow-e1',
  2: 'shadow-e2',
  3: 'shadow-e3',
  4: 'shadow-e4',
} as const

export interface CardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  elevation?: keyof typeof ELEVATION
  /** Faux glass (default) or a flat opaque panel. */
  variant?: 'glass' | 'plain'
  /** Adds hover lift + press feedback. Use for clickable cards only. */
  interactive?: boolean
  /** Paint a 2px accent bar down the leading edge. */
  accent?: boolean
  padded?: boolean
  children?: ReactNode
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { elevation = 2, variant = 'glass', interactive, accent, padded = true, className, children, ...rest },
  ref
) {
  return (
    <motion.div
      ref={ref}
      initial={false}
      whileHover={interactive ? { y: -3, scale: 1.006 } : undefined}
      whileTap={interactive ? { scale: 0.997 } : undefined}
      transition={SPRING.float}
      className={cn(
        variant === 'glass' ? 'surface-glass' : 'surface-plain',
        ELEVATION[elevation],
        padded && 'p-4 sm:p-5',
        interactive && 'cursor-pointer hover:shadow-e3',
        accent && 'border-l-2 border-l-[var(--accent)]',
        'transition-shadow duration-base ease-out-soft',
        className
      )}
      {...rest}
    >
      {children}
    </motion.div>
  )
})

export function CardHeader({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-start justify-between gap-3 border-b border-border pb-3 mb-4', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-sm font-semibold text-fg tracking-tight', className)} {...rest}>
      {children}
    </h3>
  )
}

export function CardDescription({ className, children, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('mt-0.5 text-xs text-fg-subtle', className)} {...rest}>
      {children}
    </p>
  )
}

export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-end gap-2 border-t border-border pt-3 mt-4', className)} {...rest}>
      {children}
    </div>
  )
}

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  level?: 1 | 2 | 3 | 'sunken'
  /**
   * Real backdrop-filter. ALLOWED ON SIX SURFACES ONLY, all of them fixed or
   * transient, with at most three live at once:
   *
   *   sidebar rail · app header strip · modal/sheet scrim ·
   *   popover panel · toast stack · POS floating cart pill
   *
   * Never on anything that repeats or scrolls. If you are rendering inside a
   * .map(), the answer is no - use <Card> instead.
   */
  blur?: boolean
  rounded?: 'none' | 'inset' | 'field' | 'card' | 'surface'
  children?: ReactNode
}

const LEVEL_BG = {
  1: 'bg-surface',
  2: 'bg-surface-2',
  3: 'bg-surface-3',
  sunken: 'bg-sunken',
} as const

const ROUNDED = {
  none: '',
  inset: 'rounded-inset',
  field: 'rounded-field',
  card: 'rounded-card',
  surface: 'rounded-surface',
} as const

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  { level = 1, blur, rounded = 'card', className, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        blur ? 'surface-glass-blur' : LEVEL_BG[level],
        ROUNDED[rounded],
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
})
