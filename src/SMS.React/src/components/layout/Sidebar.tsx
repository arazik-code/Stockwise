import { useEffect, type ComponentType } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity, BarChart3, Boxes, ClipboardList, Cloud, CreditCard, FileText,
  Gauge, Globe, Home, LayoutDashboard, LogOut, Link2, MessageSquare, Package,
  PhoneCall, Printer, ReceiptText, RefreshCw, Settings, ShieldCheck,
  ShoppingCart, Store, Truck, Undo2, Users, WifiOff, X,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useStoreModeStore, type StoreMode } from '../../store/storeModeStore'
import { useUIStore } from '../../store/uiStore'
import { Avatar } from '../ui/Misc'
import { cn } from '../ui/cn'
import { sectionProps, type SectionName } from '../../design/sections'
import { DUR, EASE, SPRING, staggerDelay } from '../../design/motion'

/**
 * Sidebar - the most-seen surface in the application.
 *
 * Behaviour is unchanged from the version this replaces: the same two nav
 * trees, the same role filtering, the same dual-mode switcher backed by
 * storeModeStore, the same off-canvas drawer on mobile. Every route, labelKey,
 * `end` flag and role list is transcribed exactly.
 *
 * What changed is everything visual:
 *
 *   - 24 hand-inlined Heroicons-v1 SVG path strings became lucide components
 *     with consistent optical weight.
 *   - The hardcoded bg-slate-900 rail became a themed surface, so the sidebar
 *     is no longer the only dark thing in a light app - it now belongs to
 *     whichever theme is active.
 *   - Each nav item carries its SECTION, so hovering Stock previews cyan and
 *     hovering Invoices previews violet. The active item's accent bar is the
 *     destination's own hue - the nav teaches the colour language before you
 *     arrive at the page.
 *   - The active indicator is a shared layoutId, so it slides between items.
 */

interface NavConfig {
  to: string
  label?: string
  labelKey?: string
  icon: ComponentType<{ className?: string }>
  /** Drives the per-item accent hue. */
  section: SectionName
  end?: boolean
  roles?: string[]
}

interface NavSection {
  label: string
  items: NavConfig[]
}

