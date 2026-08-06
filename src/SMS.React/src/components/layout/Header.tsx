import DeviceStatusIndicator from './DeviceStatusIndicator'
import { useUIStore } from '../../store/uiStore'

interface HeaderProps {
  title: string
  actions?: React.ReactNode
}

export default function Header({ title, actions }: HeaderProps) {
  const openMobileNav = useUIStore((s) => s.openMobileNav)

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={openMobileNav}
          className="lg:hidden flex-shrink-0 -ml-1 p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
        <DeviceStatusIndicator />
        {actions && <div className="flex items-center gap-2 flex-wrap justify-end">{actions}</div>}
      </div>
    </header>
  )
}
