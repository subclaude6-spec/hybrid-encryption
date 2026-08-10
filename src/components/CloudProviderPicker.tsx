import { Check, Lock, Plug } from 'lucide-react'
import type { CloudProvider, ProviderId } from '@/lib/types'
import { cn, formatBytes } from '@/lib/utils'
import { Badge, Progress } from './ui/primitives'
import { ProviderIcon } from './domain'

export function CloudProviderPicker({
  providers,
  value,
  onSelect,
  onConnect,
}: {
  providers: CloudProvider[]
  value: ProviderId | null
  onSelect: (id: ProviderId) => void
  onConnect?: (id: ProviderId) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {providers.map((provider) => {
        const selected = value === provider.id
        const disabled = !provider.connected

        return (
          <button
            key={provider.id}
            type="button"
            onClick={() =>
              disabled ? onConnect?.(provider.id) : onSelect(provider.id)
            }
            className={cn(
              'group relative flex flex-col gap-3 rounded-xl2 border p-4 text-left transition-all duration-200',
              selected
                ? 'border-brand-500/50 bg-brand-500/[0.07] ring-brand-glow'
                : 'border-ink-700 bg-ink-850 hover:border-ink-600 hover:bg-ink-800',
              disabled && 'opacity-70',
            )}
          >
            {selected ? (
              <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-brand-500 text-ink-950">
                <Check className="size-3" strokeWidth={3} />
              </span>
            ) : null}

            <div className="flex items-center gap-3">
              <ProviderIcon id={provider.id} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">{provider.name}</p>
                <p className="truncate text-[11px] text-fg-muted">
                  {provider.connected ? provider.account : provider.blurb}
                </p>
              </div>
            </div>

            {provider.connected ? (
              provider.usedBytes != null && provider.totalBytes != null ? (
                <div>
                  <Progress value={(provider.usedBytes / provider.totalBytes) * 100} />
                  <p className="mt-1.5 text-[11px] text-fg-subtle">
                    {formatBytes(provider.usedBytes)} of {formatBytes(provider.totalBytes)}{' '}
                    used
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge tone="violet">No quota reported</Badge>
                  {provider.maxFileBytes ? (
                    <span className="text-[11px] text-warn">
                      {formatBytes(provider.maxFileBytes)} file cap
                    </span>
                  ) : null}
                </div>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-400">
                <Plug className="size-3" />
                Click to connect account
              </span>
            )}
          </button>
        )
      })}

      <div className="flex items-center gap-2.5 rounded-xl2 border border-dashed border-ink-700 p-4 text-[11px] leading-relaxed text-fg-subtle">
        <Lock className="size-4 shrink-0 text-fg-subtle" />
        <span>
          Files are encrypted on this device before upload. Providers only ever store
          ciphertext.
        </span>
      </div>
    </div>
  )
}
