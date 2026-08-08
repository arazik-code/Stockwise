import { forwardRef, type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { motion, type HTMLMotionProps } from 'motion/react'
import { cn } from './cn'
import { Spinner } from './Spinner'
import { SPRING } from '../../design/motion'

/**
 * The button.
 *
 * Note there is no `color` prop. Colour comes from --accent, which is
 * inherited from the enclosing [data-section]. The SAME <Button variant="solid">
 * is azure on POS and violet on Invoices, automatically. That is how
 * per-section identity propagates without 33 pages configuring anything.
 *
 * The focus-visible ring is defined here ONCE for the whole application. No
 * page hand-rolls one, which is why focus states are finally consistent.
 */
const button = cva(
  [
    'relative inline-flex items-center justify-center gap-2 shrink-0',
    'font-medium whitespace-nowrap select-none rounded-field',
    'transition-[background-color,box-shadow,color,border-color] duration-fast ease-out-soft',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-1)]',
    'disabled:opacity-45 disabled:pointer-events-none',
  ].join(' '),
  {
    variants: {
      variant: {
        solid:
          'bg-[var(--accent)] text-[var(--accent-fg)] shadow-e1 hover:bg-[var(--accent-hover)] hover:shadow-glow',
        soft:
          'bg-[var(--accent-soft)] text-[var(--accent-ink)] hover:bg-[var(--accent-soft-hover)]',
        outline:
          'border border-[var(--border-strong)] bg-surface text-fg hover:bg-surface-2 hover:border-[var(--accent)]',
        ghost:
          'text-fg-muted hover:bg-surface-2 hover:text-fg',
        danger:
          'bg-[var(--negative)] text-white shadow-e1 hover:brightness-110',
        success:
          'bg-[var(--positive)] text-white shadow-e1 hover:brightness-110',
        /* For destructive actions that should not shout until hovered. */
        'danger-ghost':
          'text-[var(--negative)] hover:bg-[var(--negative-soft)]',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs gap-1.5',
        sm: 'h-9 px-3.5 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        /* Sizes itself from [data-density] - use inside tables and on the POS. */
        density: 'h-control px-4 text-density',
      },
      fullWidth: { true: 'w-full' },
    },
    defaultVariants: { variant: 'solid', size: 'md' },
  }
)

type MotionButtonProps = Omit<HTMLMotionProps<'button'>, 'children' | 'ref'>

export interface ButtonProps
  extends MotionButtonProps,
    VariantProps<typeof button> {
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, loading, icon, iconRight, className, children, disabled, ...rest },
  ref
) {
  return (
    <motion.button
      ref={ref}
      type="button"
      // Press feedback is a spring, not a duration - a linear scale on press
      // feels mechanical. Framer adds and removes will-change around this
      // automatically, which is why we never set it statically.
      whileTap={disabled || loading ? undefined : { scale: 0.975 }}
      transition={SPRING.tap}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(button({ variant, size, fullWidth }), className)}
      {...rest}
    >
      {loading ? <Spinner size="sm" tone="current" /> : icon}
      {children}
      {!loading && iconRight}
    </motion.button>
  )
})

/**
 * Icon-only button.
 *
 * `label` is required, not optional. Roughly 80 bare `<button><svg/></button>`
 * elements in the current codebase have no accessible name at all; making the
 * label mandatory means that cannot recur.
 */
export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'iconRight'> {
  icon: ReactNode
  label: string
}

const ICON_SIZES = {
  xs: 'h-7 w-7',
  sm: 'h-9 w-9',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  density: 'h-control aspect-square',
} as const

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ icon, label, size = 'sm', variant = 'ghost', className, ...rest }, ref) {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        aria-label={label}
        title={label}
        className={cn('px-0', ICON_SIZES[size ?? 'sm'], className)}
        {...rest}
      >
        {icon}
      </Button>
    )
  }
)
