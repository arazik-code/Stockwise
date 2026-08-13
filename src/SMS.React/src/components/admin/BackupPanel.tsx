import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Database, DownloadCloud, RotateCcw, ShieldAlert } from 'lucide-react'
import { adminBackupApi, type BackupFile } from '../../api/adminBackup'
import api from '../../api/client'
import { showToast } from '../shared/Toast'
import { useAuthStore } from '../../store/authStore'
import { Badge, Button, Card, ConfirmDialog, Input, Modal, Spinner } from '../ui'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

const KIND_LABELS: Record<string, string> = {
  manual: 'Manuelle',
  prereset: 'Auto (avant réinitialisation)',
}

const RESET_PHRASE = 'REINITIALISER'

/**
 * Admin dashboard "Sauvegarde & Restauration" panel: create an immediate backup, restore from
 * a specific one, or wipe the system back to a fresh install.
 *
 * All three call a backend that only ever touches the database - every API key, Shopify/Ozon
 * credential, JWT secret and DB password lives in environment variables, never in a database
 * table, so nothing here needs "except the keys" logic; a full reset is credential-safe by
 * construction. Restore and reset both restart the API process afterward (EF Core's connection
 * pool and every background service need a clean reconnect against the new state), so this
 * component polls /api/health and forces a fresh login once it answers again - the current
 * session's JWT may reference a user that the restored/reset data no longer has.
 */
