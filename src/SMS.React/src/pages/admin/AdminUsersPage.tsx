import { useEffect, useState, useCallback } from 'react'
import { Search, UserPlus } from 'lucide-react'
import { showToast } from '../../components/shared/Toast'
import { adminUsersApi, type AdminUser } from '../../api/adminUsers'
import { adminRolesApi, type Role } from '../../api/adminRoles'
import { useAuthStore } from '../../store/authStore'
import {
  Badge, Button, ConfirmDialog, DataTable, Input, Modal, Page, Select,
  StatusBadge, StatusDot, type Column,
} from '../../components/ui'

export default function AdminUsersPage() {
  const currentUsername = useAuthStore((s) => s.user?.username)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [resetUser, setResetUser] = useState<AdminUser | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<AdminUser | null>(null)
  const [revealedPassword, setRevealedPassword] = useState<{ username: string; password: string } | null>(null)

  const load = useCallback(async (term?: string) => {
    setLoading(true)
    try {
      const [u, r] = await Promise.all([adminUsersApi.getAll(term), adminRolesApi.getAll()])
      setUsers(u)
      setRoles(r)
    } catch {
      showToast("Impossible de charger les utilisateurs", 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleToggleActive = async (user: AdminUser) => {
    if (user.isActive) {
      setDeactivateTarget(user)
      return
    }
    try {
      await adminUsersApi.update(user.id, { isActive: true })
      showToast(`${user.username} réactivé`, 'success')
      load(search)
    } catch (err: any) {
      showToast(err.response?.data?.message ?? 'Échec de la réactivation', 'error')
    }
  }

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return
    try {
      await adminUsersApi.update(deactivateTarget.id, { isActive: false })
      showToast(`${deactivateTarget.username} désactivé`, 'success')
      load(search)
    } catch (err: any) {
      showToast(err.response?.data?.message ?? 'Échec de la désactivation', 'error')
    } finally {
      setDeactivateTarget(null)
    }
  }

  const columns: Column<AdminUser>[] = [
    {
      key: 'username',
      header: 'Utilisateur',
      render: (u) => (
        <div>
          <div className="font-medium text-fg">{u.fullName}</div>
          <div className="text-xs text-fg-subtle">@{u.username}</div>
        </div>
      ),
    },
    {
      key: 'roleName',
      header: 'Rôle',
      render: (u) => <StatusBadge domain="adminRole" value={u.roleName} animate={false} showIcon={false} />,
    },
    {
      key: 'isActive',
      header: 'Statut',
      render: (u) => (
        <div className="flex items-center gap-1.5">
          <StatusDot tone={u.isActive ? 'positive' : 'muted'} />
          <span className="text-xs font-medium text-fg-muted">{u.isActive ? 'Actif' : 'Désactivé'}</span>
          {u.mustChangePassword && u.isActive && (
            <Badge tone="caution" size="xs" title="Doit changer son mot de passe">
              !
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (u) => (
        <div className="flex justify-end gap-3 text-xs font-medium">
          <button onClick={() => setEditUser(u)} className="text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]">
            Modifier
          </button>
          <button onClick={() => setResetUser(u)} className="text-fg-muted transition-colors hover:text-fg">
            Réinitialiser
          </button>
          <button
            onClick={() => handleToggleActive(u)}
            disabled={u.username === currentUsername && u.isActive}
            className="text-[var(--negative)] transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {u.isActive ? 'Désactiver' : 'Réactiver'}
          </button>
        </div>
      ),
    },
  ]

  return (
    <Page
      section="adminUsers"
      title="Utilisateurs"
      actions={
        <Button size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          Nouvel utilisateur
        </Button>
      }
    >
      <div className="space-y-4">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            load(e.target.value)
          }}
          placeholder="Rechercher un utilisateur..."
          leading={<Search />}
          size="sm"
          wrapperClassName="w-full sm:w-72"
        />

        <DataTable<AdminUser>
          columns={columns}
          data={users}
          keyField={(u) => u.id}
          loading={loading}
          emptyMessage="Aucun utilisateur trouvé"
        />
      </div>

      {createOpen && (
        <CreateUserModal
          roles={roles}
          onClose={() => setCreateOpen(false)}
          onCreated={(pwd, username) => {
            setCreateOpen(false)
            load(search)
            if (pwd) setRevealedPassword({ username, password: pwd })
          }}
        />
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          roles={roles}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null)
            load(search)
          }}
        />
      )}

      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onDone={(pwd) => {
            setResetUser(null)
            setRevealedPassword({ username: resetUser.username, password: pwd })
          }}
        />
      )}

      <ConfirmDialog
        open={!!deactivateTarget}
        title="Désactiver cet utilisateur ?"
        message={
          deactivateTarget
            ? `${deactivateTarget.fullName} (@${deactivateTarget.username}) ne pourra plus se connecter.`
            : undefined
        }
        confirmLabel="Désactiver"
        variant="danger"
        onConfirm={confirmDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />

      <Modal
        open={!!revealedPassword}
        onClose={() => setRevealedPassword(null)}
        size="sm"
        title="Mot de passe temporaire"
        footer={
          <Button size="sm" onClick={() => setRevealedPassword(null)}>
            Fermer
          </Button>
        }
      >
        {revealedPassword && (
          <>
            <p className="mb-3 text-sm text-fg-muted">
              Communiquez ce mot de passe à <strong>@{revealedPassword.username}</strong> — il ne sera
              plus jamais affiché. Un changement sera exigé à la première connexion.
            </p>
            <code
              data-tone="positive"
              className="num block w-full select-all rounded-field bg-[var(--ink-950)] px-3 py-2 text-center text-sm tracking-wider text-[var(--tone)]"
            >
              {revealedPassword.password}
            </code>
          </>
        )}
      </Modal>
    </Page>
  )
}

