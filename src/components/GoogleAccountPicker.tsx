import { Check, Mail, Plus, Trash2 } from 'lucide-react'
import type { ConnectedAccount } from '@/lib/types'
import { cn, timeAgo } from '@/lib/utils'
import { Modal } from './ui/Modal'
import { Button } from './ui/primitives'

/**
 * Lets someone pick which of their linked Google Drive accounts to use for
 * an upload or a fetch — the login email and the Drive account are
 * deliberately independent, so this always shows every connected account
 * rather than silently assuming "the one I logged in with".
 */
export function GoogleAccountPicker({
  open,
  onClose,
  accounts,
  selectedId,
  onSelect,
  onConnectAnother,
  onDisconnect,
  disconnectingId,
}: {
  open: boolean
  onClose: () => void
  accounts: ConnectedAccount[]
  selectedId: string | null
  onSelect: (accountId: string) => void
  onConnectAnother: () => void
  onDisconnect?: (accountId: string) => void
  disconnectingId?: string | null
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose a Google Drive account"
      subtitle="Files go to whichever account you pick here — it doesn't have to match your login email."
      icon={<Mail className="size-5" />}
      size="sm"
    >
      <div className="space-y-2">
        {accounts.map((account) => {
          const selected = account.id === selectedId
          return (
            <div
              key={account.id}
              className={cn(
                'group flex items-center gap-3 rounded-xl border p-3 transition-colors',
                selected
                  ? 'border-brand-500/50 bg-brand-500/[0.07]'
                  : 'border-ink-700 bg-ink-850 hover:border-ink-600',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(account.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border',
                    selected
                      ? 'border-brand-500/40 bg-brand-500/15 text-brand-400'
                      : 'border-ink-700 bg-ink-900 text-fg-subtle',
                  )}
                >
                  {selected ? <Check className="size-4" strokeWidth={3} /> : <Mail className="size-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-fg">
                    {account.email}
                  </span>
                  <span className="block text-[11px] text-fg-subtle">
                    Connected {timeAgo(account.connectedAt)}
                  </span>
                </span>
              </button>
              {onDisconnect ? (
                <button
                  type="button"
                  onClick={() => onDisconnect(account.id)}
                  disabled={disconnectingId === account.id}
                  aria-label={`Disconnect ${account.email}`}
                  className="shrink-0 rounded-lg p-1.5 text-fg-subtle opacity-0 transition-colors hover:bg-danger/10 hover:text-danger group-hover:opacity-100 disabled:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </div>
          )
        })}

        <button
          type="button"
          onClick={onConnectAnother}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-ink-700 p-3 text-left text-fg-muted transition-colors hover:border-ink-600 hover:bg-ink-850 hover:text-fg"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-ink-700 bg-ink-900">
            <Plus className="size-4" />
          </span>
          <span className="text-sm font-medium">Connect another Google account</span>
        </button>
      </div>

      {selectedId ? (
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={onClose}>
            Use this account
          </Button>
        </div>
      ) : null}
    </Modal>
  )
}
