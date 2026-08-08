import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { cn } from './cn'
import { IconButton } from './Button'
import { modalVariants, scrimVariants, sheetVariants } from '../../design/variants'

/**
 * Modal and Sheet.
 *
 * Replaces shared/Modal.tsx plus roughly twenty copy-pasted
 *   "fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
 * blocks, none of which had a focus trap, a portal, or an exit animation.
 *
 * ══ closeOnEsc DEFAULTS TO FALSE - THIS IS DELIBERATE ═══════════════════════
 *
 * The obvious default would be `true`. It is wrong here, and shipping it would
 * break a live till.
 *
 * PosPage binds a document-level keydown listener in CAPTURE phase and handles
 * Escape itself (PosPage.tsx:144). Several POS modals also own Escape while
 * open - CheckoutDialog.tsx:170/208, CashDrawerModal.tsx:59,
 * ProductVariantsModal.tsx:14 - and PosPage explicitly defers to them via
 * early returns with comments saying so at lines 88-89 and 101-102.
 *
 * If this component also grabbed Escape, two handlers would fire for one press
 * and the cart could clear underneath an open checkout.
 *
 * A modal may opt in with closeOnEsc only AFTER its own handler is removed,
 * and removing one is a change above `return (` - so it needs sign-off per the
 * migration contract.
 */

let openCount = 0

function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    // Reference-counted: nested modals must not each restore overflow on close.
    openCount += 1
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      openCount -= 1
      if (openCount === 0) document.body.style.overflow = prev
    }
  }, [active])
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Focus trap + focus restore. */
function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    const restoreTo = document.activeElement as HTMLElement | null
    const node = ref.current
    if (!node) return

    // Focus the first field, or the panel itself if there is nothing focusable.
    const first = node.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? node).focus({ preventScroll: true })

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      )
      if (items.length === 0) return
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      restoreTo?.focus?.({ preventScroll: true })
    }
  }, [active])

  return ref
}

const WIDTHS = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-4xl',
  '3xl': 'max-w-6xl',
  full: 'max-w-[min(96vw,1400px)]',
} as const

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  size?: keyof typeof WIDTHS
  footer?: ReactNode
  children?: ReactNode
  /** See the long note above before enabling. */
  closeOnEsc?: boolean
  closeOnBackdrop?: boolean
  showClose?: boolean
  className?: string
  bodyClassName?: string
}

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
  closeOnEsc = false,
  closeOnBackdrop = true,
  showClose = true,
  className,
  bodyClassName,
}: ModalProps) {
  useScrollLock(open)
  const panelRef = useFocusTrap(open)

  useEffect(() => {
    if (!open || !closeOnEsc) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, closeOnEsc, onClose])

  // mousedown, not click: a click that STARTS inside the panel and ends on the
  // backdrop (text selection dragged outward) must not close the modal.
  const onBackdropMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!closeOnBackdrop) return
      if (e.target === e.currentTarget) onClose()
    },
    [closeOnBackdrop, onClose]
  )

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            variants={scrimVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onMouseDown={onBackdropMouseDown}
            /* One of the six surfaces permitted real blur: full-screen, one at
               a time, and the backdrop behind it is frozen while open. */
            className="absolute inset-0 bg-[oklch(0.15_0.02_262_/_0.5)] backdrop-blur-[var(--blur-3)]"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              'relative flex max-h-[90vh] w-full flex-col outline-none',
              'rounded-surface border border-border-glass bg-surface shadow-e4',
              WIDTHS[size],
              className
            )}
          >
            {(title || showClose) && (
              <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                <div className="min-w-0">
                  {title && (
                    <h2 className="text-sm font-semibold tracking-tight text-fg">{title}</h2>
                  )}
                  {description && (
                    <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>
                  )}
                </div>
                {showClose && (
                  <IconButton
                    icon={<X className="h-4 w-4" />}
                    label="Fermer"
                    size="xs"
                    onClick={onClose}
                    className="-mr-1 -mt-0.5"
                  />
                )}
              </div>
            )}

            <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>
              {children}
            </div>

            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export interface SheetProps extends Omit<ModalProps, 'size'> {
  side?: 'right' | 'left' | 'bottom'
  size?: 'sm' | 'md' | 'lg' | 'full'
}

const SHEET_SIZE = {
  right: { sm: 'w-full max-w-sm', md: 'w-full max-w-md', lg: 'w-full max-w-2xl', full: 'w-full' },
  left: { sm: 'w-full max-w-sm', md: 'w-full max-w-md', lg: 'w-full max-w-2xl', full: 'w-full' },
  bottom: { sm: 'h-[40vh]', md: 'h-[60vh]', lg: 'h-[85vh]', full: 'h-[100dvh]' },
} as const

/** Side/bottom drawer. Same trap, lock and Escape policy as Modal. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  side = 'right',
  size = 'md',
  footer,
  children,
  closeOnEsc = false,
  closeOnBackdrop = true,
  showClose = true,
  className,
  bodyClassName,
}: SheetProps) {
  useScrollLock(open)
  const panelRef = useFocusTrap(open)

  useEffect(() => {
    if (!open || !closeOnEsc) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, closeOnEsc, onClose])

  const position =
    side === 'right'
      ? 'inset-y-0 right-0 rounded-l-surface'
      : side === 'left'
        ? 'inset-y-0 left-0 rounded-r-surface'
        : 'inset-x-0 bottom-0 rounded-t-surface'

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            variants={scrimVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onMouseDown={closeOnBackdrop ? onClose : undefined}
            className="absolute inset-0 bg-[oklch(0.15_0.02_262_/_0.5)] backdrop-blur-[var(--blur-3)]"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            variants={sheetVariants[side]}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              'absolute flex flex-col border border-border-glass bg-surface shadow-e4 outline-none',
              position,
              SHEET_SIZE[side][size],
              className
            )}
          >
            {(title || showClose) && (
              <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                <div className="min-w-0">
                  {title && <h2 className="text-sm font-semibold tracking-tight text-fg">{title}</h2>}
                  {description && <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>}
                </div>
                {showClose && (
                  <IconButton
                    icon={<X className="h-4 w-4" />}
                    label="Fermer"
                    size="xs"
                    onClick={onClose}
                    className="-mr-1 -mt-0.5"
                  />
                )}
              </div>
            )}
            <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>
              {children}
            </div>
            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
