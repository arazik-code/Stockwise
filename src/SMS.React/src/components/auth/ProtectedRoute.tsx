import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const ONLINE_ROUTES = ['/online', '/online/orders', '/online/confirmation', '/online/products', '/online/clients', '/online/crm', '/online/delivery', '/online/finance', '/online/sync']

const ROLE_ROUTES: Record<string, string[]> = {
  Admin: ['/', '/pos', '/products', '/fournisseurs', '/invoices', '/stock', '/sales', '/reports', '/settings', '/printer', '/refunds', '/clients', '/invoice-designer', '/receipt-designer', ...ONLINE_ROUTES, '/online/settings'],
  Cashier: ['/', '/pos', '/sales', '/refunds', '/clients', '/reports'],
  StockManager: ['/', '/products', '/fournisseurs', '/invoices', '/stock', '/reports', ...ONLINE_ROUTES],
}

const DEFAULT_ROUTE: Record<string, string> = {
  Admin: '/',
  Cashier: '/pos',
  StockManager: '/products',
}

export default function ProtectedRoute() {
  const { token, user } = useAuthStore()
  const location = useLocation()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (user && !user.mustChangePassword) {
    const allowed = ROLE_ROUTES[user.role] || ROLE_ROUTES['Admin']
    if (!allowed.includes(location.pathname)) {
      return <Navigate to={DEFAULT_ROUTE[user.role] || '/'} replace />
    }
  }

  return <Outlet />
}
