import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { adminUsersApi, type AdminUser } from '../../api/adminUsers'
import { adminRolesApi, type Role } from '../../api/adminRoles'
import { adminHealthApi, adminAuditApi, type HealthBoard, type AuditLogEntry } from '../../api/adminHealth'

const STATUS_LABEL: Record<HealthBoard['overallStatus'], { label: string; class: string }> = {
  healthy: { label: 'Tous les systèmes opérationnels', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  degraded: { label: 'Services dégradés', class: 'bg-amber-50 text-amber-700 border-amber-200' },
  down: { label: 'Service critique hors service', class: 'bg-red-50 text-red-700 border-red-200' },
}

export default function AdminOverviewPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [roles, setRoles] = useState<Role[] | null>(null)
  const [health, setHealth] = useState<HealthBoard | null>(null)
  const [audit, setAudit] = useState<AuditLogEntry[] | null>(null)

  useEffect(() => {
    adminUsersApi.getAll().then(setUsers).catch(() => setUsers([]))
    adminRolesApi.getAll().then(setRoles).catch(() => setRoles([]))
    adminHealthApi.getFull().then(setHealth).catch(() => setHealth(null))
    adminAuditApi.getRecent(8).then(setAudit).catch(() => setAudit([]))
  }, [])

  if (!users || !roles) return <LoadingSpinner />

  const activeUsers = users.filter((u) => u.isActive).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Utilisateurs actifs" value={activeUsers} sub={`${users.length} au total`} to="/admin/users" />
        <StatCard label="Rôles" value={roles.length} sub={`${roles.filter((r) => !r.isSystem).length} personnalisé(s)`} to="/admin/roles" />
        <StatCard
          label="Doivent changer leur mot de passe"
          value={users.filter((u) => u.mustChangePassword && u.isActive).length}
          sub="à la prochaine connexion"
          to="/admin/users"
          warn={users.some((u) => u.mustChangePassword && u.isActive)}
        />
        <Link to="/admin/health" className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow transition-shadow">
          <div className="text-xs font-medium text-slate-400 mb-2">État du système</div>
          {health ? (
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_LABEL[health.overallStatus].class}`}>
              {STATUS_LABEL[health.overallStatus].label}
            </span>
          ) : (
            <span className="text-xs text-slate-400">Chargement...</span>
          )}
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Activité récente</h3>
          <Link to="/admin/audit-log" className="text-xs font-medium text-blue-600 hover:text-blue-800">Voir tout</Link>
        </div>
        <div className="divide-y divide-slate-100">
          {audit === null ? (
            <div className="px-5 py-6 text-sm text-slate-400">Chargement...</div>
          ) : audit.length === 0 ? (
            <div className="px-5 py-6 text-sm text-slate-400">Aucune activité récente</div>
          ) : (
            audit.map((entry) => (
              <div key={entry.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-slate-700">{entry.actorUsername}</span>{' '}
                  <span className="text-slate-500">{actionLabel(entry.action)}</span>{' '}
                  <span className="text-slate-400">{entry.targetType}{entry.targetId ? ` #${entry.targetId}` : ''}</span>
                </div>
                <span className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString('fr-FR')}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    UserCreated: 'a créé un utilisateur',
    UserUpdated: 'a modifié un utilisateur',
    PasswordReset: 'a réinitialisé un mot de passe',
    RoleCreated: 'a créé un rôle',
    RoleUpdated: 'a modifié un rôle',
    RoleDeleted: 'a supprimé un rôle',
  }
  return map[action] ?? action
}

function StatCard({ label, value, sub, to, warn }: { label: string; value: number; sub: string; to: string; warn?: boolean }) {
  return (
    <Link to={to} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow transition-shadow">
      <div className="text-xs font-medium text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${warn ? 'text-amber-600' : 'text-slate-900'}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </Link>
  )
}
