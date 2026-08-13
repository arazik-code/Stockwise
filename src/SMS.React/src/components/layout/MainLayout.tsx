import { Menu } from 'lucide-react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Sidebar from './Sidebar'
import ThemeToggle from './ThemeToggle'
import DeviceStatusIndicator from './DeviceStatusIndicator'
import { ToastViewport } from '../ui/Toast'
import { ErrorBoundary } from '../shared/ErrorBoundary'
import { useUIStore } from '../../store/uiStore'
import { pageVariants } from '../../design/variants'

/**
 * Application shell.
 *
 * Three structural changes make everything else possible:
 *
 * 1. ONE header, owned here.
 *    Previously all 33 pages rendered their own <Header/> inside their own
 *    `h-screen` wrapper. That makes route transitions impossible: the header
 *    would fade with the body on every navigation, and mid-transition two
 *    `h-screen` elements overlap into a double scrollbar. Pages now portal
 *    their title and actions into #page-chrome via <Page>.
 *
 * 2. ONE scroll root.
 *    Every page previously owned its own `overflow-auto` container, so scroll
 *    position was per-page-instance and never restored. A single
 *    [data-scroll-root] fixes that and gives the sticky header something to
 *    actually stick to.
 *
 * 3. isolation: isolate on the shell.
 *    Bounds the stacking context so backdrop-filter elements sample a
 *    contained region rather than the whole document - a real cost saving on
 *    the blurred header and sidebar.
 */
export default function MainLayout() {
  const location = useLocation()
  const openMobileNav = useUIStore((s) => s.openMobileNav)

  return (
    // h-screen + overflow-hidden, not min-h-screen: the shell must have a
    // DEFINITE height so that <Page fill> (POS and the two designers, which use
    // fixed split panels that must not scroll the page) can resolve h-full.
    // Only <main> scrolls; the sidebar and header never move.
    <div className="flex h-screen overflow-hidden bg-canvas" style={{ isolation: 'isolate' }}>
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={[
            'sticky top-0 z-30 flex items-center gap-3 border-b border-border',
            'px-4 py-3 sm:px-6',
            // One of the six surfaces allowed real blur: fixed, thin, and the
            // content genuinely scrolls beneath it - this is where blur earns
            // its cost rather than merely decorating.
            'bg-[color-mix(in_oklab,var(--canvas)_78%,transparent)] backdrop-blur-[var(--blur-2)]',
          ].join(' ')}
        >
          <button
            onClick={openMobileNav}
            aria-label="Ouvrir le menu"
            className="-ml-1 shrink-0 rounded-field p-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/*
            Portal target for <Page>'s title and actions.

            React portals keep the portalled node in the REACT tree, so a
            page's action buttons keep their handlers, context and i18n even
            though they render up here. Pages did not have to change how they
            declare actions.
          */}
          <div id="page-chrome" className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2" />

          <div className="flex shrink-0 items-center gap-1">
            <DeviceStatusIndicator />
            <ThemeToggle />
          </div>
        </header>

        <main data-scroll-root className="flex-1 overflow-auto">
          {/*
            mode="wait" is MANDATORY, not stylistic.

            The default mode mounts the incoming route before the outgoing one
            unmounts. PosPage registers a document-level keydown listener and
            useSignalR opens a hub subscription; with both routes alive at once
            those would double-register, so every barcode scan would fire
            twice on a live till.

            Keyed on pathname ONLY - keying on the whole location object would
            replay the transition on every search-param change.
          */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="h-full"
            >
              {/* Scoped per-route, inside the pathname-keyed element: a crash in
                  one page's render used to unmount the ENTIRE app (this was the
                  only ErrorBoundary, sitting above MainLayout in App.tsx) - the
                  sidebar and header disappeared along with the broken page, and
                  since the fallback replaces everything there was no way to
                  navigate elsewhere without a hard reload. Keying off pathname
                  means switching routes always mounts a fresh boundary, even
                  right after a crash. */}
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <ToastViewport />
    </div>
  )
}
