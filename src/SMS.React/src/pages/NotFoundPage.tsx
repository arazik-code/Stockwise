import { Link, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { Compass, Home } from 'lucide-react'
import { Button } from '../components/ui'
import { sectionProps } from '../design/sections'
import { SPRING } from '../design/motion'

/**
 * 404.
 *
 * The app had no catch-all route at all: an unknown path rendered the layout
 * with a blank main area and no explanation.
 */
export default function NotFoundPage() {
  const location = useLocation()

  return (
    <div
      {...sectionProps('notFound')}
      className="page-mesh flex min-h-full flex-col items-center justify-center px-6 py-20 text-center"
    >
      <motion.span
        initial={{ scale: 0.6, opacity: 0, rotate: -20 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={SPRING.panel}
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-chip bg-[var(--accent-soft)] text-[var(--accent)] shadow-e2"
      >
        <Compass className="h-9 w-9" />
      </motion.span>

      <p className="num text-5xl font-bold tracking-tight text-fg">404</p>
      <h1 className="mt-2 text-lg font-semibold text-fg">Page introuvable</h1>
      <p className="mt-2 max-w-md text-sm text-fg-subtle">
        L'adresse{' '}
        <code className="rounded-inset bg-sunken px-1.5 py-0.5 font-mono text-xs text-fg-muted">
          {location.pathname}
        </code>{' '}
        ne correspond à aucune page.
      </p>

      <Link to="/" className="mt-6">
        <Button icon={<Home className="h-4 w-4" />}>Retour au tableau de bord</Button>
      </Link>
    </div>
  )
}