const localNavSections: NavSection[] = [
  {
    label: 'Dashboard',
    items: [
      { to: '/', labelKey: 'dashboard', icon: Home, section: 'dashboard', end: true },
    ],
  },
  {
    label: 'Ventes',
    items: [
      { to: '/pos', labelKey: 'pos', icon: ShoppingCart, section: 'pos', roles: ['Admin', 'Cashier'] },
      { to: '/sales', labelKey: 'sales', icon: BarChart3, section: 'sales', roles: ['Admin'] },
      { to: '/refunds', labelKey: 'refunds', icon: Undo2, section: 'refunds', roles: ['Admin', 'Cashier'] },
      { to: '/clients', labelKey: 'clients', icon: Users, section: 'clients', roles: ['Admin', 'Cashier'] },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { to: '/products', labelKey: 'products', icon: Package, section: 'products', roles: ['Admin', 'StockManager'] },
      { to: '/stock', labelKey: 'stock', icon: Boxes, section: 'stock', roles: ['Admin', 'StockManager'] },
      { to: '/fournisseurs', labelKey: 'fournisseurs', icon: Truck, section: 'fournisseurs', roles: ['Admin', 'StockManager'] },
      { to: '/invoices', labelKey: 'invoices', icon: FileText, section: 'invoices', roles: ['Admin', 'StockManager'] },
    ],
  },
  {
    label: 'Rapports',
    items: [
      { to: '/reports', labelKey: 'reports', icon: ClipboardList, section: 'reports', roles: ['Admin', 'StockManager'] },
      { to: '/printer', labelKey: 'printer', icon: Printer, section: 'printer', roles: ['Admin'] },
      { to: '/offline-sales', labelKey: 'offlineSales', icon: WifiOff, section: 'offlineSales', roles: ['Admin'] },
    ],
  },
  {
    label: 'Personnalisation',
    items: [
      { to: '/invoice-designer', label: 'Design Facture', icon: FileText, section: 'invoiceDesign', roles: ['Admin'] },
      { to: '/receipt-designer', label: 'Design Recu', icon: ReceiptText, section: 'receiptDesign', roles: ['Admin'] },
      { to: '/settings', labelKey: 'settings', icon: Settings, section: 'settings', roles: ['Admin'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin', label: 'Tableau Admin', icon: ShieldCheck, section: 'admin', roles: ['Admin'] },
    ],
  },
]

const onlineNavSections: NavSection[] = [
  {
    label: 'Dashboard',
    items: [
      { to: '/online', label: 'Tableau de Bord', icon: LayoutDashboard, section: 'onlineDash', end: true, roles: ['Admin', 'StockManager'] },
    ],
  },
  {
    label: 'Ventes en ligne',
    items: [
      { to: '/online/orders', label: 'Commandes', icon: ShoppingCart, section: 'onlineOrders', roles: ['Admin', 'StockManager'] },
      { to: '/online/confirmation', label: 'File de confirmation', icon: PhoneCall, section: 'onlineConfirm', roles: ['Admin', 'StockManager'] },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { to: '/online/products', label: 'Produits', icon: Package, section: 'onlineProducts', roles: ['Admin', 'StockManager'] },
      { to: '/online/clients', label: 'Clients', icon: Users, section: 'onlineClients', roles: ['Admin', 'StockManager'] },
      { to: '/online/crm', label: 'CRM & Analytique', icon: Activity, section: 'onlineCrm', roles: ['Admin', 'StockManager'] },
    ],
  },
  {
    label: 'Livraison',
    items: [
      { to: '/online/delivery', label: 'OzonExpress', icon: Truck, section: 'onlineDelivery', roles: ['Admin', 'StockManager'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/online/finance', label: 'Encaissements COD', icon: CreditCard, section: 'onlineFinance', roles: ['Admin', 'StockManager'] },
    ],
  },
  {
    label: 'Synchronisation',
    items: [
      { to: '/online/sync', label: 'Conflits & État', icon: RefreshCw, section: 'onlineSync', roles: ['Admin', 'StockManager'] },
      { to: '/online/link', label: 'Liaison Shopify', icon: Link2, section: 'onlineLink', roles: ['Admin', 'StockManager'] },
      { to: '/online/whatsapp-templates', label: 'Modèles WhatsApp', icon: MessageSquare, section: 'onlineWhatsApp', roles: ['Admin', 'StockManager'] },
    ],
  },
  {
    label: 'Paramètres',
    items: [
      { to: '/online/settings', label: 'Intégrations', icon: Cloud, section: 'onlineSettings', roles: ['Admin'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin', label: 'Tableau Admin', icon: ShieldCheck, section: 'admin', roles: ['Admin'] },
    ],
  },
]

const ROLE_DISPLAY: Record<string, string> = {
  Admin: 'Administrateur',
  Cashier: 'Caissier',
  StockManager: 'Gestionnaire Stock',
}

function useLinks(sections: NavSection[], t: (k: string) => string, role: string) {
  return sections
    .map((section) => ({
      label: section.label,
      items: section.items
        .filter((item) => !item.roles || item.roles.includes(role))
        .map((item) => ({
          to: item.to,
          end: item.end,
          label: item.label ?? t(`nav.${item.labelKey}`),
          icon: item.icon,
          section: item.section,
        })),
    }))
    .filter((section) => section.items.length > 0)
}

function SidebarNavList({
  sections,
  onNavigate,
  mode,
}: {
  sections: ReturnType<typeof useLinks>
  onNavigate: () => void
  mode: StoreMode
}) {
  let itemIndex = -1

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
            {section.label}
          </p>
          <div className="space-y-0.5">
            {section.items.map((link) => {
              itemIndex += 1
              const Icon = link.icon
              return (
                <motion.div
                  key={link.to}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: DUR.base,
                    ease: EASE.outSoft,
                    delay: staggerDelay(itemIndex),
                  }}
                >
                  <NavLink
                    to={link.to}
                    end={link.end}
                    onClick={onNavigate}
                    // Each item carries its destination's accent, so the nav
                    // teaches the colour language before you get there.
                    {...sectionProps(link.section)}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-field px-3 py-2 text-sm',
                        'transition-colors duration-fast ease-out-soft',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]',
                        isActive
                          ? 'font-medium text-[var(--accent-ink)]'
                          : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span
                            layoutId={`nav-active-${mode}`}
                            transition={SPRING.snappy}
                            className="absolute inset-0 rounded-field bg-[var(--accent-soft)]"
                          />
                        )}
                        {isActive && (
                          <motion.span
                            layoutId={`nav-bar-${mode}`}
                            transition={SPRING.snappy}
                            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-chip bg-[var(--accent)]"
                          />
                        )}
                        <Icon
                          className={cn(
                            'relative z-10 h-[18px] w-[18px] shrink-0 transition-colors duration-fast',
                            isActive ? 'text-[var(--accent)]' : 'text-fg-subtle group-hover:text-fg-muted'
                          )}
                        />
                        <span className="relative z-10 truncate">{link.label}</span>
                      </>
                    )}
                  </NavLink>
                </motion.div>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

const MODE_META: Record<StoreMode, { subtitle: string; section: SectionName; icon: ComponentType<{ className?: string }> }> = {
  local: { subtitle: 'Boutique Locale', section: 'pos', icon: Store },
  online: { subtitle: 'Boutique en Ligne', section: 'onlineDash', icon: Globe },
}

export default function Sidebar() {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()
  const { mode, setMode } = useStoreModeStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { mobileNavOpen, closeMobileNav } = useUIStore()
  const localSections = useLinks(localNavSections, t, user?.role || 'Admin')
  const onlineSections = useLinks(onlineNavSections, t, user?.role || 'Admin')
  const meta = MODE_META[mode]

  useEffect(() => {
    closeMobileNav()
  }, [location.pathname, closeMobileNav])

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileNavOpen])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.fast }}
            className="fixed inset-0 z-40 bg-[oklch(0.15_0.02_262_/_0.5)] backdrop-blur-[var(--blur-1)] lg:hidden"
            onClick={closeMobileNav}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <aside
        {...sectionProps(meta.section)}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-shrink-0 flex-col',
          'border-r border-border bg-surface',
          // Permitted blur: fixed chrome, one instance, static backdrop.
          'lg:bg-surface/80 lg:backdrop-blur-[var(--blur-2)]',
          'transform transition-transform duration-300 ease-in-out',
          'lg:static lg:z-auto lg:w-60 lg:min-h-screen lg:translate-x-0',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-[var(--accent)] text-[var(--accent-fg)] shadow-e1"
                aria-hidden="true"
              >
                <meta.icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold tracking-tight text-fg">FlexShoes</h1>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={meta.subtitle}
                    initial={{ opacity: 0, y: -3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 3 }}
                    transition={{ duration: DUR.fast }}
                    className="truncate text-[11px] text-fg-subtle"
                  >
                    {meta.subtitle}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
            <button
              onClick={closeMobileNav}
              className="-mr-1 -mt-1 rounded-inset p-1 text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] lg:hidden"
              aria-label={t('common.close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mode switcher. The sliding pill is a shared layoutId, so the two
              modes feel like one control rather than two buttons. */}
          <div className="mt-3 flex gap-0.5 rounded-field bg-sunken p-0.5">
            {(['local', 'online'] as const).map((m) => {
              const active = mode === m
              const Icon = MODE_META[m].icon
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  {...sectionProps(MODE_META[m].section)}
                  className={cn(
                    'relative flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--r-field)-3px)] px-2 py-1.5',
                    'text-xs font-medium transition-colors duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]',
                    active ? 'text-[var(--accent-fg)]' : 'text-fg-subtle hover:text-fg'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="mode-pill"
                      transition={SPRING.snappy}
                      className="absolute inset-0 rounded-[calc(var(--r-field)-3px)] bg-[var(--accent)] shadow-e1"
                    />
                  )}
                  <Icon className="relative z-10 h-3.5 w-3.5" />
                  <span className="relative z-10">{m === 'local' ? 'Local' : 'En ligne'}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <SidebarNavList
            key={mode}
            sections={mode === 'online' ? onlineSections : localSections}
            onNavigate={closeMobileNav}
            mode={mode}
          />
        </div>

        <div className="border-t border-border px-3 py-3">
          {user && (
            <div className="mb-2 flex items-center gap-3 rounded-field bg-surface-2 px-2 py-2">
              <Avatar name={user.fullName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{user.fullName}</p>
                <p className="truncate text-[11px] text-fg-subtle">
                  {ROLE_DISPLAY[user.role] || user.role}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              'flex w-full items-center gap-2 rounded-field px-3 py-2 text-sm text-fg-subtle',
              'transition-colors duration-fast hover:bg-[var(--negative-soft)] hover:text-[var(--negative)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]'
            )}
          >
            <LogOut className="h-4 w-4" />
            {t('auth.signOut')}
          </button>
          <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-fg-subtle">
            <Gauge className="h-3 w-3" />
            v1.0.0
          </p>
        </div>
      </aside>
    </>
  )
}
