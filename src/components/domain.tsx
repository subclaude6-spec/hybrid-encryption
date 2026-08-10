import {
  Box,
  Cloud,
  CloudLightning,
  Github,
  HardDrive,
  KeyRound,
  LogIn,
  LogOut,
  Link2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  UserPlus,
  Fingerprint,
} from 'lucide-react'
import type { LogAction, LogStatus, ProviderId, UserStatus, VaultStatus } from '@/lib/types'
import { providerById } from '@/lib/mock-data'
import { Badge } from './ui/primitives'
import { cn } from '@/lib/utils'

const PROVIDER_ICONS: Record<ProviderId, typeof Cloud> = {
  gdrive: HardDrive,
  github: Github,
  dropbox: Box,
  onedrive: Cloud,
  mega: CloudLightning,
}

export function ProviderIcon({
  id,
  size = 'md',
  className,
}: {
  id: ProviderId
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const Icon = PROVIDER_ICONS[id]
  const provider = providerById(id)
  const boxes = { sm: 'size-7 rounded-lg', md: 'size-10 rounded-xl', lg: 'size-14 rounded-xl2' }
  const icons = { sm: 'size-3.5', md: 'size-5', lg: 'size-7' }
  return (
    <span
      className={cn('inline-flex items-center justify-center border', boxes[size], className)}
      style={{
        backgroundColor: `${provider.accent}1f`,
        borderColor: `${provider.accent}40`,
        color: provider.accent,
      }}
    >
      <Icon className={icons[size]} />
    </span>
  )
}

export function ProviderName({ id }: { id: ProviderId | null }) {
  if (!id) return <span className="text-fg-subtle">—</span>
  return <span>{providerById(id).name}</span>
}

/* --------------------------------------------------------------- status badges */

export function UserStatusBadge({ status }: { status: UserStatus }) {
  if (status === 'active') return <Badge tone="ok">Active</Badge>
  if (status === 'suspended') return <Badge tone="danger">Suspended</Badge>
  return <Badge tone="warn">Pending approval</Badge>
}

export function VaultStatusBadge({ status }: { status: VaultStatus }) {
  if (status === 'encrypted')
    return (
      <Badge tone="brand" icon={<ShieldCheck className="size-3" />}>
        Encrypted
      </Badge>
    )
  if (status === 'decrypted')
    return (
      <Badge tone="ok" icon={<ShieldCheck className="size-3" />}>
        Decrypted
      </Badge>
    )
  return (
    <Badge tone="danger" icon={<ShieldX className="size-3" />}>
      Failed
    </Badge>
  )
}

export function LogStatusDot({ status }: { status: LogStatus }) {
  const colors: Record<LogStatus, string> = {
    success: 'bg-ok',
    failed: 'bg-danger',
    warning: 'bg-warn',
  }
  return <span className={cn('inline-block size-1.5 shrink-0 rounded-full', colors[status])} />
}

const ACTION_META: Record<LogAction, { label: string; icon: typeof Cloud }> = {
  login: { label: 'Sign in', icon: LogIn },
  login_failed: { label: 'Sign-in failed', icon: ShieldX },
  logout: { label: 'Sign out', icon: LogOut },
  passkey_enrolled: { label: 'Passkey enrolled', icon: Fingerprint },
  encrypt_upload: { label: 'Encrypt & upload', icon: ShieldCheck },
  decrypt_success: { label: 'Decrypt', icon: KeyRound },
  decrypt_failed: { label: 'Decrypt failed', icon: ShieldAlert },
  key_issued: { label: 'Key issued', icon: KeyRound },
  provider_connected: { label: 'Provider linked', icon: Link2 },
  access_revoked: { label: 'Access revoked', icon: ShieldX },
  account_created: { label: 'Account change', icon: UserPlus },
}

export function ActionLabel({ action }: { action: LogAction }) {
  const meta = ACTION_META[action]
  const Icon = meta.icon
  return (
    <span className="inline-flex items-center gap-2 text-fg">
      <Icon className="size-3.5 shrink-0 text-fg-subtle" />
      {meta.label}
    </span>
  )
}

export const actionLabel = (action: LogAction) => ACTION_META[action].label
