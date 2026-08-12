import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Tabs } from '../../components/ui'
import { sectionProps } from '../../design/sections'

/**
 * Admin tab shell.
 *
 * This does NOT wrap children in <Page> - each admin child page (Overview,
 * Users, Roles, Health, AuditLog) owns its own <Page section="admin*">, since
 * Health deliberately carries a different, forced-dark section than the rest.
 * This shell only renders the outer heading and the tab bar, then <Outlet/>.
 */

const TABS = [
  { to: '/admin', label: "Vue d'ensemble", end: true },
  { to: '/admin/users', label: 'Utilisateurs' },
  { to: '/admin/roles', label: 'Rôles & Permissions' },
  { to: '/admin/health', label: 'Santé système' },
  { to: '/admin/audit-log', label: "Journal d'activité" },
]

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const active =
    TABS.find((t) => (t.end ? location.pathname === t.to : location.pathname.startsWith(t.to)))?.to ?? '/admin'

  return (
    <div {...sectionProps('admin')} className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">Administration</h1>
        <p className="mt-1 text-sm text-fg-subtle">Utilisateurs, rôles, permissions et santé du système</p>
      </div>

      <div className="mb-6">
        <Tabs
          variant="underline"
          layoutGroupId="admin-tabs"
          value={active}
          onChange={(to) => navigate(to)}
          items={TABS.map((t) => ({ value: t.to, label: t.label }))}
        />
      </div>

      <Outlet />
    </div>
  )
}
