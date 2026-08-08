import { AnimatePresence, motion } from 'motion/react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useThemeStore, type ThemePreference } from '../../store/themeStore'
import { cn } from '../ui/cn'
import { DUR, EASE } from '../../design/motion'

/**
 * Theme toggle.
 *
 * Cycles light -> dark -> system. The icon crossfades and rotates on change,
 * which is the smallest possible piece of choreography and still makes the
 * control feel responsive rather than binary.
 *
 * `system` is a real third state, not a hidden default: on the web the app
 * follows the OS, but the Electron build pins light on first run (see the boot
 * script in index.html) because Windows POS terminals often run a dark OS
 * theme and a cashier arriving to a dark till on deploy morning is a support
 * call. Showing the state explicitly means that behaviour is visible rather
 * than mysterious.
 */

const ORDER: ThemePreference[] = ['light', 'dark', 'system']

const META: Record<ThemePreference, { icon: typeof Sun; label: string }> = {
  light: { icon: Sun, label: 'Thème clair' },
  dark: { icon: Moon, label: 'Thème sombre' },
  system: { icon: Monitor, label: 'Thème système' },
}

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useThemeStore()
  const { icon: Icon, label } = META[theme]

  const next = () => setTheme(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length])

  return (
    <button
      type="button"
      onClick={next}
      aria-label={label}
      title={label}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-field',
        'text-fg-muted transition-colors duration-fast hover:bg-surface-2 hover:text-fg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]',
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -70, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 70, scale: 0.6 }}
          transition={{ duration: DUR.base, ease: EASE.outSoft }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <Icon className="h-[18px] w-[18px]" />
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
