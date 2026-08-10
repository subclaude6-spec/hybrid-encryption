import { useMemo, useState } from 'react'
import { Download, ScrollText, Search } from 'lucide-react'
import type { LogEntry, LogStatus } from '@/lib/types'
import { formatDateTime, timeAgo } from '@/lib/utils'
import { Button, EmptyState, Input, Select } from './ui/primitives'
import { ActionLabel, LogStatusDot, ProviderName } from './domain'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All outcomes' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'warning', label: 'Warning' },
]

export function LogTable({
  logs,
  showUser = false,
  userFilter,
  children,
}: {
  logs: LogEntry[]
  showUser?: boolean
  /** Rendered next to the search box — e.g. the admin's employee picker. */
  userFilter?: React.ReactNode
  children?: React.ReactNode
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<LogStatus | 'all'>('all')

  const rows = useMemo(() => {
    let list = logs
    if (status !== 'all') list = list.filter((l) => l.status === status)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (l) =>
          l.detail.toLowerCase().includes(q) ||
          l.userName.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q),
      )
    }
    return list
  }, [logs, status, query])

  function exportCsv() {
    const header = ['timestamp', 'user', 'action', 'status', 'detail', 'ip', 'device']
    const body = rows.map((l) =>
      [l.at, l.userName, l.action, l.status, l.detail, l.ip, l.device]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    )
    const blob = new Blob([[header.join(','), ...body].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'hce-audit-log.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            placeholder="Search events…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            icon={<Search className="size-3.5" />}
          />
        </div>
        {userFilter}
        <Select
          value={status}
          onChange={(v) => setStatus(v as LogStatus | 'all')}
          options={STATUS_OPTIONS}
          className="w-40"
        />
        {children}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-fg-muted">
            {rows.length} event{rows.length === 1 ? '' : 's'}
          </span>
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="size-3.5" />}
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl2 border border-ink-700 bg-ink-850">
        {rows.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="size-5" />}
            title="No matching events"
            description="Try a different search term or clear the outcome filter."
          />
        ) : (
          <div className="h-full overflow-auto">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-ink-900">
                <tr className="border-b border-ink-700 text-left">
                  <Th className="w-44">Time</Th>
                  {showUser ? <Th className="w-44">User</Th> : null}
                  <Th className="w-44">Action</Th>
                  <Th>Detail</Th>
                  <Th className="w-28">Provider</Th>
                  <Th className="w-32">Source</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-ink-800 transition-colors last:border-0 hover:bg-ink-800/60"
                  >
                    <td className="px-4 py-3 align-top">
                      <p className="whitespace-nowrap text-xs text-fg">
                        {formatDateTime(log.at)}
                      </p>
                      <p className="text-[11px] text-fg-subtle">{timeAgo(log.at)}</p>
                    </td>
                    {showUser ? (
                      <td className="px-4 py-3 align-top">
                        <p className="truncate text-xs text-fg">{log.userName}</p>
                      </td>
                    ) : null}
                    <td className="px-4 py-3 align-top">
                      <span className="flex items-center gap-2 whitespace-nowrap text-xs">
                        <LogStatusDot status={log.status} />
                        <ActionLabel action={log.action} />
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-xs leading-relaxed text-fg-muted">{log.detail}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="whitespace-nowrap text-xs text-fg-muted">
                        <ProviderName id={log.providerId} />
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="truncate text-[11px] text-fg-muted">{log.ip}</p>
                      <p className="truncate text-[11px] text-fg-subtle">{log.device}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
