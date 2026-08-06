import { useEffect, useState, useCallback } from 'react'
import DataTable from '../../components/shared/DataTable'
import Modal from '../../components/shared/Modal'
import ConfirmDialog from '../../components/shared/ConfirmDialog'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { showToast } from '../../components/shared/Toast'
import { adminUsersApi, type AdminUser } from '../../api/adminUsers'
import { adminRolesApi, type Role } from '../../api/adminRoles'
import { useAuthStore } from '../../store/authStore'

const ROLE_COLORS: Record<string, string> = {
  Admin: 'bg-purple-50 text-purple-700 border-purple-200',
  Cashier: 'bg-blue-50 text-blue-700 border-blue-200',
  StockManager: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}
const roleBadgeClass = (name: string) => ROLE_COLORS[name] ?? 'bg-slate-50 text-slate-700 border-slate-200'

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

  if (loading && users.length === 0) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            load(e.target.value)
          }}
          placeholder="Rechercher un utilisateur..."
          className="w-72 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        />
        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Nouvel utilisateur
        </button>
      </div>

      <DataTable<AdminUser>
        keyField="id"
        emptyMessage="Aucun utilisateur trouvé"
        data={users}
        columns={[
          {
            key: 'username',
            header: 'Utilisateur',
            render: (u) => (
              <div>
                <div className="font-medium text-slate-900">{u.fullName}</div>
                <div className="text-slate-400 text-xs">@{u.username}</div>
              </div>
            ),
          },
          {
            key: 'roleName',
            header: 'Rôle',
            render: (u) => (
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${roleBadgeClass(u.roleName)}`}>
                {u.roleName}
              </span>
            ),
          },
          {
            key: 'isActive',
            header: 'Statut',
            render: (u) => (
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                {u.isActive ? 'Actif' : 'Désactivé'}
                {u.mustChangePassword && u.isActive && (
                  <span className="ml-1 text-amber-600" title="Doit changer son mot de passe">⚠</span>
                )}
              </span>
            ),
          },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (u) => (
              <div className="flex justify-end gap-3 text-xs font-medium">
                <button onClick={() => setEditUser(u)} className="text-blue-600 hover:text-blue-800">
                  Modifier
                </button>
                <button onClick={() => setResetUser(u)} className="text-slate-600 hover:text-slate-900">
                  Réinitialiser
                </button>
                <button
                  onClick={() => handleToggleActive(u)}
                  disabled={u.username === currentUsername && u.isActive}
                  className="text-red-600 hover:text-red-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {u.isActive ? 'Désactiver' : 'Réactiver'}
                </button>
              </div>
            ),
          },
        ]}
      />

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

      {deactivateTarget && (
        <ConfirmDialog
          title="Désactiver cet utilisateur ?"
          message={`${deactivateTarget.fullName} (@${deactivateTarget.username}) ne pourra plus se connecter.`}
          confirmLabel="Désactiver"
          variant="danger"
          onConfirm={confirmDeactivate}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}

      {revealedPassword && (
        <Modal title="Mot de passe temporaire" onClose={() => setRevealedPassword(null)} width="sm"
          footer={<button onClick={() => setRevealedPassword(null)} className="px-3.5 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Fermer</button>}
        >
          <p className="text-sm text-slate-600 mb-3">
            Communiquez ce mot de passe à <strong>@{revealedPassword.username}</strong> - il ne sera plus jamais affiché. Un changement sera exigé à la première connexion.
          </p>
          <code className="block w-full px-3 py-2 bg-slate-900 text-emerald-400 rounded-lg text-sm text-center tracking-wider select-all">
            {revealedPassword.password}
          </code>
        </Modal>
      )}
    </div>
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
      title="Nouvel utilisateur"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-3.5 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={saving || !username || !fullName} className="px-3.5 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Création...' : 'Créer'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nom d'utilisateur">
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="input" autoFocus />
        </Field>
        <Field label="Nom complet">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
        </Field>
        <Field label="Rôle">
          <select value={roleId} onChange={(e) => setRoleId(Number(e.target.value))} className="input">
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Mot de passe (laisser vide pour en générer un)">
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="text" className="input" placeholder="Généré automatiquement" />
        </Field>
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
      title={`Modifier @${user.username}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-3.5 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="px-3.5 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nom complet">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" autoFocus />
        </Field>
        <Field label="Rôle">
          <select value={roleId} onChange={(e) => setRoleId(Number(e.target.value))} className="input">
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </Field>
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
      title={`Réinitialiser le mot de passe de @${user.username}`}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <button onClick={onClose} className="px-3.5 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="px-3.5 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
            {saving ? '...' : 'Réinitialiser'}
          </button>
        </>
      }
    >
      <Field label="Nouveau mot de passe (laisser vide pour en générer un)">
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="text" className="input" placeholder="Généré automatiquement" />
      </Field>
      <p className="text-xs text-slate-400 mt-2">L'utilisateur devra le changer à sa prochaine connexion.</p>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  )
}
