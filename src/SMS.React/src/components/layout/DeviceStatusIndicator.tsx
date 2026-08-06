import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { devicesApi, type DeviceStatus } from '../../api/devices'

export default function DeviceStatusIndicator() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [testingPrinter, setTestingPrinter] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!expanded) return
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [expanded])

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
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-slate-100"
        title={t('devices.title')}
      >
        <span className={`w-2 h-2 rounded-full ${allOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="hidden sm:inline text-xs font-medium text-slate-600">
          {allOnline ? t('devices.allConnected') : t('devices.issueDetected')}
        </span>
      </button>

      {expanded && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-80 bg-white rounded-lg border border-slate-200 shadow-xl z-[9999]">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">{t('devices.title')}</h4>
            <button onClick={checkStatus} className="text-xs text-slate-400 hover:text-slate-600">
              ↻ {t('devices.refresh')}
            </button>
          </div>
          <div className="p-3 space-y-3">
            {/* Printer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${status?.printer.online ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <div>
                  <p className="text-sm font-medium text-slate-900">{status?.printer.name ?? 'TSC TTP-247'}</p>
                  <p className="text-xs text-slate-400">{status?.printer.detail}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status?.printer.online ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {status?.printer.online ? t('devices.online') : t('devices.offline')}
                </span>
                <button
                  onClick={handleTestPrinter}
                  disabled={testingPrinter}
                  className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 px-2 py-0.5 rounded hover:bg-blue-50"
                >
                  {testingPrinter ? '...' : t('devices.test')}
                </button>
              </div>
            </div>

            {/* Scanner */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${status?.scanner.connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <div>
                  <p className="text-sm font-medium text-slate-900">{status?.scanner.name ?? 'DataLogic 959 Terry'}</p>
                  <p className="text-xs text-slate-400">{status?.scanner.type}</p>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status?.scanner.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {status?.scanner.connected ? t('devices.connected') : t('devices.disconnected')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