export default function BackupPanel() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)

  const [creating, setCreating] = useState(false)
  const [confirmBackup, setConfirmBackup] = useState(false)

  const [restoreOpen, setRestoreOpen] = useState(false)
  const [backups, setBackups] = useState<BackupFile[] | null>(null)
  const [selected, setSelected] = useState<BackupFile | null>(null)
  const [restorePassword, setRestorePassword] = useState('')
  const [restoring, setRestoring] = useState(false)

  const [resetOpen, setResetOpen] = useState(false)
  const [resetPhrase, setResetPhrase] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  const [restarting, setRestarting] = useState(false)

  const handleCreateBackup = async () => {
    setCreating(true)
    try {
      const res = await adminBackupApi.create()
      if (res.success) {
        showToast(res.message, 'success')
        setConfirmBackup(false)
      } else {
        showToast(res.message, 'error')
      }
    } catch {
      showToast('Échec de la création de la sauvegarde', 'error')
    } finally {
      setCreating(false)
    }
  }

  const openRestore = async () => {
    setRestoreOpen(true)
    setSelected(null)
    setRestorePassword('')
    setBackups(null)
    try {
      setBackups(await adminBackupApi.list())
    } catch {
      showToast('Impossible de charger la liste des sauvegardes', 'error')
      setBackups([])
    }
  }

  const handleRestore = async () => {
    if (!selected || !restorePassword) return
    setRestoring(true)
    try {
      const res = await adminBackupApi.restore(selected.fileName, restorePassword)
      if (res.success) {
        setRestoreOpen(false)
        beginRestartWait(res.message)
      } else {
        showToast(res.message, 'error')
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message ?? 'Échec de la restauration', 'error')
    } finally {
      setRestoring(false)
    }
  }

  const handleReset = async () => {
    if (resetPhrase.trim() !== RESET_PHRASE || !resetPassword) return
    setResetting(true)
    try {
      const res = await adminBackupApi.reset(resetPassword, resetPhrase.trim())
      if (res.success) {
        setResetOpen(false)
        beginRestartWait(res.message)
      } else {
        showToast(res.message, 'error')
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message ?? 'Échec de la réinitialisation', 'error')
    } finally {
      setResetting(false)
    }
  }

  const beginRestartWait = (message: string) => {
    showToast(message, 'success')
    setRestarting(true)
    const startedAt = Date.now()
    const poll = async () => {
      if (Date.now() - startedAt > 90_000) {
        logout()
        navigate('/login')
        return
      }
      try {
        await api.get('/health', { timeout: 3000 })
        logout()
        navigate('/login')
      } catch {
        setTimeout(poll, 1500)
      }
    }
    setTimeout(poll, 2500)
  }

  return (
    <Card padded={false}>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-fg">Sauvegarde &amp; Restauration</h3>
      </div>

      <div className="flex flex-col gap-3 p-5 sm:flex-row">
        <Button
          variant="outline"
          icon={<Database className="h-4 w-4" />}
          onClick={() => setConfirmBackup(true)}
          className="flex-1"
        >
          Sauvegarde immédiate
        </Button>
        <Button
          variant="outline"
          icon={<DownloadCloud className="h-4 w-4" />}
          onClick={openRestore}
          className="flex-1"
        >
          Restaurer une sauvegarde
        </Button>
        <Button
          variant="danger-ghost"
          icon={<RotateCcw className="h-4 w-4" />}
          onClick={() => setResetOpen(true)}
          className="flex-1"
        >
          Réinitialisation complète
        </Button>
      </div>

      {/* Create backup */}
      <ConfirmDialog
        open={confirmBackup}
        onCancel={() => setConfirmBackup(false)}
        onConfirm={handleCreateBackup}
        loading={creating}
        title="Créer une sauvegarde immédiate ?"
        message="Une copie complète de la base de données sera enregistrée sur le serveur. Cette opération ne modifie rien d'autre et est sans risque."
        confirmLabel="Créer la sauvegarde"
      />

      {/* Restore: pick a backup, then confirm with password */}
      <Modal
        open={restoreOpen}
        onClose={() => !restoring && setRestoreOpen(false)}
        size="lg"
        title="Restaurer une sauvegarde"
        description="La base de données actuelle sera entièrement remplacée par le contenu de la sauvegarde choisie. Le système redémarre ensuite et vous serez déconnecté."
      >
        {!selected ? (
          backups === null ? (
            <div className="flex justify-center py-10">
              <Spinner size="lg" />
            </div>
          ) : backups.length === 0 ? (
            <p className="py-8 text-center text-sm text-fg-subtle">Aucune sauvegarde disponible.</p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {backups.map((b) => (
                <div
                  key={b.fileName}
                  className="flex items-center justify-between gap-3 rounded-field border border-border px-3 py-2.5 transition-colors hover:border-border-strong"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-fg">{b.fileName}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-fg-subtle">
                      <Badge tone="neutral" size="xs">{KIND_LABELS[b.kind] ?? b.kind}</Badge>
                      {formatBytes(b.sizeBytes)} · {new Date(b.createdAtUtc).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <Button size="xs" variant="outline" onClick={() => setSelected(b)} className="shrink-0">
                    Choisir
                  </Button>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div
              data-tone="caution"
              className="flex items-start gap-2.5 rounded-card border border-[color-mix(in_oklab,var(--tone)_25%,transparent)] bg-[var(--tone-soft)] px-4 py-3 text-sm text-[var(--tone-ink)]"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Vous allez restaurer <strong className="font-mono">{selected.fileName}</strong> — toutes les
                données actuelles seront remplacées par celles de cette sauvegarde. Cette action est irréversible.
              </span>
            </div>
            <Input
              type="password"
              label="Confirmez avec votre mot de passe"
              value={restorePassword}
              onChange={(e) => setRestorePassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Mot de passe"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelected(null)} disabled={restoring}>
                Retour
              </Button>
              <Button
                variant="danger"
                onClick={handleRestore}
                loading={restoring}
                disabled={!restorePassword}
              >
                Restaurer maintenant
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Full reset */}
      <Modal
        open={resetOpen}
        onClose={() => { if (!resetting) { setResetOpen(false); setResetPhrase(''); setResetPassword('') } }}
        size="md"
        title="Réinitialisation complète du système"
      >
        <div className="space-y-4">
          <div
            data-tone="negative"
            className="flex items-start gap-2.5 rounded-card border border-[color-mix(in_oklab,var(--tone)_25%,transparent)] bg-[var(--tone-soft)] px-4 py-3 text-sm text-[var(--tone-ink)]"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1.5">
              <p>Ceci supprime <strong>toutes les données</strong> : produits, ventes, clients, commandes, factures, stock, tout.</p>
              <p>Conservé automatiquement : clés API, identifiants Shopify/Ozon/WhatsApp, secrets — ils ne sont jamais stockés en base.</p>
              <p>Une sauvegarde de sécurité est créée automatiquement juste avant. Le système redémarre ensuite avec le compte admin par défaut (mot de passe à changer à la première connexion).</p>
            </div>
          </div>

          <Input
            label={`Tapez « ${RESET_PHRASE} » pour confirmer`}
            value={resetPhrase}
            onChange={(e) => setResetPhrase(e.target.value)}
            placeholder={RESET_PHRASE}
          />
          <Input
            type="password"
            label="Confirmez avec votre mot de passe"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Mot de passe"
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setResetOpen(false); setResetPhrase(''); setResetPassword('') }} disabled={resetting}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={handleReset}
              loading={resetting}
              disabled={resetPhrase.trim() !== RESET_PHRASE || !resetPassword}
            >
              Tout réinitialiser
            </Button>
          </div>
        </div>
      </Modal>

      {/* Restart wait overlay */}
      <Modal open={restarting} onClose={() => {}} showClose={false} size="sm" title="Redémarrage du système">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Spinner size="lg" />
          <p className="text-sm text-fg-muted">
            Le système redémarre, veuillez patienter... Vous serez redirigé vers la page de connexion automatiquement.
          </p>
        </div>
      </Modal>
    </Card>
  )
}
