import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  FileLock2,
  History,
  KeyRound,
  ScrollText,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageBody, PageHeader } from '@/components/layout/AppShell'
import { Badge, Card, CardHeader, EmptyState, StatTile } from '@/components/ui/primitives'
import { ActionLabel, LogStatusDot, ProviderIcon, VaultStatusBadge } from '@/components/domain'
import { formatBytes, timeAgo } from '@/lib/utils'

const ACTIONS = [
  {
    to: '/app/upload',
    title: 'Encrypt & upload',
    detail: 'Pick a cloud target, choose files, encrypt them here before they leave.',
    icon: UploadCloud,
    tone: 'brand' as const,
  },
  {
    to: '/app/decrypt',
    title: 'Decrypt',
    detail: 'Upload a .hce file or fetch one from the cloud, then unlock it with your key.',
    icon: KeyRound,
    tone: 'violet' as const,
  },
  {
    to: '/app/history',
    title: 'My files',
    detail: 'Every file you have encrypted, where it lives, and its key reference.',
    icon: History,
    tone: 'ok' as const,
  },
  {
    to: '/app/logs',
    title: 'My activity',
    detail: 'Your own sign-ins, uploads and decrypt attempts. Only yours.',
    icon: ScrollText,
    tone: 'warn' as const,
  },
]

const TONES = {
  brand: 'bg-brand-500/12 text-brand-400 border-brand-500/25',
  violet: 'bg-violet/12 text-violet border-violet/25',
  ok: 'bg-ok/12 text-ok border-ok/25',
  warn: 'bg-warn/12 text-warn border-warn/25',
}

export default function Dashboard() {
  const { currentUser, visibleVaultFiles, visibleLogs } = useApp()
  const files = visibleVaultFiles()
  const logs = visibleLogs()

  const encrypted = files.filter((f) => f.status === 'encrypted').length
  const totalBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0)
  const failedAttempts = logs.filter((l) => l.action === 'decrypt_failed').length

  return (
    <>
      <PageHeader
        title={`Welcome back, ${currentUser?.name.split(' ')[0]}`}
        subtitle="Your files are encrypted on this device before they reach any cloud provider."
        badge={
          <Badge tone="ok" icon={<ShieldCheck className="size-3" />}>
            Session verified
          </Badge>
        }
      />

      <PageBody className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Files encrypted"
            value={files.length}
            icon={<FileLock2 className="size-4" />}
            hint={`${encrypted} currently sealed`}
          />
          <StatTile
            label="Data protected"
            value={formatBytes(totalBytes)}
            icon={<ShieldCheck className="size-4" />}
            tone="ok"
            hint="AES-256-GCM"
          />
          <StatTile
            label="Activity events"
            value={logs.length}
            icon={<ScrollText className="size-4" />}
            tone="violet"
            hint="Visible to you and admin"
          />
          <StatTile
            label="Failed key attempts"
            value={failedAttempts}
            icon={<KeyRound className="size-4" />}
            tone={failedAttempts > 0 ? 'danger' : 'brand'}
            hint="3 failures alerts your admin"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ACTIONS.map(({ to, title, detail, icon: Icon, tone }) => (
            <Link key={to} to={to}>
              <Card interactive className="group h-full p-5">
                <div className="flex items-start gap-4">
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${TONES[tone]}`}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-fg">{title}</h3>
                      <ArrowUpRight className="size-3.5 text-fg-subtle transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-400" />
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{detail}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader
              title="Recent files"
              subtitle="Your most recently encrypted uploads"
              icon={<FileLock2 className="size-4" />}
              action={
                <Link
                  to="/app/history"
                  className="text-xs text-fg-muted transition-colors hover:text-brand-400"
                >
                  View all
                </Link>
              }
            />
            {files.length === 0 ? (
              <EmptyState
                icon={<FileLock2 className="size-5" />}
                title="No files yet"
                description="Encrypt your first file and it will show up here with its storage location."
              />
            ) : (
              <ul className="divide-y divide-ink-800">
                {files.slice(0, 5).map((file) => (
                  <li key={file.id} className="flex items-center gap-3 px-5 py-3">
                    <ProviderIcon id={file.providerId} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-fg">{file.encryptedName}</p>
                      <p className="truncate text-[11px] text-fg-subtle">
                        {formatBytes(file.sizeBytes)} · {timeAgo(file.createdAt)}
                      </p>
                    </div>
                    <VaultStatusBadge status={file.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Recent activity"
              subtitle="Scoped to your account only"
              icon={<ScrollText className="size-4" />}
              action={
                <Link
                  to="/app/logs"
                  className="text-xs text-fg-muted transition-colors hover:text-brand-400"
                >
                  View all
                </Link>
              }
            />
            {logs.length === 0 ? (
              <EmptyState
                icon={<ScrollText className="size-5" />}
                title="Nothing logged yet"
                description="Sign-ins, uploads and decrypt attempts will appear here."
              />
            ) : (
              <ul className="divide-y divide-ink-800">
                {logs.slice(0, 5).map((log) => (
                  <li key={log.id} className="flex items-start gap-3 px-5 py-3">
                    <LogStatusDot status={log.status} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">
                        <ActionLabel action={log.action} />
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
            )}
          </Card>
        </div>
      </PageBody>
    </>
  )
}
