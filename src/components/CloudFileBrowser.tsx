import { useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  FileLock2,
  FileText,
  Folder,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react'
import type { CloudFile, ProviderId } from '@/lib/types'
import { CLOUD_FILES, providerById } from '@/lib/mock-data'
import { type DriveFileSummary, fetchDriveFiles, fetchGithubFiles } from '@/lib/providers'
import { ApiRequestError } from '@/lib/api'
import { cn, formatBytes, timeAgo } from '@/lib/utils'
import { Badge, EmptyState, Input } from './ui/primitives'
import { ProviderIcon } from './domain'

function driveFileToCloudFile(providerId: ProviderId, file: DriveFileSummary): CloudFile {
  return {
    id: file.id,
    name: file.name,
    sizeBytes: file.sizeBytes,
    modifiedAt: file.modifiedAt,
    kind: 'file',
    providerId,
    encrypted: file.encrypted,
  }
}

export function CloudFileBrowser({
  providerId,
  accountId,
  repo,
  selectable = false,
  selectionMode = 'multiple',
  onlyEncrypted = false,
  selectedIds = [],
  onSelectionChange,
  emptyHint,
}: {
  providerId: ProviderId
  /** Which of the user's connected accounts to browse. Required once the
   *  provider is live (gdrive, github) — ignored for the still-mocked providers. */
  accountId?: string | null
  /** Which repo to browse — GitHub only, required once accountId is set. */
  repo?: string | null
  selectable?: boolean
  selectionMode?: 'single' | 'multiple'
  onlyEncrypted?: boolean
  selectedIds?: string[]
  /** `files` is the full metadata for whatever `ids` now contains — callers
   *  that need more than the id (name, size) don't have to re-fetch it. */
  onSelectionChange?: (ids: string[], files: CloudFile[]) => void
  emptyHint?: string
}) {
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState<string | null>(null)
  const provider = providerById(providerId)
  const isLive =
    (providerId === 'gdrive' && Boolean(accountId)) ||
    (providerId === 'github' && Boolean(accountId) && Boolean(repo))

  const [driveFiles, setDriveFiles] = useState<CloudFile[]>([])
  const [loading, setLoading] = useState(isLive)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    if (!isLive || !accountId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    // Debounced — a query fires a request per keystroke otherwise.
    const timer = setTimeout(() => {
      const fetchFn =
        providerId === 'github'
          ? () => fetchGithubFiles({ accountId, repo: repo!, search: query, onlyEncrypted })
          : () => fetchDriveFiles({ accountId, search: query, onlyEncrypted })
      fetchFn()
        .then(({ files: result }) => {
          if (cancelled) return
          setDriveFiles(result.map((f) => driveFileToCloudFile(providerId, f)))
        })
        .catch((err) => {
          if (cancelled) return
          setLoadError(
            err instanceof ApiRequestError ? err.message : `Could not load ${provider.name} files.`,
          )
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isLive, providerId, accountId, repo, onlyEncrypted, query, refreshTick])

  const files = useMemo(() => {
    let list: CloudFile[] = isLive ? driveFiles : CLOUD_FILES[providerId] ?? []
    if (!isLive) {
      if (onlyEncrypted) list = list.filter((f) => f.kind === 'folder' || f.encrypted)
      if (query.trim()) {
        const q = query.toLowerCase()
        list = list.filter((f) => f.name.toLowerCase().includes(q))
      }
    }
    return [...list].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [isLive, driveFiles, providerId, onlyEncrypted, query])

  function toggle(file: CloudFile) {
    if (file.kind === 'folder') {
      setFolder(file.name)
      return
    }
    if (!selectable || !onSelectionChange) return
    if (selectionMode === 'single') {
      const nowSelected = selectedIds.includes(file.id) ? [] : [file.id]
      onSelectionChange(nowSelected, nowSelected.length ? [file] : [])
      return
    }
    const nowSelected = selectedIds.includes(file.id)
      ? selectedIds.filter((id) => id !== file.id)
      : [...selectedIds, file.id]
    onSelectionChange(
      nowSelected,
      files.filter((f) => nowSelected.includes(f.id)),
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
            onClick={() => (isLive ? setRefreshTick((t) => t + 1) : setQuery(''))}
            aria-label="Refresh listing"
            className="rounded-lg border border-ink-700 p-2 text-fg-subtle transition-colors hover:border-ink-600 hover:text-fg"
          >
            <RefreshCw className={cn('size-3.5', isLive && loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* listing */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLive && loading && files.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-fg-muted">
            <Loader2 className="size-4 animate-spin" />
            Loading {provider.name}…
          </div>
        ) : isLive && loadError ? (
          <EmptyState
            icon={<Folder className="size-5" />}
            title={`Couldn't load ${provider.name}`}
            description={loadError}
          />
        ) : files.length === 0 ? (
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
                          <span className="size-1.5 rounded-full bg-ink-onbrand" />
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
