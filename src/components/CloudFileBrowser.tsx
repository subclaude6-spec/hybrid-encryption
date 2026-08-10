import { useMemo, useState } from 'react'
import {
  ChevronRight,
  FileLock2,
  FileText,
  Folder,
  RefreshCw,
  Search,
} from 'lucide-react'
import type { CloudFile, ProviderId } from '@/lib/types'
import { CLOUD_FILES, providerById } from '@/lib/mock-data'
import { cn, formatBytes, timeAgo } from '@/lib/utils'
import { Badge, EmptyState, Input } from './ui/primitives'
import { ProviderIcon } from './domain'

export function CloudFileBrowser({
  providerId,
  selectable = false,
  selectionMode = 'multiple',
  onlyEncrypted = false,
  selectedIds = [],
  onSelectionChange,
  emptyHint,
}: {
  providerId: ProviderId
  selectable?: boolean
  selectionMode?: 'single' | 'multiple'
  onlyEncrypted?: boolean
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  emptyHint?: string
}) {
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState<string | null>(null)
  const provider = providerById(providerId)

  const files = useMemo(() => {
    let list: CloudFile[] = CLOUD_FILES[providerId] ?? []
    if (onlyEncrypted) list = list.filter((f) => f.kind === 'folder' || f.encrypted)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((f) => f.name.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [providerId, onlyEncrypted, query])

  function toggle(file: CloudFile) {
    if (file.kind === 'folder') {
      setFolder(file.name)
      return
    }
    if (!selectable || !onSelectionChange) return
    if (selectionMode === 'single') {
      onSelectionChange(selectedIds.includes(file.id) ? [] : [file.id])
      return
    }
    onSelectionChange(
      selectedIds.includes(file.id)
        ? selectedIds.filter((id) => id !== file.id)
        : [...selectedIds, file.id],
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl2 border border-ink-700 bg-ink-900">
      {/* toolbar */}
      <div className="flex items-center gap-3 border-b border-ink-700 bg-ink-850 px-4 py-3">
        <ProviderIcon id={providerId} size="sm" />
        <div className="flex min-w-0 items-center gap-1.5 text-xs">
          <button
            onClick={() => setFolder(null)}
            className={cn(
              'font-medium transition-colors',
              folder ? 'text-fg-muted hover:text-fg' : 'text-fg',
            )}
          >
            {provider.name}
          </button>
          {folder ? (
            <>
              <ChevronRight className="size-3 text-fg-subtle" />
              <span className="truncate font-medium text-fg">{folder}</span>
            </>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="w-52">
            <Input
              placeholder="Search files…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              icon={<Search className="size-3.5" />}
              className="h-8 text-xs"
            />
          </div>
          <button
            onClick={() => setQuery('')}
            aria-label="Refresh listing"
            className="rounded-lg border border-ink-700 p-2 text-fg-subtle transition-colors hover:border-ink-600 hover:text-fg"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* listing */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <EmptyState
            icon={<Folder className="size-5" />}
            title="Nothing here"
            description={
              emptyHint ??
              `No ${onlyEncrypted ? 'encrypted ' : ''}files found in this ${provider.name} location.`
            }
          />
        ) : (
          <ul className="divide-y divide-ink-800">
            {files.map((file) => {
              const selected = selectedIds.includes(file.id)
              const isFolder = file.kind === 'folder'
              return (
                <li key={file.id}>
                  <button
                    type="button"
                    onClick={() => toggle(file)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      selected ? 'bg-brand-500/[0.08]' : 'hover:bg-ink-850',
                    )}
                  >
                    {selectable && !isFolder ? (
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center border transition-colors',
                          selectionMode === 'single' ? 'rounded-full' : 'rounded',
                          selected
                            ? 'border-brand-500 bg-brand-500'
                            : 'border-ink-600 bg-ink-900',
                        )}
                      >
                        {selected ? (
                          <span className="size-1.5 rounded-full bg-ink-950" />
                        ) : null}
                      </span>
                    ) : (
                      <span className="size-4 shrink-0" />
                    )}

                    {isFolder ? (
                      <Folder className="size-4 shrink-0 text-fg-subtle" />
                    ) : file.encrypted ? (
                      <FileLock2 className="size-4 shrink-0 text-brand-400" />
                    ) : (
                      <FileText className="size-4 shrink-0 text-fg-subtle" />
                    )}

                    <span className="min-w-0 flex-1 truncate text-sm text-fg">
                      {file.name}
                    </span>

                    {file.encrypted ? (
                      <Badge tone="brand" className="shrink-0">
                        .hce
                      </Badge>
                    ) : null}

                    <span className="w-20 shrink-0 text-right text-xs text-fg-subtle">
                      {isFolder ? '—' : formatBytes(file.sizeBytes)}
                    </span>
                    <span className="w-24 shrink-0 text-right text-xs text-fg-subtle">
                      {timeAgo(file.modifiedAt)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {selectable ? (
        <div className="border-t border-ink-700 bg-ink-850 px-4 py-2.5 text-xs text-fg-muted">
          {selectedIds.length === 0
            ? selectionMode === 'single'
              ? 'Select one encrypted file to continue.'
              : 'Select one or more files.'
            : `${selectedIds.length} file${selectedIds.length > 1 ? 's' : ''} selected`}
        </div>
      ) : null}
    </div>
  )
}
