import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from './cn'
import type { Tone } from '../../design/status'

/**
 * Badge - the visual layer shared by all former palettes.
 *
 * Colour comes entirely from [data-tone], which resolves --tone / --tone-soft
 * / --tone-ink in components.css. Nine tones, nine token triples, and that is
 * the whole colour surface of the status system. A component here never names
 * a hue.
 *
 * For anything backed by a real domain value, prefer <StatusBadge> - it looks
 * the value up in the registry and animates transitions. Use <Badge> directly
 * only for one-off chips that are not a modelled status.
 */

const SIZES = {
  xs: 'h-5 px-1.5 text-[10px] gap-1',
  sm: 'h-6 px-2 text-[11px] gap-1',
  md: 'h-7 px-2.5 text-xs gap-1.5',
} as const

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  tone?: Tone
  variant?: 'soft' | 'solid' | 'outline'
  size?: keyof typeof SIZES
  dot?: boolean
  icon?: ReactNode
  children?: ReactNode
}

export function Badge({
  tone = 'neutral',
  variant = 'soft',
  size = 'sm',
  dot,
  icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex items-center rounded-chip font-medium whitespace-nowrap align-middle',
        SIZES[size],
        variant === 'soft' &&
          'bg-[var(--tone-soft)] text-[var(--tone-ink)] border border-[color-mix(in_oklab,var(--tone)_22%,transparent)]',
        variant === 'solid' && 'bg-[var(--tone)] text-white',
        variant === 'outline' && 'border border-[var(--tone)] text-[var(--tone-ink)]',
        className
      )}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-chip bg-[var(--tone)]"
        />
      )}
      {icon}
      {children}
    </span>
  )
}

export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  /**
   * Ambient ping for in-flight states. CSS-only, and switched off entirely at
   * data-perf="lean" so a health board full of pinging dots cannot cost frames
   * on a weak terminal.
   */
  pulse?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const DOT_SIZES = { sm: 'h-1.5 w-1.5', md: 'h-2 w-2', lg: 'h-2.5 w-2.5' } as const

export function StatusDot({ tone = 'neutral', pulse, size = 'md', className, ...rest }: StatusDotProps) {
  return (
    <span
      data-tone={tone}
      className={cn('relative inline-flex shrink-0', DOT_SIZES[size], className)}
      {...rest}
    >
      {pulse && (
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-ping rounded-chip bg-[var(--tone)] opacity-60 [animation-duration:1.8s] [[data-perf=lean]_&]:hidden"
        />
      )}
      <span className="relative inline-flex h-full w-full rounded-chip bg-[var(--tone)]" />
    </span>
  )
}
