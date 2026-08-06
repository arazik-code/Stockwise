import { useEffect, useState, useCallback } from 'react'
import Modal from '../../components/shared/Modal'
import ConfirmDialog from '../../components/shared/ConfirmDialog'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { showToast } from '../../components/shared/Toast'
import { adminRolesApi, type Role } from '../../api/adminRoles'
import { sectionLabel } from '../../constants/sections'

const ADMIN_GUARDED = new Set(['AdminUsers', 'AdminRoles', 'AdminHealth'])

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [availableSections, setAvailableSections] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [editRole, setEditRole] = useState<Role | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, s] = await Promise.all([adminRolesApi.getAll(), adminRolesApi.getAvailableSections()])
      setRoles(r)
      setAvailableSections(s)
    } catch {
      showToast('Impossible de charger les rôles', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await adminRolesApi.remove(deleteTarget.id)
      showToast('Rôle supprimé', 'success')
      load()
    } catch (err: any) {
      showToast(err.response?.data?.message ?? 'Échec de la suppression', 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  if (loading && roles.length === 0) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Chaque rôle donne accès à un ensemble précis de sections de l'application. Les 3 rôles système ne peuvent pas être renommés ni supprimés, mais leurs permissions restent modifiables.
        </p>
        <button
          onClick={() => setEditRole('new')}
          className="shrink-0 ml-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Nouveau rôle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {roles.map((role) => (
          <div key={role.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  {role.name}
                  {role.isSystem && (
                    <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Système</span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{role.userCount} utilisateur(s)</p>
              </div>
            </div>
            {role.description && <p className="text-sm text-slate-500 mb-3">{role.description}</p>}
            <div className="flex flex-wrap gap-1.5 mb-4 flex-1">
              {role.sections.length === 0 ? (
                <span className="text-xs text-slate-300 italic">Aucune section accordée</span>
              ) : (
                role.sections.slice(0, 6).map((s) => (
                  <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    {sectionLabel(s)}
                  </span>
                ))
              )}
              {role.sections.length > 6 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100">
                  +{role.sections.length - 6}
                </span>
              )}
            </div>
            <div className="flex gap-3 text-xs font-medium pt-3 border-t border-slate-100">
              <button onClick={() => setEditRole(role)} className="text-blue-600 hover:text-blue-800">
                Modifier les permissions
              </button>
              {!role.isSystem && (
                <button
                  onClick={() => setDeleteTarget(role)}
                  disabled={role.userCount > 0}
                  className="text-red-600 hover:text-red-800 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={role.userCount > 0 ? 'Réaffectez les utilisateurs avant de supprimer' : undefined}
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {editRole && (
        <RoleEditorModal
          role={editRole === 'new' ? null : editRole}
          availableSections={availableSections}
          onClose={() => setEditRole(null)}
          onSaved={() => {
            setEditRole(null)
            load()
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Supprimer ce rôle ?"
          message={`Le rôle "${deleteTarget.name}" sera définitivement supprimé.`}
          confirmLabel="Supprimer"
          variant="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

function RoleEditorModal({
  role,
  availableSections,
  onClose,
  onSaved,
}: {
  role: Role | null
  availableSections: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = role === null
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [sections, setSections] = useState<Set<string>>(new Set(role?.sections ?? []))
  const [saving, setSaving] = useState(false)
  const isAdminRole = role?.name === 'Admin'

  const toggle = (key: string) => {
    if (isAdminRole && ADMIN_GUARDED.has(key)) return // always-on, can't be unchecked from the UI
    setSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const submit = async () => {
    setSaving(true)
    try {
      if (isNew) {
        if (!name.trim()) {
          showToast('Le nom du rôle est requis', 'error')
          setSaving(false)
          return
        }
        await adminRolesApi.create({ name: name.trim(), description: description.trim() || undefined, sections: Array.from(sections) })
      } else {
        await adminRolesApi.update(role.id, { description: description.trim() || undefined, sections: Array.from(sections) })
      }
      showToast(isNew ? 'Rôle créé' : 'Rôle mis à jour', 'success')
      onSaved()
    } catch (err: any) {
      showToast(err.response?.data?.message ?? 'Échec de l\'enregistrement', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isNew ? 'Nouveau rôle' : `Permissions de « ${role.name} »`}
      onClose={onClose}
      width="lg"
      footer={
        <>
          <button onClick={onClose} className="px-3.5 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="px-3.5 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {isNew && (
          <label className="block">
            <span className="block text-xs font-medium text-slate-500 mb-1">Nom du rôle</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="ex: Comptable" autoFocus />
          </label>
        )}
        <label className="block">
          <span className="block text-xs font-medium text-slate-500 mb-1">Description (optionnelle)</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" />
        </label>

        <div>
          <span className="block text-xs font-medium text-slate-500 mb-2">Sections accessibles</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {availableSections.map((key) => {
              const locked = isAdminRole && ADMIN_GUARDED.has(key)
              return (
                <label
                  key={key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                    sections.has(key) ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  } ${locked ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <input type="checkbox" checked={sections.has(key)} disabled={locked} onChange={() => toggle(key)} className="accent-blue-600" />
                  {sectionLabel(key)}
                  {locked && <span className="ml-auto text-[10px] text-slate-400">requis</span>}
                </label>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
