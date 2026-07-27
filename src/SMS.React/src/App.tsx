import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import ProtectedRoute from './components/auth/ProtectedRoute'
import MainLayout from './components/layout/MainLayout'
import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import DashboardPage from './pages/DashboardPage'
import PosPage from './pages/PosPage'
import ProductsPage from './pages/ProductsPage'
import FournisseursPage from './pages/FournisseursPage'
import InvoicesPage from './pages/InvoicesPage'
import StockPage from './pages/StockPage'
import SalesPage from './pages/SalesPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import ThermalPrinterPage from './pages/ThermalPrinterPage'
import RefundsPage from './pages/RefundsPage'
import ClientsPage from './pages/ClientsPage'
import InvoiceDesigner from './pages/InvoiceDesigner'
import ReceiptDesigner from './pages/ReceiptDesigner'
import OnlineDashboardPage from './pages/online/OnlineDashboardPage'
import OnlineOrdersPage from './pages/online/OnlineOrdersPage'
import OnlineProductsPage from './pages/online/OnlineProductsPage'
import OnlineClientsPage from './pages/online/OnlineClientsPage'
import OnlineCrmPage from './pages/online/OnlineCrmPage'
import OnlineDeliveryPage from './pages/online/OnlineDeliveryPage'
import OnlineSyncPage from './pages/online/OnlineSyncPage'
import OnlineSettingsPage from './pages/online/OnlineSettingsPage'

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route element={<MainLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/pos" element={<PosPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/fournisseurs" element={<FournisseursPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/stock" element={<StockPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/printer" element={<ThermalPrinterPage />} />
              <Route path="/refunds" element={<RefundsPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/invoice-designer" element={<InvoiceDesigner />} />
              <Route path="/receipt-designer" element={<ReceiptDesigner />} />
              <Route path="/online" element={<OnlineDashboardPage />} />
              <Route path="/online/orders" element={<OnlineOrdersPage />} />
              <Route path="/online/products" element={<OnlineProductsPage />} />
              <Route path="/online/clients" element={<OnlineClientsPage />} />
              <Route path="/online/crm" element={<OnlineCrmPage />} />
              <Route path="/online/delivery" element={<OnlineDeliveryPage />} />
              <Route path="/online/sync" element={<OnlineSyncPage />} />
              <Route path="/online/settings" element={<OnlineSettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
