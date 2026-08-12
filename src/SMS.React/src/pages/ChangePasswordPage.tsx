import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import api from '../api/client'
import { useAuthStore } from '../store/authStore'
import { Button, ErrorBanner, Input } from '../components/ui'
import { sectionProps } from '../design/sections'

export default function ChangePasswordPage() {
  const { user, clearMustChangePassword, logout } = useAuthStore()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setIsLoading(true)
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword })
      clearMustChangePassword()
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du changement de mot de passe')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div {...sectionProps('auth')} className="page-mesh flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div
            data-tone="caution"
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-surface bg-[var(--tone)] text-white shadow-e2"
          >
            <KeyRound className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold text-fg">Changement de mot de passe requis</h1>
          <p className="mt-1 text-sm text-fg-subtle">
            Ce compte utilise encore un mot de passe par defaut. Choisissez-en un nouveau pour continuer.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="surface-glass space-y-4 p-6">
          {error && <ErrorBanner>{error}</ErrorBanner>}

          <Input
            label="Mot de passe actuel"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoFocus
            required
          />

          <Input
            label="Nouveau mot de passe"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />

          <Input
            label="Confirmer le nouveau mot de passe"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />

          <Button type="submit" fullWidth loading={isLoading}>
            {isLoading ? 'Enregistrement...' : 'Changer le mot de passe'}
          </Button>

          <Button type="button" variant="ghost" fullWidth onClick={() => logout()}>
            Se deconnecter ({user?.username})
          </Button>
        </form>
      </div>
    </div>
  )
}
