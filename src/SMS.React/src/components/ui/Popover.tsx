import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from './cn'
import { popoverVariants } from '../../design/variants'

/**
 * Anchored floating layers: Popover, Tooltip, DropdownMenu.
 *
 * Replaces the several hand-rolled dropdowns in the app, all of which used an
 * absolutely-positioned panel plus an invisible full-screen click-catcher div
 * (see WhatsAppConfirmButton and RefundsPage:1166). That approach breaks in
 * two ways this one does not: the panel is clipped by any ancestor with
 * `overflow: hidden` (so menus in table cells got cut off), and the catcher
 * swallows the first click anywhere on the page.
 *
 * Everything here portals to <body> and positions with fixed coordinates, so
 * it escapes every scroll container and stacking context.
 *
 * No floating-ui dependency: the flip/shift logic below is about forty lines
 * and covers the placements this app actually uses.
 */

type Placement = 'bottom-start' | 'bottom-end' | 'bottom' | 'top-start' | 'top-end' | 'top'

interface Position {
  top: number
  left: number
}

const GAP = 6
const MARGIN = 8

function computePosition(
  anchor: DOMRect,
  panel: { width: number; height: number },
  placement: Placement
): Position {
  const vw = window.innerWidth
  const vh = window.innerHeight

  let side: 'top' | 'bottom' = placement.startsWith('top') ? 'top' : 'bottom'
  const align = placement.endsWith('-start') ? 'start' : placement.endsWith('-end') ? 'end' : 'center'

  // Flip if the preferred side has no room but the other does.
  const spaceBelow = vh - anchor.bottom
  const spaceAbove = anchor.top
  if (side === 'bottom' && spaceBelow < panel.height + GAP && spaceAbove > spaceBelow) side = 'top'
  else if (side === 'top' && spaceAbove < panel.height + GAP && spaceBelow > spaceAbove) side = 'bottom'

  let top = side === 'bottom' ? anchor.bottom + GAP : anchor.top - panel.height - GAP

  let left =
    align === 'start'
      ? anchor.left
      : align === 'end'
        ? anchor.right - panel.width
        : anchor.left + anchor.width / 2 - panel.width / 2

  // Shift back inside the viewport.
  left = Math.min(Math.max(MARGIN, left), vw - panel.width - MARGIN)
  top = Math.min(Math.max(MARGIN, top), vh - panel.height - MARGIN)

  return { top, left }
}

function useAnchoredPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  placement: Placement
) {
  const [pos, setPos] = useState<Position | null>(null)

  const update = useCallback(() => {
    const a = anchorRef.current
    const p = panelRef.current
    if (!a || !p) return
    setPos(
      computePosition(a.getBoundingClientRect(), { width: p.offsetWidth, height: p.offsetHeight }, placement)
    )
  }, [anchorRef, panelRef, placement])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    update()
    // `true` for capture: catches scrolling in ANY ancestor, not just window.
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, update])

  return pos
}

export interface PopoverProps {
  /** Must accept a ref and an onClick. */
  trigger: ReactElement
  children: ReactNode
  placement?: Placement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  /** Closes when anything inside is clicked. Use for menus. */
  closeOnContentClick?: boolean
}

export function Popover({
  trigger,
  children,
  placement = 'bottom-end',
  open: controlledOpen,
  onOpenChange,
  className,
  closeOnContentClick,
}: PopoverProps) {
  const [uncontrolled, setUncontrolled] = useState(false)
  const open = controlledOpen ?? uncontrolled
  const setOpen = useCallback(
    (v: boolean) => {
      if (controlledOpen === undefined) setUncontrolled(v)
      onOpenChange?.(v)
    },
    [controlledOpen, onOpenChange]
  )

  const anchorRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const pos = useAnchoredPosition(open, anchorRef, panelRef, placement)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Stop here so a page-level Escape handler (the POS) does not also act.
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, setOpen])

  const triggerEl = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
        ref: anchorRef,
        'aria-expanded': open,
        'aria-haspopup': true,
        onClick: (e: React.MouseEvent) => {
          ;(trigger.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e)
          setOpen(!open)
        },
      })
    : trigger

  return (
    <>
      {triggerEl}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              variants={popoverVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={closeOnContentClick ? () => setOpen(false) : undefined}
              style={{
                position: 'fixed',
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
                // Hidden until measured, or it flashes at the wrong spot.
                visibility: pos ? 'visible' : 'hidden',
              }}
              className={cn(
                'z-[90] min-w-[10rem] rounded-card border border-border-glass shadow-e3',
                // Permitted blur: portalled, transient, small.
                'bg-[color-mix(in_oklab,var(--surface-1)_88%,transparent)] backdrop-blur-[var(--blur-1)]',
                className
              )}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

export interface DropdownItem {
  label: ReactNode
  icon?: ReactNode
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  separatorBefore?: boolean
}

export function DropdownMenu({
  trigger,
  items,
  placement = 'bottom-end',
  className,
}: {
  trigger: ReactElement
  items: DropdownItem[]
  placement?: Placement
  className?: string
}) {
  return (
    <Popover trigger={trigger} placement={placement} closeOnContentClick className={cn('py-1', className)}>
      <div role="menu">
        {items.map((item, i) => (
          <div key={i}>
            {item.separatorBefore && <div className="my-1 h-px bg-border" role="separator" />}
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={item.onClick}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:bg-surface-2',
                'disabled:opacity-40 disabled:pointer-events-none',
                item.danger
                  ? 'text-[var(--negative)] hover:bg-[var(--negative-soft)]'
                  : 'text-fg hover:bg-surface-2'
              )}
            >
              {item.icon && <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </button>
          </div>
        ))}
      </div>
    </Popover>
  )
}

export interface TooltipProps {
  content: ReactNode
  children: ReactElement
  placement?: Placement
  /** ms before showing. Long enough not to fire while sweeping the cursor. */
  delay?: number
}

export function Tooltip({ content, children, placement = 'top', delay = 400 }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pos = useAnchoredPosition(open, anchorRef, panelRef, placement)

  const show = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), delay)
  }
  const hide = () => {
    clearTimeout(timer.current)
    setOpen(false)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        ref: anchorRef,
        onMouseEnter: show,
        onMouseLeave: hide,
        // Keyboard users get tooltips too - this is the part usually skipped.
        onFocus: show,
        onBlur: hide,
      })
    : children

  return (
    <>
      {child}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              role="tooltip"
              variants={popoverVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{
                position: 'fixed',
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
                visibility: pos ? 'visible' : 'hidden',
              }}
              className="pointer-events-none z-[95] max-w-xs rounded-inset bg-[var(--ink-950)] px-2.5 py-1.5 text-xs text-white shadow-e3"
            >
              {content}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
