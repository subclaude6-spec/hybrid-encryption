import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  Info,
  Mail,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { useToast } from '@/components/ui/Toast'
import { PageBody, PageHeader } from '@/components/layout/AppShell'
import { Badge, Button, Card, EmptyState } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/primitives'
import type { SecurityAlert } from '@/lib/types'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'

const SEVERITY = {
  critical: {
    label: 'Critical',
    tone: 'danger' as const,
    ring: 'border-danger/30',
    icon: AlertTriangle,
    color: 'text-danger bg-danger/10 border-danger/25',
  },
  warning: {
    label: 'Warning',
    tone: 'warn' as const,
    ring: 'border-warn/30',
    icon: AlertTriangle,
    color: 'text-warn bg-warn/10 border-warn/25',
  },
  info: {
    label: 'Info',
    tone: 'brand' as const,
    ring: 'border-brand-500/30',
    icon: Info,
    color: 'text-brand-400 bg-brand-500/10 border-brand-500/25',
  },
}

export default function Alerts() {
  const { alerts, resolveAlert, setUserStatus, users } = useApp()
  const toast = useToast()
  const [revoking, setRevoking] = useState<SecurityAlert | null>(null)

  const open = alerts.filter((a) => !a.resolved)
  const resolved = alerts.filter((a) => a.resolved)

  function confirmRevoke() {
    if (!revoking) return
    setUserStatus(revoking.userId, 'suspended')
    resolveAlert(revoking.id)
    toast({
      tone: 'warning',
      title: `${revoking.userName}'s access revoked`,
      description: 'Their passkeys will be rejected at the next sign-in attempt.',
    })
    setRevoking(null)
  }

  function dismiss(alert: SecurityAlert) {
    resolveAlert(alert.id)
    toast({ tone: 'info', title: 'Alert cleared', description: alert.title })
  }

  return (
    <>
      <PageHeader
        title="Security alerts"
        subtitle="Failed decryption attempts, unknown devices, and accounts awaiting approval."
        badge={
          open.length > 0 ? (
            <Badge tone="danger">{open.length} open</Badge>
          ) : (
            <Badge tone="ok" icon={<ShieldCheck className="size-3" />}>
              All clear
            </Badge>
          )
        }
      />

      <PageBody className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-fg">Open</h2>
          {open.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ShieldCheck className="size-5" />}
                title="No open alerts"
                description="When someone submits three invalid keys or signs in from an unknown device, it lands here."
              />
            </Card>
          ) : (
            open.map((alert) => {
              const meta = SEVERITY[alert.severity]
              const Icon = meta.icon
              const user = users.find((u) => u.id === alert.userId)
              const alreadySuspended = user?.status === 'suspended'

              return (
                <Card key={alert.id} className={cn('p-5', meta.ring)}>
                  <div className="flex items-start gap-4">
                    <span
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-xl border',
                        meta.color,
                      )}
                    >
                      <Icon className="size-5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-fg">{alert.title}</h3>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        {alert.attempts ? (
                          <Badge tone="neutral">{alert.attempts} attempts</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
                        {alert.detail}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-fg-subtle">
                        <span className="flex items-center gap-1.5">
                          <Avatar name={alert.userName} size="sm" tone="neutral" />
                          {alert.userName}
                        </span>
                        <span>{formatDateTime(alert.at)}</span>
                        <span>{timeAgo(alert.at)}</span>
                        <span className="flex items-center gap-1.5">
                          <Mail className="size-3" />
                          Email sent to admin
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {alreadySuspended ? (
                          <Badge tone="danger" icon={<ShieldX className="size-3" />}>
                            Access already revoked
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="danger"
                            icon={<ShieldX className="size-3.5" />}
                            onClick={() => setRevoking(alert)}
                          >
                            Revoke {alert.userName.split(' ')[0]}&rsquo;s access
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<Check className="size-3.5" />}
                          onClick={() => dismiss(alert)}
                        >
                          Mark as reviewed
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })
          )}
        </section>

        {resolved.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-fg">Resolved</h2>
            {resolved.map((alert) => (
              <Card key={alert.id} className="p-4 opacity-70">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-ok/25 bg-ok/10 text-ok">
                    <Check className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-fg">{alert.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-fg-muted">
                      {alert.detail}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-fg-subtle">
                    {timeAgo(alert.at)}
                  </span>
                </div>
              </Card>
            ))}
          </section>
        ) : null}
      </PageBody>

      <Modal
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title="Revoke access?"
        icon={<ShieldX className="size-5" />}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevoking(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmRevoke}>
              Revoke access
            </Button>
          </>
        }
      >
        {revoking ? (
          <p className="text-xs leading-relaxed text-fg-muted">
            <span className="text-fg">{revoking.userName}</span> will be signed out
            immediately and their passkeys rejected at the next attempt. Files they already
            encrypted stay in the cloud as ciphertext — this only removes their ability to
            decrypt through the app. You can restore access from the Employees page.
          </p>
        ) : null}
      </Modal>
    </>
  )
}