function CreateUserModal({ roles, onClose, onCreated }: { roles: Role[]; onClose: () => void; onCreated: (pwd: string | null, username: string) => void }) {
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [roleId, setRoleId] = useState(roles.find((r) => r.name === 'Cashier')?.id ?? roles[0]?.id ?? 0)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const { temporaryPassword } = await adminUsersApi.create({ username, fullName, roleId, password: password || undefined })
      showToast('Utilisateur créé', 'success')
      onCreated(temporaryPassword, username)
    } catch (err: any) {
      showToast(err.response?.data?.message ?? 'Échec de la création', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nouvel utilisateur"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={submit} loading={saving} disabled={!username || !fullName}>
            Créer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Nom d'utilisateur" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        <Input label="Nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Select label="Rôle" value={roleId} onChange={(e) => setRoleId(Number(e.target.value))}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </Select>
        <Input
          label="Mot de passe (laisser vide pour en générer un)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="text"
          placeholder="Généré automatiquement"
        />
      </div>
    </Modal>
  )
}

function EditUserModal({ user, roles, onClose, onSaved }: { user: AdminUser; roles: Role[]; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(user.fullName)
  const [roleId, setRoleId] = useState(user.roleId)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      await adminUsersApi.update(user.id, { fullName, roleId })
      showToast('Utilisateur mis à jour', 'success')
      onSaved()
    } catch (err: any) {
      showToast(err.response?.data?.message ?? 'Échec de la mise à jour', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Modifier @${user.username}`}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={submit} loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
        <Select label="Rôle" value={roleId} onChange={(e) => setRoleId(Number(e.target.value))}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </Select>
      </div>
    </Modal>
  )
}

function ResetPasswordModal({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: (pwd: string) => void }) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const { temporaryPassword } = await adminUsersApi.resetPassword(user.id, password || undefined)
      onDone(temporaryPassword)
    } catch (err: any) {
      showToast(err.response?.data?.message ?? 'Échec de la réinitialisation', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Réinitialiser le mot de passe de @${user.username}`}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={submit} loading={saving}>
            Réinitialiser
          </Button>
        </>
      }
    >
      <Input
        label="Nouveau mot de passe (laisser vide pour en générer un)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="text"
        placeholder="Généré automatiquement"
      />
      <p className="mt-2 text-xs text-fg-subtle">L'utilisateur devra le changer à sa prochaine connexion.</p>
    </Modal>
  )
}
