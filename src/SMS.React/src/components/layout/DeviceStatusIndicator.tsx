import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer, RotateCw, ScanLine } from 'lucide-react'
import { devicesApi, type DeviceStatus } from '../../api/devices'
import { Popover } from '../ui/Popover'
import { Badge, StatusDot } from '../ui/Badge'
import { Button } from '../ui/Button'
import { cn } from '../ui/cn'

/**
 * Printer + scanner status, in the app header.
 *
 * Logic is unchanged - same polling, same test-printer call, same optimistic
 * status update. Two things improved beyond the restyle:
 *
 *   - the panel now uses <Popover>, so it portals to <body>. The old version
 *     was absolutely positioned and got clipped by the header's own bounds.
 *   - the click-outside handler and its listener are gone; Popover owns that,
 *     including an Escape handler that stops propagation so the POS's global
 *     Escape does not also fire.
 */
export default function DeviceStatusIndicator() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [testingPrinter, setTestingPrinter] = useState(false)

  const checkStatus = useCallback(async () => {
    try {
      const data = await devicesApi.getStatus()
      setStatus(data)
    } catch {
      setStatus(null)
    }
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  const allOnline = status?.printer.online && status?.scanner.connected

  const handleTestPrinter = async () => {
    setTestingPrinter(true)
    try {
      const result = await devicesApi.testPrinter()
      if (status) {
        setStatus({ ...status, printer: { ...status.printer, online: result.online } })
      }
    } catch {
      if (status) {
        setStatus({ ...status, printer: { ...status.printer, online: false } })
      }
    } finally {
      setTestingPrinter(false)
    }
  }

  return (
    <Popover
      placement="bottom-end"
      className="w-[min(20rem,calc(100vw-2rem))]"
      trigger={
        <button
          type="button"
          title={t('devices.title')}
          className={cn(
            'flex items-center gap-2 rounded-field px-2.5 py-1.5',
            'text-fg-muted transition-colors duration-fast hover:bg-surface-2 hover:text-fg',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]'
          )}
        >
          <StatusDot tone={allOnline ? 'positive' : 'caution'} size="sm" pulse={!allOnline} />
          <Printer className="h-4 w-4" />
          <span className="hidden text-xs font-medium sm:inline">
            {allOnline ? t('devices.allConnected') : t('devices.issueDetected')}
          </span>
        </button>
      }
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <h4 className="text-sm font-semibold text-fg">{t('devices.title')}</h4>
        <button
          onClick={checkStatus}
          className="inline-flex items-center gap-1 rounded-inset px-1.5 py-0.5 text-xs text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
        >
          <RotateCw className="h-3 w-3" />
          {t('devices.refresh')}
        </button>
      </div>

      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <StatusDot tone={status?.printer.online ? 'positive' : 'negative'} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">
                {status?.printer.name ?? 'TSC TTP-247'}
              </p>
              <p className="truncate text-xs text-fg-subtle">{status?.printer.detail}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge tone={status?.printer.online ? 'positive' : 'negative'} size="xs">
              {status?.printer.online ? t('devices.online') : t('devices.offline')}
            </Badge>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleTestPrinter}
              loading={testingPrinter}
            >
              {t('devices.test')}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <StatusDot tone={status?.scanner.connected ? 'positive' : 'negative'} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">
                {status?.scanner.name ?? 'DataLogic 959 Terry'}
              </p>
              <p className="truncate text-xs text-fg-subtle">{status?.scanner.type}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ScanLine className="h-3.5 w-3.5 text-fg-subtle" />
            <Badge tone={status?.scanner.connected ? 'positive' : 'negative'} size="xs">
              {status?.scanner.connected ? t('devices.connected') : t('devices.disconnected')}
            </Badge>
          </div>
        </div>
      </div>
    </Popover>
  )
}
