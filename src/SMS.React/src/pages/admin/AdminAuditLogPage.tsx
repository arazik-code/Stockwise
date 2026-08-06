import { useEffect, useState } from 'react'
import DataTable from '../../components/shared/DataTable'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { adminAuditApi, type AuditLogEntry } from '../../api/adminHealth'

const ACTION_LABELS: Record<string, string> = {
  UserCreated: 'Utilisateur créé',
  UserUpdated: 'Utilisateur modifié',
  PasswordReset: 'Mot de passe réinitialisé',
  RoleCreated: 'Rôle créé',
  RoleUpdated: 'Rôle modifié',
  RoleDeleted: 'Rôle supprimé',
}

const ACTION_COLORS: Record<string, string> = {
  UserCreated: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UserUpdated: 'bg-blue-50 text-blue-700 border-blue-200',
  PasswordReset: 'bg-amber-50 text-amber-700 border-amber-200',
  RoleCreated: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RoleUpdated: 'bg-blue-50 text-blue-700 border-blue-200',
  RoleDeleted: 'bg-red-50 text-red-700 border-red-200',
}

export default function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null)

  useEffect(() => {
    adminAuditApi.getRecent(100).then(setEntries).catch(() => setEntries([]))
  }, [])

  if (entries === null) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Trace des actions sensibles effectuées dans ce tableau de bord (création/modification d'utilisateurs et de rôles, réinitialisations de mot de passe). Les 100 dernières entrées.
      </p>
      <DataTable<AuditLogEntry>
        keyField="id"
        emptyMessage="Aucune activité enregistrée"
        data={entries}
        columns={[
          {
            key: 'action',
            header: 'Action',
            render: (e) => (
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${ACTION_COLORS[e.action] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                {ACTION_LABELS[e.action] ?? e.action}
              </span>
            ),
          },
          { key: 'actorUsername', header: 'Par', render: (e) => <span className="font-medium text-slate-700">@{e.actorUsername}</span> },
          {
            key: 'target',
            header: 'Cible',
            render: (e) => <span className="text-slate-500">{e.targetType}{e.targetId ? ` #${e.targetId}` : ''}</span>,
          },
          { key: 'details', header: 'Détails', render: (e) => <span className="text-slate-400 text-xs">{e.details || '—'}</span> },
          {
            key: 'createdAt',
            header: 'Date',
            className: 'text-right',
            render: (e) => <span className="text-slate-400 text-xs">{new Date(e.createdAt).toLocaleString('fr-FR')}</span>,
          },
        ]}
      />
    </div>
  )
}
