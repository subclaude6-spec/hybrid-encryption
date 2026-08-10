import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppStoreProvider, useApp } from '@/store/AppStore'
import { ToastProvider } from '@/components/ui/Toast'
import { AppShell } from '@/components/layout/AppShell'
import type { Role } from '@/lib/types'

import Login from '@/pages/Login'
import Dashboard from '@/pages/employee/Dashboard'
import Upload from '@/pages/employee/Upload'
import Decrypt from '@/pages/employee/Decrypt'
import History from '@/pages/employee/History'
import ActivityLog from '@/pages/employee/ActivityLog'
import AdminOverview from '@/pages/admin/Overview'
import Employees from '@/pages/admin/Employees'
import AdminVault from '@/pages/admin/Vault'
import AuditLog from '@/pages/admin/AuditLog'
import Alerts from '@/pages/admin/Alerts'

/** Shown while the initial /auth/me check is in flight, so a page refresh
 *  doesn't bounce a signed-in user to the login screen. */
function SessionLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-ink-950">
      <Loader2 className="size-6 animate-spin text-brand-400" />
    </div>
  )
}

/** Blocks a route unless someone is signed in with the required role. */
function RequireRole({ role }: { role: Role }) {
  const { currentUser, bootstrapping } = useApp()
  if (bootstrapping) return <SessionLoading />
  if (!currentUser) return <Navigate to="/login" replace />
  if (currentUser.role !== role) {
    return <Navigate to={currentUser.role === 'admin' ? '/admin' : '/app'} replace />
  }
  return <AppShell />
}

function LandingRedirect() {
  const { currentUser, bootstrapping } = useApp()
  if (bootstrapping) return <SessionLoading />
  if (!currentUser) return <Navigate to="/login" replace />
  return <Navigate to={currentUser.role === 'admin' ? '/admin' : '/app'} replace />
}

export default function App() {
  return (
    <AppStoreProvider>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<LandingRedirect />} />
          <Route path="/login" element={<Login />} />

          <Route element={<RequireRole role="employee" />}>
            <Route path="/app" element={<Dashboard />} />
            <Route path="/app/upload" element={<Upload />} />
            <Route path="/app/decrypt" element={<Decrypt />} />
            <Route path="/app/history" element={<History />} />
            <Route path="/app/logs" element={<ActivityLog />} />
          </Route>

          <Route element={<RequireRole role="admin" />}>
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/employees" element={<Employees />} />
            <Route path="/admin/vault" element={<AdminVault />} />
            <Route path="/admin/logs" element={<AuditLog />} />
            <Route path="/admin/alerts" element={<Alerts />} />
          </Route>

          <Route path="*" element={<LandingRedirect />} />
        </Routes>
      </ToastProvider>
    </AppStoreProvider>
  )
}
