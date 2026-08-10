import { useMemo, useState } from 'react'
import {
  Check,
  Fingerprint,
  Search,
  Shield,
  ShieldX,
  Smartphone,
  UserPlus,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { useToast } from '@/components/ui/Toast'
import { PageBody, PageHeader } from '@/components/layout/AppShell'
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Input,
  Select,
} from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { UserStatusBadge } from '@/components/domain'
import type { User } from '@/lib/types'
import { formatDate, timeAgo } from '@/lib/utils'

export default function Employees() {
  const { users, setUserStatus, visibleLogs } = useApp()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [confirm, setConfirm] = useState<{ user: User; next: User['status'] } | null>(null)
  const [detail, setDetail] = useState<User | null>(null)

  const employees = useMemo(() => {
    let list = users.filter((u) => u.role === 'employee')
    if (status !== 'all') list = list.filter((u) => u.status === status)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.department.toLowerCase().includes(q),
      )
    }
    return list
  }, [users, query, status])

  function applyStatusChange() {
    if (!confirm) return
    setUserStatus(confirm.user.id, confirm.next)
    toast({
      tone: confirm.next === 'suspended' ? 'warning' : 'success',
      title:
        confirm.next === 'suspended'
          ? `${confirm.user.name}'s access revoked`
          : `${confirm.user.name} approved`,
      description:
        confirm.next === 'suspended'
          ? 'Their passkeys are rejected at sign-in and existing sessions are terminated.'
          : 'They can now sign in and encrypt files.',
    })
    setConfirm(null)
  }

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle="Approve new accounts, review enrolled passkeys, and revoke access."
        actions={
          <Button size="sm" icon={<UserPlus className="size-3.5" />} disabled>
            Invite employee
          </Button>
        }
      />

      <PageBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <Input
              placeholder="Search employees…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              icon={<Search className="size-3.5" />}
            />
          </div>
          <Select
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All states' },
              { value: 'active', label: 'Active' },
              { value: 'pending', label: 'Pending approval' },
              { value: 'suspended', label: 'Suspended' },
            ]}
            className="w-48"
          />
          <span className="ml-auto text-xs text-fg-muted">
            {employees.length} employee{employees.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-xl2 border border-ink-700 bg-ink-850">
          {employees.length === 0 ? (
            <EmptyState
              icon={<Shield className="size-5" />}
              title="No employees match"
              description="Adjust the search or state filter to see more accounts."
            />
          ) : (
            <div className="h-full overflow-auto">
              <table className="w-full min-w-[56rem] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-ink-900">
                  <tr className="border-b border-ink-700 text-left">
                    <Th>Employee</Th>
                    <Th className="w-44">Department</Th>
                    <Th className="w-52">Passkeys</Th>
                    <Th className="w-36">Last active</Th>
                    <Th className="w-36">State</Th>
                    <Th className="w-56">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-ink-800 transition-colors last:border-0 hover:bg-ink-800/60"
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDetail(user)}
                          className="flex items-center gap-2.5 text-left"
                        >
                          <Avatar name={user.name} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-fg">
                              {user.name}
                            </span>
                            <span className="block truncate text-[11px] text-fg-subtle">
                              {user.email}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-fg-muted">
                        {user.department}
                      </td>
                      <td className="px-4 py-3">
                        {user.passkeys.length === 0 ? (
                          <Badge tone="warn">None enrolled</Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {user.passkeys.map((pk) => (
                              <Badge
                                key={pk.id}
                                tone="brand"
                                icon={
                                  pk.kind === 'phone' ? (
                                    <Smartphone className="size-3" />
                                  ) : (
                                    <Fingerprint className="size-3" />
                                  )
                                }
                              >
                                {pk.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-fg-muted">
                        {user.lastActiveAt ? timeAgo(user.lastActiveAt) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <UserStatusBadge status={user.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {user.status === 'pending' ? (
                            <Button
                              size="sm"
                              icon={<Check className="size-3.5" />}
                              onClick={() => setConfirm({ user, next: 'active' })}
                            >
                              Approve
                            </Button>
                          ) : null}
                          {user.status === 'active' ? (
                            <Button
                              size="sm"
                              variant="danger"
                              icon={<ShieldX className="size-3.5" />}
                              onClick={() => setConfirm({ user, next: 'suspended' })}
                            >
                              Revoke access
                            </Button>
                          ) : null}
                          {user.status === 'suspended' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirm({ user, next: 'active' })}
                            >
                              Restore access
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDetail(user)}
                          >
                            Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageBody>

      {/* confirm status change */}
      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm?.next === 'suspended' ? 'Revoke access?' : 'Approve this account?'
        }
        icon={<Shield className="size-5" />}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={confirm?.next === 'suspended' ? 'danger' : 'primary'}
              onClick={applyStatusChange}
            >
              {confirm?.next === 'suspended' ? 'Revoke access' : 'Approve'}
            </Button>
          </>
        }
      >
        {confirm ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 p-3.5">
              <Avatar name={confirm.user.name} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{confirm.user.name}</p>
                <p className="truncate text-xs text-fg-muted">{confirm.user.email}</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-fg-muted">
              {confirm.next === 'suspended'
                ? 'Their enrolled passkeys will be rejected at sign-in and any active session ends immediately. Files they already encrypted stay in the cloud — this only removes their ability to decrypt through the app.'
                : 'They will be able to sign in with their passkey, encrypt files to connected providers, and decrypt anything issued to them.'}
            </p>
          </div>
        ) : null}
      </Modal>

      {/* employee detail */}
      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ''}
        subtitle={detail?.email}
        size="md"
        footer={<Button onClick={() => setDetail(null)}>Close</Button>}
      >
        {detail ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Department" value={detail.department} />
              <Field label="Account created" value={formatDate(detail.createdAt)} />
              <Field
                label="Last active"
                value={detail.lastActiveAt ? timeAgo(detail.lastActiveAt) : 'Never'}
              />
              <Field label="Role" value="Employee" />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-fg-muted">Enrolled passkeys</p>
              {detail.passkeys.length === 0 ? (
                <p className="rounded-xl border border-warn/25 bg-warn/[0.07] px-3.5 py-3 text-xs text-warn">
                  No passkey enrolled yet — this account cannot sign in.
                </p>
              ) : (
                <ul className="space-y-2">
                  {detail.passkeys.map((pk) => (
                    <li
                      key={pk.id}
                      className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-3.5 py-3"
                    >
                      {pk.kind === 'phone' ? (
                        <Smartphone className="size-4 shrink-0 text-brand-400" />
                      ) : (
                        <Fingerprint className="size-4 shrink-0 text-brand-400" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-fg">{pk.label}</p>
                        <p className="truncate text-[11px] text-fg-subtle">
                          {pk.authenticator}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-fg-subtle">
                        {pk.lastUsedAt ? timeAgo(pk.lastUsedAt) : 'unused'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-fg-muted">Recent events</p>
              <ul className="space-y-1.5">
                {visibleLogs(detail.id)
                  .slice(0, 5)
                  .map((log) => (
                    <li key={log.id} className="text-xs leading-relaxed text-fg-muted">
                      <span className="text-fg-subtle">{timeAgo(log.at)}</span> — {log.detail}
                    </li>
                  ))}
                {visibleLogs(detail.id).length === 0 ? (
                  <li className="text-xs text-fg-subtle">No events recorded.</li>
                ) : null}
              </ul>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 px-3.5 py-2.5">
      <p className="text-[11px] text-fg-subtle">{label}</p>
      <p className="mt-0.5 truncate text-sm text-fg">{value}</p>
    </div>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle ${className ?? ''}`}
    >
      {children}
    </th>
  )
}
