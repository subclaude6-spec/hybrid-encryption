import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell,
  FileLock2,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  ScrollText,
  ShieldCheck,
  UploadCloud,
  Users,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { cn } from '@/lib/utils'
import { Avatar, Badge } from '../ui/primitives'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}

const EMPLOYEE_NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/upload', label: 'Encrypt & upload', icon: UploadCloud },
  { to: '/app/decrypt', label: 'Decrypt', icon: KeyRound },
  { to: '/app/history', label: 'My files', icon: History },
  { to: '/app/logs', label: 'My activity', icon: ScrollText },
]

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/employees', label: 'Employees', icon: Users },
  { to: '/admin/upload', label: 'Encrypt & upload', icon: UploadCloud },
  { to: '/admin/decrypt', label: 'Decrypt', icon: KeyRound },
  { to: '/admin/vault', label: 'All files', icon: FileLock2 },
  { to: '/admin/logs', label: 'Audit log', icon: ScrollText },
  { to: '/admin/alerts', label: 'Security alerts', icon: Bell },
]

export function AppShell() {
  const { currentUser, signOut, alerts } = useApp()
  const navigate = useNavigate()

  if (!currentUser) return null

  const isAdmin = currentUser.role === 'admin'
  const nav = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV
  const openAlerts = alerts.filter((a) => !a.resolved).length

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-full bg-ink-950">
      {/* sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-900">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-500 text-ink-onbrand">
            <ShieldCheck className="size-4.5" strokeWidth={2.4} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight text-fg">
              Hybrid Cloud
            </p>
            <p className="truncate text-[11px] leading-tight text-fg-subtle">Encryption</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-brand-500/12 font-medium text-brand-400'
                    : 'text-fg-muted hover:bg-ink-850 hover:text-fg',
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              {to === '/admin/alerts' && openAlerts > 0 ? (
                <span className="flex size-4.5 items-center justify-center rounded-full bg-danger/20 text-[10px] font-semibold text-danger">
                  {openAlerts}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-ink-800 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <Avatar name={currentUser.name} size="sm" tone={isAdmin ? 'violet' : 'brand'} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-fg">{currentUser.name}</p>
              <p className="truncate text-[11px] text-fg-subtle">
                {isAdmin ? 'Administrator' : currentUser.department}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="shrink-0 rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-ink-800 hover:text-danger"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  )
}

/** Consistent page header for every route inside the shell. */
export function PageHeader({
  title,
  subtitle,
  actions,
  badge,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-ink-800 bg-ink-900/60 px-8 py-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="truncate text-lg font-semibold tracking-tight text-fg">{title}</h1>
          {badge}
        </div>
        {subtitle ? (
          <p className="mt-0.5 truncate text-sm text-fg-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto px-8 py-6', className)}>
      {children}
    </div>
  )
}

export function RoleBadge({ role }: { role: 'admin' | 'employee' }) {
  return role === 'admin' ? (
    <Badge tone="violet">Administrator</Badge>
  ) : (
    <Badge tone="brand">Employee</Badge>
  )
}
