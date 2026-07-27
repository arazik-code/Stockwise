import DeviceStatusIndicator from './DeviceStatusIndicator'

interface HeaderProps {
  title: string
  actions?: React.ReactNode
}

export default function Header({ title, actions }: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      <div className="flex items-center gap-3">
        <DeviceStatusIndicator />
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
