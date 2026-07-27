import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Toast from '../shared/Toast'

export default function MainLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </main>
      <Toast />
    </div>
  )
}
