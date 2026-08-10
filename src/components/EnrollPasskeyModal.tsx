import { useState } from 'react'
import { AlertTriangle, Check, Fingerprint, Loader2, ShieldCheck } from 'lucide-react'
import { PasskeyError, registerPasskey, type RegisterResult } from '@/lib/auth'
import { Button, Input } from './ui/primitives'
import { Modal } from './ui/Modal'

type Step = 'details' | 'ceremony' | 'done'

export function EnrollPasskeyModal({
  open,
  onClose,
  onEnrolled,
}: {
  open: boolean
  onClose: () => void
  onEnrolled?: (email: string) => void
}) {
  const [step, setStep] = useState<Step>('details')
  const [email, setEmail] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RegisterResult | null>(null)

  function close() {
    onClose()
    // Reset after the exit transition so the content doesn't visibly flash.
    setTimeout(() => {
      setStep('details')
      setEmail('')
      setLabel('')
      setError(null)
      setResult(null)
    }, 200)
  }

  async function enroll() {
    setStep('ceremony')
    setError(null)
    try {
      const enrolled = await registerPasskey(email.trim(), label.trim() || undefined)
      setResult(enrolled)
      setStep('done')
      onEnrolled?.(email.trim())
    } catch (err) {
      setError(
        err instanceof PasskeyError || err instanceof Error
          ? err.message
          : 'Could not create the passkey.',
      )
      setStep('details')
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Set up a passkey"
      subtitle="Replaces your password entirely — nothing to remember or leak"
      icon={<ShieldCheck className="size-5" />}
      dismissable={step !== 'ceremony'}
      footer={
        step === 'details' ? (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button disabled={!email.trim()} onClick={enroll}>
              Create passkey
            </Button>
          </>
        ) : step === 'done' ? (
          <Button onClick={close}>Done</Button>
        ) : null
      }
    >
      {step === 'details' ? (
        <div className="space-y-4">
          <Input
            label="Work email"
            name="email"
            type="email"
            placeholder="you@company.io"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && email.trim()) enroll()
            }}
            hint="Must match an account your administrator has already provisioned."
            error={error ?? undefined}
            autoFocus
          />
          <Input
            label="Device name (optional)"
            name="label"
            placeholder="Work laptop"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            hint="Shown in your security log so you can spot unfamiliar devices."
          />
          <div className="rounded-xl border border-ink-700 bg-ink-900 p-3.5 text-xs leading-relaxed text-fg-muted">
            Your browser will ask how to create the passkey — this device&rsquo;s
            fingerprint or face sensor, your phone via a QR code, or a hardware security
            key. All three work.
          </div>
        </div>
      ) : null}

      {step === 'ceremony' ? (
        <div className="py-6 text-center">
          <div className="relative mx-auto flex size-24 items-center justify-center overflow-hidden rounded-full border border-brand-500/30 bg-brand-500/[0.07]">
            <Fingerprint className="size-11 text-brand-400" strokeWidth={1.4} />
            <span className="scan-line absolute inset-x-0 h-px bg-brand-400 shadow-[0_0_12px_2px] shadow-brand-400/70" />
          </div>
          <p className="mt-6 text-sm font-medium text-fg">
            Follow your browser&rsquo;s prompt
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-fg-subtle">
            <Loader2 className="size-3.5 animate-spin" />
            Creating key pair on your device…
          </div>
        </div>
      ) : null}

      {step === 'done' && result ? (
        <div className="py-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-ok/30 bg-ok/10">
            <Check className="size-7 text-ok" strokeWidth={2.5} />
          </div>
          <h3 className="mt-5 text-base font-semibold text-fg">Passkey created</h3>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-fg-muted">
            The private key is stored in your device&rsquo;s secure hardware and never
            leaves it. Only the public key reached the server — there is no password or
            biometric template anywhere to steal.
          </p>

          {!result.canSignIn ? (
            <div className="mx-auto mt-5 flex max-w-sm items-start gap-2.5 rounded-xl border border-warn/25 bg-warn/[0.07] px-3.5 py-3 text-left">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
              <p className="text-xs leading-relaxed text-warn">{result.message}</p>
            </div>
          ) : (
            <div className="mx-auto mt-5 max-w-xs rounded-xl border border-ink-700 bg-ink-900 p-3 text-left">
              <p className="text-[11px] text-fg-subtle">Registered to</p>
              <p className="mt-0.5 truncate text-sm text-fg">{result.user.email}</p>
              <p className="mt-2 text-[11px] text-fg-subtle">Device</p>
              <p className="mt-0.5 truncate text-sm text-fg">
                {result.user.passkeys.at(-1)?.label ?? 'This device'}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  )
}
