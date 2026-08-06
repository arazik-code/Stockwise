import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/admin', label: "Vue d'ensemble", end: true },
  { to: '/admin/users', label: 'Utilisateurs' },
  { to: '/admin/roles', label: 'Rôles & Permissions' },
  { to: '/admin/health', label: 'Santé système' },
  { to: '/admin/audit-log', label: "Journal d'activité" },
]

export default function AdminLayout() {
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Administration</h1>
        <p className="text-sm text-slate-500 mt-1">Utilisateurs, rôles, permissions et santé du système</p>
      </div>

      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  )
}
