import { useEffect, useState } from 'react'
import { adminAuditApi, type AuditLogEntry } from '../../api/adminHealth'
import { DataTable, Page, StatusBadge, type Column } from '../../components/ui'

export default function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null)

  useEffect(() => {
    adminAuditApi.getRecent(100).then(setEntries).catch(() => setEntries([]))
  }, [])

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'action',
      header: 'Action',
      render: (e) => <StatusBadge domain="auditAction" value={e.action} animate={false} showIcon={false} />,
    },
    { key: 'actor', header: 'Par', render: (e) => <span className="font-medium text-fg">@{e.actorUsername}</span> },
    {
      key: 'target',
      header: 'Cible',
      render: (e) => <span className="text-fg-muted">{e.targetType}{e.targetId ? ` #${e.targetId}` : ''}</span>,
    },
    { key: 'details', header: 'Détails', render: (e) => <span className="text-xs text-fg-subtle">{e.details || '—'}</span> },
    {
      key: 'createdAt',
      header: 'Date',
      align: 'right',
      render: (e) => <span className="text-xs text-fg-subtle">{new Date(e.createdAt).toLocaleString('fr-FR')}</span>,
    },
  ]

  return (
    <Page section="adminAudit" title="Journal d'activité">
      <div className="space-y-4">
        <p className="text-sm text-fg-subtle">
          Trace des actions sensibles effectuées dans ce tableau de bord (création/modification
          d'utilisateurs et de rôles, réinitialisations de mot de passe). Les 100 dernières entrées.
        </p>
        <DataTable<AuditLogEntry>
          columns={columns}
          data={entries ?? []}
          keyField={(e) => e.id}
          loading={entries === null}
          emptyMessage="Aucune activité enregistrée"
        />
      </div>
    </Page>
  )
}
