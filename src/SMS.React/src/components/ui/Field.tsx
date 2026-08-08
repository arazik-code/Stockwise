import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './cn'

/**
 * Form controls.
 *
 * ══ EVERY CONTROL HERE WRAPS A REAL NATIVE ELEMENT ══════════════════════════
 *
 * This is a hard architectural constraint, not a preference.
 *
 * PosPage.tsx:105-106 gates its document-level keydown handler on
 *
 *     const tag = (e.target as HTMLElement)?.tagName
 *     if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { ... return }
 *
 * The POS binds Insert / Home / End / Enter / Escape globally so a cashier can
 * drive the till without touching the mouse. That check is what stops those
 * keys firing while someone is typing in the search box. Swap in a div-based
 * combobox or a custom checkbox and `tagName` no longer matches - Enter inside
 * a "select" would open checkout mid-edit, on a live till, with a customer
 * waiting.
 *
 * So: <Select> renders <select>. <Checkbox> renders <input type="checkbox">.
 * Style the shell, never replace the element.
 */

const CONTROL_BASE = [
  'w-full rounded-field bg-surface text-fg text-sm',
  'border border-[var(--border)]',
  'placeholder:text-fg-subtle',
  'transition-[border-color,box-shadow,background-color] duration-fast ease-out-soft',
  'focus:outline-none focus:border-[var(--accent)]',
  'focus:shadow-[0_0_0_3px_var(--accent-ring)]',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-sunken',
].join(' ')

const SIZES = {
  sm: 'h-9 px-3',
  md: 'h-10 px-3.5',
  lg: 'h-12 px-4 text-base',
  density: 'h-control px-3.5 text-density',
} as const

type Size = keyof typeof SIZES

interface FieldShellProps {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  className?: string
  children: ReactNode
  htmlFor?: string
}

/** Label + control + hint/error. Shared by every control below. */
function FieldShell({ label, hint, error, required, className, children, htmlFor }: FieldShellProps) {
  return (
    <div className={cn('block', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 block text-xs font-medium text-fg-muted"
        >
          {label}
          {required && <span className="ml-0.5 text-[var(--negative)]">*</span>}
        </label>
      )}
      {children}
      {(error || hint) && (
        <span
          className={cn(
            'mt-1 block text-xs',
            error ? 'text-[var(--negative)]' : 'text-fg-subtle'
          )}
        >
          {error || hint}
        </span>
      )}
    </div>
  )
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  size?: Size
  leading?: ReactNode
  trailing?: ReactNode
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, size = 'md', leading, trailing, className, wrapperClassName, id, required, ...rest },
  ref
) {
  const auto = useId()
  const inputId = id ?? auto

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
      htmlFor={inputId}
    >
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle [&>svg]:h-4 [&>svg]:w-4">
            {leading}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(
            CONTROL_BASE,
            SIZES[size],
            leading && 'pl-9',
            trailing && 'pr-9',
            error && 'border-[var(--negative)] focus:border-[var(--negative)]',
            className
          )}
          {...rest}
        />
        {trailing && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle [&>svg]:h-4 [&>svg]:w-4">
            {trailing}
          </span>
        )}
      </div>
    </FieldShell>
  )
})

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  size?: Size
  wrapperClassName?: string
}

/** A real <select>. See the note at the top of this file. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, size = 'md', className, wrapperClassName, children, id, required, ...rest },
  ref
) {
  const auto = useId()
  const selectId = id ?? auto

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
      htmlFor={selectId}
    >
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(
            CONTROL_BASE,
            SIZES[size],
            'appearance-none pr-9 cursor-pointer',
            error && 'border-[var(--negative)]',
            className
          )}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
      </div>
    </FieldShell>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  wrapperClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, wrapperClassName, id, required, rows = 3, ...rest },
  ref
) {
  const auto = useId()
  const areaId = id ?? auto

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
      htmlFor={areaId}
    >
      <textarea
        ref={ref}
        id={areaId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(
          CONTROL_BASE,
          'px-3.5 py-2.5 resize-y min-h-[72px]',
          error && 'border-[var(--negative)]',
          className
        )}
        {...rest}
      />
    </FieldShell>
  )
})

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
  hint?: ReactNode
  indeterminate?: boolean
}

/**
 * A real <input type="checkbox">, visually restyled via accent-color plus a
 * custom ring. Using the native control keeps keyboard behaviour, form
 * participation, indeterminate state and the POS tagName gate all intact.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, indeterminate, className, id, disabled, ...rest },
  ref
) {
  const auto = useId()
  const boxId = id ?? auto

  return (
    <div className={cn('flex items-start gap-2.5', disabled && 'opacity-50')}>
      <input
        ref={(el) => {
          if (el) el.indeterminate = Boolean(indeterminate)
          if (typeof ref === 'function') ref(el)
          else if (ref) ref.current = el
        }}
        id={boxId}
        type="checkbox"
        disabled={disabled}
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded-[5px]',
          'border border-[var(--border-strong)] bg-surface',
          'accent-[var(--accent)]',
          'transition-[box-shadow,border-color] duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed',
          className
        )}
        {...rest}
      />
      {(label || hint) && (
        <label htmlFor={boxId} className="cursor-pointer select-none leading-tight">
          {label && <span className="block text-sm text-fg">{label}</span>}
          {hint && <span className="mt-0.5 block text-xs text-fg-subtle">{hint}</span>}
        </label>
      )}
    </div>
  )
})

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode
  hint?: ReactNode
}

/**
 * Toggle. Still a real checkbox underneath - the track and thumb are a styled
 * sibling, so form semantics and keyboard support are the browser's.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, hint, className, id, disabled, ...rest },
  ref
) {
  const auto = useId()
  const switchId = id ?? auto

  return (
    <div className={cn('flex items-center justify-between gap-4', disabled && 'opacity-50', className)}>
      {(label || hint) && (
        <label htmlFor={switchId} className="cursor-pointer select-none">
          {label && <span className="block text-sm font-medium text-fg">{label}</span>}
          {hint && <span className="mt-0.5 block text-xs text-fg-subtle">{hint}</span>}
        </label>
      )}
      <span className="relative inline-flex shrink-0">
        <input
          ref={ref}
          id={switchId}
          type="checkbox"
          role="switch"
          disabled={disabled}
          className="peer sr-only"
          {...rest}
        />
        <span
          aria-hidden="true"
          className={cn(
            'block h-6 w-10 cursor-pointer rounded-chip bg-[var(--border-strong)]',
            'transition-colors duration-base ease-out-soft',
            'peer-checked:bg-[var(--accent)]',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent-ring)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--surface-1)]',
            'peer-disabled:cursor-not-allowed'
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-chip bg-white shadow-e1',
            'transition-transform duration-base ease-out-back',
            'peer-checked:translate-x-4'
          )}
        />
      </span>
    </div>
  )
})
