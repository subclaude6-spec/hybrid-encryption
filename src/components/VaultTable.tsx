import { useMemo, useState } from 'react'
import { Check, Copy, Eye, EyeOff, FileLock2, Search } from 'lucide-react'
import type { VaultFile } from '@/lib/types'
import { formatDateTime, formatBytes, timeAgo } from '@/lib/utils'
import { EmptyState, Input, Select } from './ui/primitives'
import { ProviderIcon, VaultStatusBadge } from './domain'
import { providerById } from '@/lib/mock-data'

export function VaultTable({
  files,
  showOwner = false,
  filters,
}: {
  files: VaultFile[]
  showOwner?: boolean
  filters?: React.ReactNode
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [revealed, setRevealed] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const rows = useMemo(() => {
    let list = files
    if (status !== 'all') list = list.filter((f) => f.status === status)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (f) =>
          f.encryptedName.toLowerCase().includes(q) ||
          f.originalName.toLowerCase().includes(q) ||
          f.ownerName.toLowerCase().includes(q),
      )
    }
    return list
  }, [files, query, status])

  async function copyKey(file: VaultFile) {
    await navigator.clipboard.writeText(file.keyId)
    setCopied(file.id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            placeholder="Search files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            icon={<Search className="size-3.5" />}
          />
        </div>
        {filters}
        <Select
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All states' },
            { value: 'encrypted', label: 'Encrypted' },
            { value: 'decrypted', label: 'Decrypted' },
            { value: 'failed', label: 'Failed' },
          ]}
          className="w-40"
        />
        <span className="ml-auto text-xs text-fg-muted">
          {rows.length} file{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl2 border border-ink-700 bg-ink-850">
        {rows.length === 0 ? (
          <EmptyState
            icon={<FileLock2 className="size-5" />}
            title="No files here"
            description="Encrypted uploads appear here with their storage location and key reference."
          />
        ) : (
          <div className="h-full overflow-auto">
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-ink-900">
                <tr className="border-b border-ink-700 text-left">
                  <Th>File</Th>
                  {showOwner ? <Th className="w-40">Owner</Th> : null}
                  <Th className="w-36">Stored on</Th>
                  <Th className="w-24">Size</Th>
                  <Th className="w-56">Key reference</Th>
                  <Th className="w-32">State</Th>
                  <Th className="w-40">Encrypted</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((file) => (
                  <tr
                    key={file.id}
                    className="border-b border-ink-800 transition-colors last:border-0 hover:bg-ink-800/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <FileLock2 className="size-4 shrink-0 text-brand-400" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-fg">
                            {file.encryptedName}
                          </p>
                          <p className="truncate text-[11px] text-fg-subtle">
                            was {file.originalName}
                          </p>
                        </div>
                      </div>
                    </td>
                    {showOwner ? (
                      <td className="px-4 py-3">
                        <p className="truncate text-xs text-fg">{file.ownerName}</p>
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProviderIcon id={file.providerId} size="sm" />
                        <span className="truncate text-xs text-fg-muted">
                          {providerById(file.providerId).name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-muted">
                      {formatBytes(file.sizeBytes)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-brand-400">
                          {revealed === file.id ? file.keyId : '••••-•••••-•••••-•••••'}
                        </code>
                        <button
                          onClick={() =>
                            setRevealed(revealed === file.id ? null : file.id)
                          }
                          aria-label={revealed === file.id ? 'Hide key' : 'Reveal key'}
                          className="shrink-0 rounded p-1 text-fg-subtle transition-colors hover:text-fg"
                        >
                          {revealed === file.id ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => copyKey(file)}
                          aria-label="Copy key"
                          className="shrink-0 rounded p-1 text-fg-subtle transition-colors hover:text-fg"
                        >
                          {copied === file.id ? (
                            <Check className="size-3.5 text-ok" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="mt-0.5 text-[10px] text-fg-subtle">
                        {file.algorithm}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <VaultStatusBadge status={file.status} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="whitespace-nowrap text-[11px] text-fg-muted">
                        {formatDateTime(file.createdAt)}
                      </p>
                      <p className="text-[11px] text-fg-subtle">{timeAgo(file.createdAt)}</p>
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
