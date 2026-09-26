import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const ONLINE_ROUTES = ['/online', '/online/orders', '/online/confirmation', '/online/products', '/online/clients', '/online/crm', '/online/delivery', '/online/finance', '/online/sync', '/online/link', '/online/whatsapp-templates']

const ROLE_ROUTES: Record<string, string[]> = {
  Admin: ['/dashboard', '/pos', '/products', '/fournisseurs', '/invoices', '/stock', '/sales', '/reports', '/settings', '/printer', '/offline-sales', '/refunds', '/clients', '/invoice-designer', '/receipt-designer', ...ONLINE_ROUTES, '/online/settings', '/admin', '/admin/users', '/admin/roles', '/admin/health', '/admin/audit-log'],
  Cashier: ['/dashboard', '/pos', '/refunds', '/clients'],
  StockManager: ['/dashboard', '/products', '/fournisseurs', '/invoices', '/stock', '/reports', ...ONLINE_ROUTES],
}

const DEFAULT_ROUTE: Record<string, string> = {
  Admin: '/dashboard',
  Cashier: '/pos',
  StockManager: '/products',
}

// Every path any role can reach. Used to tell "wrong role for a real route" (redirect to that
// role's home) apart from "not a route at all" (let it fall through to the *, NotFoundPage) -
// without this distinction every unknown URL silently redirected to / instead of showing 404.
const ALL_KNOWN_ROUTES = new Set(Object.values(ROLE_ROUTES).flat())

export default function ProtectedRoute() {
  const { token, user } = useAuthStore()
  const location = useLocation()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (user && !user.mustChangePassword && ALL_KNOWN_ROUTES.has(location.pathname)) {
    const allowed = ROLE_ROUTES[user.role] || ROLE_ROUTES['Admin']
    if (!allowed.includes(location.pathname)) {
      return <Navigate to={DEFAULT_ROUTE[user.role] || '/dashboard'} replace />
    }
  }

  return <Outlet />
}
