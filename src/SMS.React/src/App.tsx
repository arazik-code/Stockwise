import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import ProtectedRoute from './components/auth/ProtectedRoute'
import MainLayout from './components/layout/MainLayout'
import { RouteFallback } from './components/layout/RouteFallback'

// LoginPage stays EAGER: it is the first paint for a logged-out user, and
// making the login screen wait on a chunk fetch is the one place lazy loading
// costs more than it saves.
import LoginPage from './pages/LoginPage'

/**
 * Routes.
 *
 * ── Why every route is lazy ─────────────────────────────────────────────────
 *
 * All 33 pages used to be imported eagerly, producing a single 1.08 MB entry
 * chunk that every user downloaded before seeing anything - including the
 * cashier who only ever opens /pos.
 *
 * Lazy routes are also what pays for the five new packages: the chart kit,
 * barcode/QR libraries and the admin suite now load only on the routes that
 * use them, so the entry chunk gets SMALLER despite the app gaining more.
 *
 * The Suspense fallback is an archetype-matched skeleton rather than a
 * spinner, so a chunk fetch looks like the page arriving rather than the app
 * stalling.
 */

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const PosPage = lazy(() => import('./pages/PosPage'))
const ProductsPage = lazy(() => import('./pages/ProductsPage'))
const FournisseursPage = lazy(() => import('./pages/FournisseursPage'))
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'))
const StockPage = lazy(() => import('./pages/StockPage'))
const SalesPage = lazy(() => import('./pages/SalesPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ThermalPrinterPage = lazy(() => import('./pages/ThermalPrinterPage'))
const OfflineSalesPage = lazy(() => import('./pages/OfflineSalesPage'))
const RefundsPage = lazy(() => import('./pages/RefundsPage'))
const ClientsPage = lazy(() => import('./pages/ClientsPage'))
const InvoiceDesigner = lazy(() => import('./pages/InvoiceDesigner'))
const ReceiptDesigner = lazy(() => import('./pages/ReceiptDesigner'))
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const OnlineDashboardPage = lazy(() => import('./pages/online/OnlineDashboardPage'))
const OnlineOrdersPage = lazy(() => import('./pages/online/OnlineOrdersPage'))
const OnlineProductsPage = lazy(() => import('./pages/online/OnlineProductsPage'))
const OnlineClientsPage = lazy(() => import('./pages/online/OnlineClientsPage'))
const OnlineCrmPage = lazy(() => import('./pages/online/OnlineCrmPage'))
const OnlineDeliveryPage = lazy(() => import('./pages/online/OnlineDeliveryPage'))
const OnlineFinancePage = lazy(() => import('./pages/online/OnlineFinancePage'))
const OnlineConfirmationPage = lazy(() => import('./pages/online/OnlineConfirmationPage'))
const OnlineSyncPage = lazy(() => import('./pages/online/OnlineSyncPage'))
const OnlineLinkPage = lazy(() => import('./pages/online/OnlineLinkPage'))
const OnlineWhatsAppTemplatesPage = lazy(() => import('./pages/online/OnlineWhatsAppTemplatesPage'))
const OnlineSettingsPage = lazy(() => import('./pages/online/OnlineSettingsPage'))

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminRolesPage = lazy(() => import('./pages/admin/AdminRolesPage'))
const AdminHealthPage = lazy(() => import('./pages/admin/AdminHealthPage'))
const AdminAuditLogPage = lazy(() => import('./pages/admin/AdminAuditLogPage'))

/**
 * The design system showcase.
 *
 * Zero API dependency, so it is the one surface that fully works with the
 * backend down - which makes it both the design arbiter for parallel work and
 * the only meaningful verification surface in a sandbox. It also carries the
 * FPS meter and the glass stress test, the only way to validate the blur
 * budget on the real POS terminal.
 *
 * Ships in production but stays invisible unless explicitly enabled.
 */
const DesignShowcase = lazy(() => import('./pages/DesignShowcase'))
const designEnabled =
  import.meta.env.DEV ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('sms-design') === '1')

/** Wrap a lazy page in a Suspense boundary with the right skeleton. */
function withFallback(Component: ComponentType, archetype: Parameters<typeof RouteFallback>[0]['archetype']) {
  return (
    <Suspense fallback={<RouteFallback archetype={archetype} />}>
      <Component />
    </Suspense>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {designEnabled && (
            <Route
              path="/design"
              element={
                <Suspense fallback={<RouteFallback archetype="command" />}>
                  <DesignShowcase />
                </Suspense>
              }
            />
          )}

          <Route element={<ProtectedRoute />}>
            <Route path="/change-password" element={withFallback(ChangePasswordPage, 'config')} />

            <Route element={<MainLayout />}>
              <Route path="/" element={withFallback(DashboardPage, 'command')} />
              <Route path="/pos" element={withFallback(PosPage, 'console')} />
              <Route path="/products" element={withFallback(ProductsPage, 'catalog')} />
              <Route path="/fournisseurs" element={withFallback(FournisseursPage, 'ledger')} />
              <Route path="/invoices" element={withFallback(InvoicesPage, 'ledger')} />
              <Route path="/stock" element={withFallback(StockPage, 'ledger')} />
              <Route path="/sales" element={withFallback(SalesPage, 'ledger')} />
              <Route path="/reports" element={withFallback(ReportsPage, 'command')} />
              <Route path="/settings" element={withFallback(SettingsPage, 'config')} />
              <Route path="/printer" element={withFallback(ThermalPrinterPage, 'config')} />
              <Route path="/offline-sales" element={withFallback(OfflineSalesPage, 'ledger')} />
              <Route path="/refunds" element={withFallback(RefundsPage, 'console')} />
              <Route path="/clients" element={withFallback(ClientsPage, 'profile')} />
              <Route path="/invoice-designer" element={withFallback(InvoiceDesigner, 'config')} />
              <Route path="/receipt-designer" element={withFallback(ReceiptDesigner, 'config')} />

              <Route path="/online" element={withFallback(OnlineDashboardPage, 'command')} />
              <Route path="/online/orders" element={withFallback(OnlineOrdersPage, 'ledger')} />
              <Route path="/online/products" element={withFallback(OnlineProductsPage, 'catalog')} />
              <Route path="/online/clients" element={withFallback(OnlineClientsPage, 'profile')} />
              <Route path="/online/crm" element={withFallback(OnlineCrmPage, 'profile')} />
              <Route path="/online/delivery" element={withFallback(OnlineDeliveryPage, 'ledger')} />
              <Route path="/online/finance" element={withFallback(OnlineFinancePage, 'ledger')} />
              <Route path="/online/confirmation" element={withFallback(OnlineConfirmationPage, 'console')} />
              <Route path="/online/sync" element={withFallback(OnlineSyncPage, 'config')} />
              <Route path="/online/link" element={withFallback(OnlineLinkPage, 'config')} />
              <Route path="/online/whatsapp-templates" element={withFallback(OnlineWhatsAppTemplatesPage, 'config')} />
              <Route path="/online/settings" element={withFallback(OnlineSettingsPage, 'config')} />

              <Route
                path="/admin"
                element={
                  <Suspense fallback={<RouteFallback archetype="command" />}>
                    <AdminLayout />
                  </Suspense>
                }
              >
                <Route index element={withFallback(AdminOverviewPage, 'command')} />
                <Route path="users" element={withFallback(AdminUsersPage, 'ledger')} />
                <Route path="roles" element={withFallback(AdminRolesPage, 'config')} />
                <Route path="health" element={withFallback(AdminHealthPage, 'command')} />
                <Route path="audit-log" element={withFallback(AdminAuditLogPage, 'ledger')} />
              </Route>

              {/* Catch-all. The app previously had none - an unknown path
                  rendered the shell with an empty body and no explanation. */}
              <Route path="*" element={withFallback(NotFoundPage, 'config')} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
