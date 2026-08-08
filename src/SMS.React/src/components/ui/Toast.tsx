import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from './cn'
import { toastVariants } from '../../design/variants'
import type { Tone } from '../../design/status'

/**
 * Toasts.
 *
 * ══ THE PUBLIC SIGNATURE IS UNCHANGED ═══════════════════════════════════════
 *
 *     showToast(text: string, type?: 'success' | 'error' | 'info' | 'warning')
 *
 * There are roughly sixty call sites across the app. Keeping the signature
 * byte-compatible means none of them have to change, which keeps this rewrite
 * inside the Presentation Boundary: no page's logic is touched to gain exit
 * animations, stacking, hover-pause and actions.
 *
 * What is new (all optional, all additive):
 *   - a real EXIT animation. The old implementation just spliced the item out
 *     of an array, so toasts vanished instantly. CSS alone cannot animate an
 *     unmount; this is the clearest thing Framer Motion buys us.
 *   - hover pauses the dismiss timer. Reading a 4-second error while it
 *     disappears under the cursor was a real annoyance.
 *   - `layout` on the stack, so remaining toasts slide up smoothly.
 *   - an optional action button and a de-duplicating `id`.
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastOptions {
  /** ms. Defaults to 4000, matching the previous behaviour. */
  duration?: number
  /** Passing the same id replaces the existing toast instead of stacking. */
  id?: string
  action?: { label: string; onClick: () => void }
}

interface ToastMessage {
  key: string
  text: string
  type: ToastType
  duration: number
  action?: ToastOptions['action']
}

const TONE: Record<ToastType, Tone> = {
  success: 'positive',
  error: 'negative',
  info: 'info',
  warning: 'caution',
}

const ICON = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
} as const

const DEFAULT_DURATION = 4000
const MAX_VISIBLE = 4

let seq = 0
let listeners: Array<(fn: (prev: ToastMessage[]) => ToastMessage[]) => void> = []

const emit = (fn: (prev: ToastMessage[]) => ToastMessage[]) => listeners.forEach((l) => l(fn))

export function showToast(text: string, type: ToastType = 'info', options: ToastOptions = {}) {
  const key = options.id ?? `t${++seq}`
  const msg: ToastMessage = {
    key,
    text,
    type,
    duration: options.duration ?? DEFAULT_DURATION,
    action: options.action,
  }
  emit((prev) => {
    const without = prev.filter((t) => t.key !== key)
    // Oldest falls off the top rather than letting the stack grow unbounded
    // during a burst (a failed sync can fire a dozen errors at once).
    return [...without, msg].slice(-MAX_VISIBLE)
  })
  return key
}

export function dismissToast(key: string) {
  emit((prev) => prev.filter((t) => t.key !== key))
}

function ToastItem({ msg, onDismiss }: { msg: ToastMessage; onDismiss: (k: string) => void }) {
  const Icon = ICON[msg.type]
  const remaining = useRef(msg.duration)
  const startedAt = useRef(Date.now())
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const start = useCallback(() => {
    startedAt.current = Date.now()
    timer.current = setTimeout(() => onDismiss(msg.key), remaining.current)
  }, [msg.key, onDismiss])

  const pause = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    remaining.current -= Date.now() - startedAt.current
  }, [])

  useEffect(() => {
    start()
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [start])

  return (
    <motion.div
      layout
      variants={toastVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      data-tone={TONE[msg.type]}
      onMouseEnter={pause}
      onMouseLeave={start}
      role={msg.type === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3',
        'rounded-card border border-border-glass px-4 py-3 text-sm shadow-e3',
        // One of the six surfaces allowed real blur: fixed, few, transient.
        'bg-[color-mix(in_oklab,var(--surface-1)_86%,transparent)] backdrop-blur-[var(--blur-1)]'
      )}
    >
      <span className="mt-0.5 shrink-0 text-[var(--tone)]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-fg">{msg.text}</span>
      {msg.action && (
        <button
          type="button"
          onClick={() => {
            msg.action?.onClick()
            onDismiss(msg.key)
          }}
          className="shrink-0 rounded-inset px-1.5 py-0.5 text-xs font-semibold text-[var(--tone)] hover:bg-[var(--tone-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
        >
          {msg.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(msg.key)}
        aria-label="Fermer"
        className="shrink-0 rounded-inset text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  )
}

/** Mount once, in MainLayout. */
export function ToastViewport() {
  const [messages, setMessages] = useState<ToastMessage[]>([])

  useEffect(() => {
    const listener = (fn: (prev: ToastMessage[]) => ToastMessage[]) => setMessages(fn)
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }, [])

  const onDismiss = useCallback((key: string) => {
    setMessages((prev) => prev.filter((t) => t.key !== key))
  }, [])

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2">
      <AnimatePresence mode="popLayout" initial={false}>
        {messages.map((m) => (
          <ToastItem key={m.key} msg={m} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  )
}

export default ToastViewport
