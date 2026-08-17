import { useEffect, useState } from 'react'
import { AlertTriangle, Check, FolderGit2, Loader2, Lock, Plus } from 'lucide-react'
import { ApiRequestError } from '@/lib/api'
import { createGithubRepo, fetchGithubRepos, type GithubRepoSummary } from '@/lib/providers'
import { cn, timeAgo } from '@/lib/utils'
import { Modal } from './ui/Modal'
import { Button, Input } from './ui/primitives'

/**
 * GitHub has no single "the" storage location the way Drive does — files
 * live in whichever repo the user picks. This lists the repos on the
 * connected account and lets them create a fresh one instead.
 */
export function RepoPicker({
  open,
  onClose,
  accountId,
  selectedRepo,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  accountId: string | null
  selectedRepo: string | null
  onSelect: (repo: string) => void
}) {
  const [repos, setRepos] = useState<GithubRepoSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !accountId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    fetchGithubRepos(accountId)
      .then((result) => {
        if (!cancelled) setRepos(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiRequestError ? err.message : 'Could not load your repositories.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, accountId])

  // Reset the create-new sub-form each time the modal opens fresh.
  useEffect(() => {
    if (open) {
      setCreating(false)
      setNewName('')
      setCreateError(null)
    }
  }, [open])

  async function submitCreate() {
    if (!accountId || !newName.trim()) return
    setSubmitting(true)
    setCreateError(null)
    try {
      const repo = await createGithubRepo(accountId, newName.trim())
      setRepos((prev) => [repo, ...prev])
      // The caller's onSelect is responsible for closing the modal — it also
      // has to update other state (e.g. advancing a step) in the same tick,
      // and calling onClose here too would race that with a stale closure.
      onSelect(repo.name)
    } catch (err) {
      setCreateError(
        err instanceof ApiRequestError ? err.message : 'Could not create that repository.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose a GitHub repository"
      subtitle="Encrypted files are committed here. Pick an existing repo or create a new one."
      icon={<FolderGit2 className="size-5" />}
      size="sm"
    >
      {creating ? (
        <div className="space-y-4">
          <Input
            label="Repository name"
            name="repoName"
            placeholder="hybrid-cloud-encryption-vault"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim() && !submitting) submitCreate()
            }}
            error={createError ?? undefined}
            hint={createError ? undefined : 'Created as private on your GitHub account.'}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={submitting}>
              Back
            </Button>
            <Button loading={submitting} disabled={!newName.trim()} onClick={submitCreate}>
              Create repository
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-fg-muted">
              <Loader2 className="size-4 animate-spin" />
              Loading your repositories…
            </div>
          ) : loadError ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/[0.07] px-3.5 py-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
              <p className="text-xs leading-relaxed text-danger">{loadError}</p>
            </div>
          ) : repos.length === 0 ? (
            <p className="px-1 py-2 text-xs text-fg-muted">
              No repositories on this account yet — create one to get started.
            </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {repos.map((repo) => {
                const selected = repo.name === selectedRepo
                return (
                  <button
                    key={repo.name}
                    type="button"
                    onClick={() => onSelect(repo.name)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                      selected
                        ? 'border-brand-500/50 bg-brand-500/[0.07]'
                        : 'border-ink-700 bg-ink-850 hover:border-ink-600',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full border',
                        selected
                          ? 'border-brand-500/40 bg-brand-500/15 text-brand-400'
                          : 'border-ink-700 bg-ink-900 text-fg-subtle',
                      )}
                    >
                      {selected ? (
                        <Check className="size-4" strokeWidth={3} />
                      ) : (
                        <FolderGit2 className="size-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-fg">{repo.name}</span>
                        {repo.private ? <Lock className="size-3 shrink-0 text-fg-subtle" /> : null}
                      </span>
                      <span className="block text-[11px] text-fg-subtle">
                        Updated {timeAgo(repo.updatedAt)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-ink-700 p-3 text-left text-fg-muted transition-colors hover:border-ink-600 hover:bg-ink-850 hover:text-fg"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-ink-700 bg-ink-900">
              <Plus className="size-4" />
            </span>
            <span className="text-sm font-medium">Create a new repository</span>
          </button>
        </div>
      )}
    </Modal>
  )
}
