import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowRight, ShieldCheck, Users } from 'lucide-react'
import { adminUsersApi, type AdminUser } from '../../api/adminUsers'
import { adminRolesApi, type Role } from '../../api/adminRoles'
import { adminHealthApi, adminAuditApi, type HealthBoard, type AuditLogEntry } from '../../api/adminHealth'
import { Card, Page, Skeleton, SkeletonStats, StatCard, StatusBadge } from '../../components/ui'

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

  const loading = !users || !roles
  const activeUsers = users?.filter((u) => u.isActive).length ?? 0
  const pendingPasswordChange = users?.filter((u) => u.mustChangePassword && u.isActive).length ?? 0

  return (
    <Page section="admin" title="Vue d'ensemble">
      <div className="space-y-6">
        {loading ? (
          <SkeletonStats count={4} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link to="/admin/users">
              <StatCard label="Utilisateurs actifs" value={activeUsers} sub={`${users!.length} au total`} icon={Users} />
            </Link>
            <Link to="/admin/roles">
              <StatCard
                label="Rôles"
                value={roles!.length}
                sub={`${roles!.filter((r) => !r.isSystem).length} personnalisé(s)`}
                icon={ShieldCheck}
              />
            </Link>
            <Link to="/admin/users">
              <StatCard
                label="Doivent changer leur mot de passe"
                value={pendingPasswordChange}
                sub="à la prochaine connexion"
                icon={Users}
                tone={pendingPasswordChange > 0 ? 'caution' : 'accent'}
              />
            </Link>
            <Link to="/admin/health">
              <Card interactive className="flex flex-col justify-between">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">État du système</p>
                {health ? (
                  <StatusBadge domain="health" value={health.overallStatus} showDot size="md" />
                ) : (
                  <Skeleton variant="text" width="70%" />
                )}
              </Card>
            </Link>
          </div>
        )}

        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold text-fg">Activité récente</h3>
            <Link
              to="/admin/audit-log"
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
            >
              Voir tout
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {audit === null ? (
              <div className="space-y-3 px-5 py-4">
                {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="text" />)}
              </div>
            ) : audit.length === 0 ? (
              <div className="flex items-center gap-2 px-5 py-6 text-sm text-fg-subtle">
                <Activity className="h-4 w-4" />
                Aucune activité récente
              </div>
            ) : (
              audit.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-fg">{entry.actorUsername}</span>{' '}
                    <span className="text-fg-muted">{actionLabel(entry.action)}</span>{' '}
                    <span className="text-fg-subtle">{entry.targetType}{entry.targetId ? ` #${entry.targetId}` : ''}</span>
                  </div>
                  <span className="shrink-0 text-xs text-fg-subtle">{new Date(entry.createdAt).toLocaleString('fr-FR')}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </Page>
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
