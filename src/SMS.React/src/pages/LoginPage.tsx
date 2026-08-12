import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { Button, ErrorBanner, Input } from '../components/ui'
import { sectionProps } from '../design/sections'

export default function LoginPage() {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(username, password)
      navigate('/')
    } catch {
      // error is set in store
    }
  }

  return (
    // Standalone route, outside MainLayout - there is no #page-chrome host, so
    // this section only supplies the accent/mesh; the heading renders in-body.
    <div {...sectionProps('auth')} className="page-mesh flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-surface bg-[var(--accent)] text-[var(--accent-fg)] shadow-glow">
            <Box className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold text-fg">{t('app.title')}</h1>
          <p className="mt-1 text-sm text-fg-subtle">{t('auth.welcome')}</p>
        </div>

        <form onSubmit={handleSubmit} className="surface-glass space-y-4 p-6">
          {error && <ErrorBanner>{error}</ErrorBanner>}

          <Input
            label={t('auth.username')}
            type="text"
            value={username}
            onChange={(e) => { setUsername(e.target.value); clearError() }}
            placeholder={t('auth.username')}
            autoFocus
            required
          />

          <Input
            label={t('auth.password')}
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); clearError() }}
            placeholder={t('auth.password')}
            required
          />

          <Button type="submit" fullWidth loading={isLoading}>
            {isLoading ? t('auth.signingIn') : t('auth.signIn')}
          </Button>
        </form>
      </div>
    </div>
  )
}
