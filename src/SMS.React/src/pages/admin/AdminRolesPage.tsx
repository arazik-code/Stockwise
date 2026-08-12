import { useEffect, useState, useCallback } from 'react'
import { Lock, Plus, ShieldCheck } from 'lucide-react'
import { showToast } from '../../components/shared/Toast'
import { adminRolesApi, type Role } from '../../api/adminRoles'
import { sectionLabel } from '../../constants/sections'
import {
  Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, Input, Modal,
  Page, SkeletonCards, cn,
} from '../../components/ui'

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

  return (
    <Page
      section="adminRoles"
      title="Rôles & Permissions"
      actions={
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEditRole('new')}>
          Nouveau rôle
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-fg-subtle">
          Chaque rôle donne accès à un ensemble précis de sections de l'application. Les 3 rôles
          système ne peuvent pas être renommés ni supprimés, mais leurs permissions restent
          modifiables.
        </p>

        {loading ? (
          <SkeletonCards count={6} />
        ) : roles.length === 0 ? (
          <div className="surface-glass">
            <EmptyState icon={ShieldCheck} title="Aucun rôle" description="Créez le premier rôle pour commencer." />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roles.map((role) => (
              <Card key={role.id} className="flex flex-col">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold text-fg">
                      {role.name}
                      {role.isSystem && (
                        <Badge tone="neutral" size="xs">
                          Système
                        </Badge>
                      )}
                    </h3>
                    <p className="num mt-0.5 text-xs text-fg-subtle">{role.userCount} utilisateur(s)</p>
                  </div>
                </div>
                {role.description && <p className="mb-3 text-sm text-fg-muted">{role.description}</p>}
                <div className="mb-4 flex flex-1 flex-wrap gap-1.5">
                  {role.sections.length === 0 ? (
                    <span className="text-xs italic text-fg-subtle">Aucune section accordée</span>
                  ) : (
                    role.sections.slice(0, 6).map((s) => (
                      <Badge key={s} tone="info" size="xs">
                        {sectionLabel(s)}
                      </Badge>
                    ))
                  )}
                  {role.sections.length > 6 && (
                    <Badge tone="neutral" size="xs">
                      +{role.sections.length - 6}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-3 border-t border-border pt-3 text-xs font-medium">
                  <button
                    onClick={() => setEditRole(role)}
                    className="text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
                  >
                    Modifier les permissions
                  </button>
                  {!role.isSystem && (
                    <button
                      onClick={() => setDeleteTarget(role)}
                      disabled={role.userCount > 0}
                      title={role.userCount > 0 ? 'Réaffectez les utilisateurs avant de supprimer' : undefined}
                      className="text-[var(--negative)] transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer ce rôle ?"
        message={deleteTarget ? `Le rôle « ${deleteTarget.name} » sera définitivement supprimé.` : undefined}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Page>
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
      open
      onClose={onClose}
      size="lg"
      title={isNew ? 'Nouveau rôle' : `Permissions de « ${role.name} »`}
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
      <div className="space-y-4">
        {isNew && (
          <Input label="Nom du rôle" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Comptable" autoFocus />
        )}
        <Input label="Description (optionnelle)" value={description} onChange={(e) => setDescription(e.target.value)} />

        <div>
          <span className="mb-2 block text-xs font-medium text-fg-muted">Sections accessibles</span>
          <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {availableSections.map((key) => {
              const locked = isAdminRole && ADMIN_GUARDED.has(key)
              return (
                <label
                  key={key}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-field border px-3 py-2 text-sm transition-colors',
                    sections.has(key)
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                      : 'border-border bg-surface text-fg-muted hover:border-border-strong',
                    locked && 'cursor-not-allowed opacity-70'
                  )}
                >
                  <Checkbox checked={sections.has(key)} disabled={locked} onChange={() => toggle(key)} />
                  {sectionLabel(key)}
                  {locked && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-fg-subtle">
                      <Lock className="h-2.5 w-2.5" />
                      requis
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
