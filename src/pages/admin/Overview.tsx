import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  FileLock2,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageBody, PageHeader } from '@/components/layout/AppShell'
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  StatTile,
} from '@/components/ui/primitives'
import {
  ActionLabel,
  LogStatusDot,
  ProviderIcon,
  UserStatusBadge,
} from '@/components/domain'
import { formatBytes, timeAgo } from '@/lib/utils'

export default function AdminOverview() {
  const { users, vaultFiles, logs, alerts, providers } = useApp()

  const employees = users.filter((u) => u.role === 'employee')
  const openAlerts = alerts.filter((a) => !a.resolved)
  const pending = employees.filter((u) => u.status === 'pending')
  const totalBytes = vaultFiles.reduce((sum, f) => sum + f.sizeBytes, 0)

  return (
    <>
      <PageHeader
        title="Security overview"
        subtitle="Organisation-wide encryption activity, access state and open incidents."
        badge={
          openAlerts.length > 0 ? (
            <Badge tone="danger" icon={<AlertTriangle className="size-3" />}>
              {openAlerts.length} open alert{openAlerts.length > 1 ? 's' : ''}
            </Badge>
          ) : (
            <Badge tone="ok" icon={<ShieldCheck className="size-3" />}>
              All clear
            </Badge>
          )
        }
      />

      <PageBody className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Employees"
            value={employees.length}
            icon={<Users className="size-4" />}
            hint={`${employees.filter((u) => u.status === 'active').length} active · ${pending.length} pending`}
          />
          <StatTile
            label="Files encrypted"
            value={vaultFiles.length}
            icon={<FileLock2 className="size-4" />}
            tone="ok"
            hint={formatBytes(totalBytes)}
          />
          <StatTile
            label="Open alerts"
            value={openAlerts.length}
            icon={<Bell className="size-4" />}
            tone={openAlerts.length > 0 ? 'danger' : 'brand'}
            hint="Failed keys, unknown devices"
          />
          <StatTile
            label="Audit events"
            value={logs.length}
            icon={<ShieldCheck className="size-4" />}
            tone="violet"
            hint="Hash-chained, tamper-evident"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader
              title="Open security alerts"
              subtitle="Needs an administrator decision"
              icon={<Bell className="size-4" />}
              action={
                <Link
                  to="/admin/alerts"
                  className="text-xs text-fg-muted transition-colors hover:text-brand-400"
                >
                  View all
                </Link>
              }
            />
            {openAlerts.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck className="size-5" />}
                title="Nothing needs attention"
                description="Failed key attempts and unrecognised devices will surface here."
              />
            ) : (
              <ul className="divide-y divide-ink-800">
                {openAlerts.slice(0, 4).map((alert) => (
                  <li key={alert.id} className="flex items-start gap-3 px-5 py-3.5">
                    <span
                      className={`mt-1 size-2 shrink-0 rounded-full ${
                        alert.severity === 'critical' ? 'bg-danger' : 'bg-warn'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg">{alert.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">
                        {alert.detail}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-fg-subtle">
                      {timeAgo(alert.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Connected providers"
              subtitle="Storage targets available to employees"
              icon={<FileLock2 className="size-4" />}
            />
            <ul className="divide-y divide-ink-800">
              {providers.map((provider) => (
                <li key={provider.id} className="flex items-center gap-3 px-5 py-3">
                  <ProviderIcon id={provider.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">{provider.name}</p>
                    <p className="truncate text-[11px] text-fg-subtle">
                      {provider.connected ? provider.account : provider.blurb}
                    </p>
                  </div>
                  {provider.connected ? (
                    <Badge tone="ok">Linked</Badge>
                  ) : (
                    <Badge tone="neutral">Not linked</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader
              title="Employees"
              subtitle="Access state across the organisation"
              icon={<Users className="size-4" />}
              action={
                <Link
                  to="/admin/employees"
                  className="text-xs text-fg-muted transition-colors hover:text-brand-400"
                >
                  Manage
                </Link>
              }
            />
            <ul className="divide-y divide-ink-800">
              {employees.map((user) => (
                <li key={user.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">{user.name}</p>
                    <p className="truncate text-[11px] text-fg-subtle">
                      {user.department} ·{' '}
                      {user.lastActiveAt ? timeAgo(user.lastActiveAt) : 'never signed in'}
                    </p>
                  </div>
                  <UserStatusBadge status={user.status} />
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Latest activity"
              subtitle="All employees, newest first"
              icon={<ShieldCheck className="size-4" />}
              action={
                <Link
                  to="/admin/logs"
                  className="text-xs text-fg-muted transition-colors hover:text-brand-400"
                >
                  Full audit log
                </Link>
              }
            />
            <ul className="divide-y divide-ink-800">
              {logs.slice(0, 6).map((log) => (
                <li key={log.id} className="flex items-start gap-3 px-5 py-3">
                  <LogStatusDot status={log.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <ActionLabel action={log.action} />
                      <span className="truncate text-[11px] text-fg-subtle">
                        {log.userName}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-fg-muted">
                      {log.detail}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-fg-subtle">
                    {timeAgo(log.at)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </PageBody>
    </>
  )
}
