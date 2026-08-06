import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/authStore'
import { useStoreModeStore, type StoreMode } from '../../store/storeModeStore'

interface NavConfig {
  to: string
  label?: string
  labelKey?: string
  icon: React.ReactNode
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
      {
        to: '/',
        labelKey: 'dashboard',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" /></svg>,
        end: true,
      },
    ],
  },
  {
    label: 'Ventes',
    items: [
      {
        to: '/pos',
        labelKey: 'pos',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>,
        roles: ['Admin', 'Cashier'],
      },
      {
        to: '/sales',
        labelKey: 'sales',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>,
        roles: ['Admin'],
      },
      {
        to: '/refunds',
        labelKey: 'refunds',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>,
        roles: ['Admin', 'Cashier'],
      },
      {
        to: '/clients',
        labelKey: 'clients',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
        roles: ['Admin', 'Cashier'],
      },
    ],
  },
  {
    label: 'Gestion',
    items: [
      {
        to: '/products',
        labelKey: 'products',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
        roles: ['Admin', 'StockManager'],
      },
      {
        to: '/stock',
        labelKey: 'stock',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
        roles: ['Admin', 'StockManager'],
      },
      {
        to: '/fournisseurs',
        labelKey: 'fournisseurs',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4m-4 6h.01M9 16h.01" /></svg>,
        roles: ['Admin', 'StockManager'],
      },
      {
        to: '/invoices',
        labelKey: 'invoices',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
        roles: ['Admin', 'StockManager'],
      },
    ],
  },
  {
    label: 'Rapports',
    items: [
      {
        to: '/reports',
        labelKey: 'reports',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
        roles: ['Admin', 'StockManager'],
      },
      {
        to: '/printer',
        labelKey: 'printer',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>,
        roles: ['Admin'],
      },
      {
        to: '/offline-sales',
        labelKey: 'offlineSales',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0" /></svg>,
        roles: ['Admin'],
      },
    ],
  },
  {
    label: 'Personnalisation',
    items: [
      {
        to: '/invoice-designer',
        label: 'Design Facture',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
        roles: ['Admin'],
      },
      {
        to: '/receipt-designer',
        label: 'Design Recu',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>,
        roles: ['Admin'],
      },
      {
        to: '/settings',
        labelKey: 'settings',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        roles: ['Admin'],
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        to: '/admin',
        label: 'Tableau Admin',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        roles: ['Admin'],
      },
    ],
  },
]

const onlineNavSections: NavSection[] = [
  {
    label: 'Dashboard',
    items: [
      {
        to: '/online',
        label: 'Tableau de Bord',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" /></svg>,
        end: true,
        roles: ['Admin', 'StockManager'],
      },
    ],
  },
  {
    label: 'Ventes en ligne',
    items: [
      {
        to: '/online/orders',
        label: 'Commandes',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 11H4L5 9z" /></svg>,
        roles: ['Admin', 'StockManager'],
      },
      {
        to: '/online/confirmation',
        label: 'File de confirmation',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
        roles: ['Admin', 'StockManager'],
      },
    ],
  },
  {
    label: 'Gestion',
    items: [
      {
        to: '/online/products',
        label: 'Produits',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
        roles: ['Admin', 'StockManager'],
      },
      {
        to: '/online/clients',
        label: 'Clients',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
        roles: ['Admin', 'StockManager'],
      },
      {
        to: '/online/crm',
        label: 'CRM & Analytique',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9A9.004 9.004 0 0015 3.512V9h5.488z" /></svg>,
        roles: ['Admin', 'StockManager'],
      },
    ],
  },
  {
    label: 'Livraison',
    items: [
      {
        to: '/online/delivery',
        label: 'OzonExpress',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1" /></svg>,
        roles: ['Admin', 'StockManager'],
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        to: '/online/finance',
        label: 'Encaissements COD',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        roles: ['Admin', 'StockManager'],
      },
    ],
  },
  {
    label: 'Synchronisation',
    items: [
      {
        to: '/online/sync',
        label: 'Conflits & État',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
        roles: ['Admin', 'StockManager'],
      },
      {
        to: '/online/link',
        label: 'Liaison Shopify',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5m4.5-4.5l1.5-1.5a4 4 0 115.656 5.656l-3 3a4 4 0 01-5.656 0" /></svg>,
        roles: ['Admin', 'StockManager'],
      },
      {
        to: '/online/whatsapp-templates',
        label: 'Modèles WhatsApp',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
        roles: ['Admin', 'StockManager'],
      },
    ],
  },
  {
    label: 'Paramètres',
    items: [
      {
        to: '/online/settings',
        label: 'Intégrations',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
        roles: ['Admin'],
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        to: '/admin',
        label: 'Tableau Admin',
        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        roles: ['Admin'],
      },
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
        })),
    }))
    .filter((section) => section.items.length > 0)
}

function SidebarNavList({ sections }: { sections: ReturnType<typeof useLinks> }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 animate-fade-in">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-1.5">{section.label}</p>
          <div className="space-y-0.5">
            {section.items.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-300 font-medium shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`flex-shrink-0 transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}>
                      {link.icon}
                    </span>
                    <span>{link.label}</span>
                    {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

const MODE_META: Record<StoreMode, { title: string; subtitle: string; accent: string }> = {
  local: { title: 'Gestion de Stock', subtitle: 'Boutique Locale', accent: 'from-blue-500 to-indigo-600' },
  online: { title: 'Gestion de Stock', subtitle: 'Boutique en Ligne', accent: 'from-emerald-500 to-teal-600' },
}

export default function Sidebar() {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()
  const { mode, setMode } = useStoreModeStore()
  const navigate = useNavigate()
  const localSections = useLinks(localNavSections, t, user?.role || 'Admin')
  const onlineSections = useLinks(onlineNavSections, t, user?.role || 'Admin')
  const meta = MODE_META[mode]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-60 bg-slate-900 min-h-screen flex flex-col flex-shrink-0">
      <div className="px-5 py-5 border-b border-slate-800">
        <h1 className="text-base font-bold text-white tracking-tight">{meta.title}</h1>
        <p key={meta.subtitle} className="text-[11px] text-slate-400 mt-0.5 animate-fade-in">{meta.subtitle}</p>

        <div className="mt-3 flex bg-slate-950/60 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setMode('local')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-colors duration-200 ${
              mode === 'local' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3" /></svg>
            Local
          </button>
          <button
            onClick={() => setMode('online')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-colors duration-200 ${
              mode === 'online' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
            En ligne
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <SidebarNavList key={mode} sections={mode === 'online' ? onlineSections : localSections} />
      </div>

      <div className="px-3 py-3 border-t border-slate-800">
        {user && (
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-slate-800/50 mb-2">
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${meta.accent} flex items-center justify-center flex-shrink-0`}>
              <span className="text-sm font-bold text-white">{user.fullName.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{user.fullName}</p>
              <p className="text-[11px] text-slate-500 truncate">{ROLE_DISPLAY[user.role] || user.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {t('auth.signOut')}
        </button>
        <p className="text-[10px] text-slate-600 text-center mt-2">v1.0.0</p>
      </div>
    </aside>
  )
}
