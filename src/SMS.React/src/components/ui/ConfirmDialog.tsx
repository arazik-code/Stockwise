import { type ReactNode } from 'react'
import { AlertTriangle, HelpCircle, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { cn } from './cn'
import type { Tone } from '../../design/status'

/**
 * Confirmation dialog.
 *
 * Replaces shared/ConfirmDialog.tsx, whose panel was a fixed `w-96` - narrower
 * than some phones and unable to shrink, so the buttons ran off screen.
 * Inherits Modal's responsive sizing, focus trap and portal.
 */

const TONE_ICON = {
  danger: Trash2,
  warning: AlertTriangle,
  default: HelpCircle,
} as const

const TONE_MAP: Record<keyof typeof TONE_ICON, Tone> = {
  danger: 'negative',
  warning: 'caution',
  default: 'info',
}

export interface ConfirmDialogProps {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  title: ReactNode
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: keyof typeof TONE_ICON
  loading?: boolean
  children?: ReactNode
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default',
  loading,
  children,
}: ConfirmDialogProps) {
  const Icon = TONE_ICON[variant]
  const tone = TONE_MAP[variant]

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      showClose={false}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'solid'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3.5">
        <span
          data-tone={tone}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-chip',
            'bg-[var(--tone-soft)] text-[var(--tone)]'
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {message && <p className="mt-1 text-sm text-fg-muted">{message}</p>}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </Modal>
  )
}
