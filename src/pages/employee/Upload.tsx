import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  FileLock2,
  Loader2,
  Mail,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { useToast } from '@/components/ui/Toast'
import { PageBody, PageHeader } from '@/components/layout/AppShell'
import { Badge, Button, Card, CardHeader, Progress } from '@/components/ui/primitives'
import { CloudProviderPicker } from '@/components/CloudProviderPicker'
import { CloudFileBrowser } from '@/components/CloudFileBrowser'
import { LocalFileDrop } from '@/components/LocalFileDrop'
import { ProviderIcon } from '@/components/domain'
import type { ProviderId } from '@/lib/types'
import { cn, formatBytes, sleep } from '@/lib/utils'
import { providerById } from '@/lib/mock-data'

const STEPS = ['Destination', 'Select files', 'Encrypt & upload', 'Key delivery']

type FileProgress = { name: string; percent: number; done: boolean }

export default function Upload() {
  const { providers, currentUser, recordEncryption, connectProvider } = useApp()
  const toast = useToast()

  const [step, setStep] = useState(0)
  const [providerId, setProviderId] = useState<ProviderId | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [progress, setProgress] = useState<FileProgress[]>([])
  const [issuedKey, setIssuedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const provider = providerId ? providerById(providerId) : null

  const oversized = useMemo(() => {
    if (!provider?.maxFileBytes) return []
    return files.filter((f) => f.size > provider.maxFileBytes!)
  }, [files, provider])

  async function runEncryption() {
    if (!providerId || files.length === 0) return
    setStep(2)
    setProgress(files.map((f) => ({ name: f.name, percent: 0, done: false })))

    for (let i = 0; i < files.length; i++) {
      for (let p = 0; p <= 100; p += 10) {
        await sleep(55)
        setProgress((prev) =>
          prev.map((row, idx) => (idx === i ? { ...row, percent: p } : row)),
        )
      }
      setProgress((prev) =>
        prev.map((row, idx) => (idx === i ? { ...row, percent: 100, done: true } : row)),
      )
    }

    const { key } = recordEncryption({
      fileNames: files.map((f) => f.name),
      sizes: files.map((f) => f.size),
      providerId,
    })
    setIssuedKey(key)
    await sleep(400)
    setStep(3)
    toast({
      tone: 'success',
      title: 'Upload complete',
      description: `${files.length} file${files.length > 1 ? 's' : ''} encrypted and stored on ${providerById(providerId).name}.`,
    })
  }

  function reset() {
    setStep(0)
    setProviderId(null)
    setFiles([])
    setProgress([])
    setIssuedKey(null)
    setCopied(false)
  }

  async function copyKey() {
    if (!issuedKey) return
    await navigator.clipboard.writeText(issuedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0)

  return (
    <>
      <PageHeader
        title="Encrypt & upload"
        subtitle="Files are sealed with AES-256-GCM on this machine — the provider only ever receives ciphertext."
        actions={
          step > 0 && step < 2 ? (
            <Button variant="ghost" size="sm" onClick={reset}>
              Start over
            </Button>
          ) : null
        }
      />

      <PageBody className="space-y-6">
        <Stepper current={step} />

        {/* step 1 — destination */}
        {step === 0 ? (
          <div className="animate-in-up space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-fg">
                Where should the encrypted files go?
              </h2>
              <p className="mt-1 text-xs text-fg-muted">
                Connect a provider once; the app stores only an OAuth token, never your
                password.
              </p>
            </div>

            <CloudProviderPicker
              providers={providers}
              value={providerId}
              onSelect={(id) => {
                setProviderId(id)
                setStep(1)
              }}
              onConnect={(id) => {
                connectProvider(id, currentUser?.email ?? 'account@company.io')
                toast({
                  tone: 'success',
                  title: `${providerById(id).name} connected`,
                  description: 'OAuth token stored in the OS credential vault.',
                })
              }}
            />
          </div>
        ) : null}

        {/* step 2 — pick files */}
        {step === 1 && provider ? (
          <div className="animate-in-up grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <ProviderIcon id={provider.id} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">
                      Uploading to {provider.name}
                    </p>
                    <p className="truncate text-xs text-fg-muted">{provider.account}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
                    Change
                  </Button>
                </div>
              </Card>

              <LocalFileDrop files={files} onChange={setFiles} />

              {oversized.length > 0 ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-warn/25 bg-warn/[0.07] px-4 py-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
                  <div className="text-xs leading-relaxed text-warn">
                    <p className="font-medium">
                      {oversized.length} file{oversized.length > 1 ? 's exceed' : ' exceeds'}{' '}
                      {provider.name}&rsquo;s {formatBytes(provider.maxFileBytes!)} limit
                    </p>
                    <p className="mt-0.5 text-warn/80">
                      {oversized.map((f) => f.name).join(', ')} — these will be rejected by
                      the provider. Split them or pick a different destination.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-fg-muted">
                  {files.length > 0
                    ? `${files.length} file${files.length > 1 ? 's' : ''} · ${formatBytes(totalBytes)}`
                    : 'No files selected yet'}
                </p>
                <Button
                  size="lg"
                  disabled={files.length === 0}
                  icon={<ShieldCheck className="size-4" />}
                  onClick={runEncryption}
                >
                  Encrypt {files.length || ''} & upload
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex min-h-[26rem] flex-col">
              <p className="mb-2 text-xs font-medium text-fg-muted">
                Current contents of {provider.name}
              </p>
              <div className="min-h-0 flex-1">
                <CloudFileBrowser providerId={provider.id} />
              </div>
            </div>
          </div>
        ) : null}

        {/* step 3 — encrypting */}
        {step === 2 ? (
          <Card className="animate-in-up mx-auto max-w-2xl">
            <CardHeader
              title="Encrypting and uploading"
              subtitle="Each file gets its own 256-bit data key. Nothing leaves in plaintext."
              icon={<Loader2 className="size-4 animate-spin" />}
            />
            <ul className="divide-y divide-ink-800">
              {progress.map((row) => (
                <li key={row.name} className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <FileLock2
                      className={cn(
                        'size-4 shrink-0',
                        row.done ? 'text-ok' : 'text-fg-subtle',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-fg">
                      {row.name}
                    </span>
                    {row.done ? (
                      <Badge tone="ok" icon={<Check className="size-3" />}>
                        Sealed
                      </Badge>
                    ) : (
                      <span className="text-xs tabular-nums text-fg-subtle">
                        {row.percent}%
                      </span>
                    )}
                  </div>
                  <Progress
                    className="mt-2.5"
                    value={row.percent}
                    tone={row.done ? 'ok' : 'brand'}
                  />
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {/* step 4 — key delivery */}
        {step === 3 && issuedKey && provider ? (
          <div className="animate-in-up mx-auto max-w-2xl space-y-4">
            <Card className="p-6 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-ok/30 bg-ok/10">
                <Check className="size-7 text-ok" strokeWidth={2.5} />
              </div>
              <h2 className="mt-5 text-lg font-semibold tracking-tight text-fg">
                {files.length} file{files.length > 1 ? 's' : ''} encrypted and uploaded
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg-muted">
                Stored on {provider.name} as ciphertext. Without the key below, the file is
                unreadable — including to the provider.
              </p>
            </Card>

            <Card>
              <CardHeader
                title="Decryption key"
                subtitle="Needed to unlock these files later"
                icon={<FileLock2 className="size-4" />}
              />
              <div className="p-5">
                <div className="flex items-center gap-3 rounded-xl border border-brand-500/25 bg-brand-500/[0.06] px-4 py-3.5">
                  <code className="min-w-0 flex-1 select-all font-mono text-sm tracking-wide text-brand-400">
                    {issuedKey}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    onClick={copyKey}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>

                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3">
                  <Mail className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                  <div className="text-xs leading-relaxed text-fg-muted">
                    <p className="font-medium text-fg">Key delivered by email</p>
                    <p className="mt-1">
                      Sent to <span className="text-fg">{currentUser?.email}</span> and{' '}
                      <span className="text-fg">arjun@company.io</span> (administrator).
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-warn/25 bg-warn/[0.07] px-4 py-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
                  <p className="text-xs leading-relaxed text-warn">
                    Anyone holding this key can read the file. In the production build the
                    email carries a one-time link instead of the key itself, and the real
                    key stays wrapped to your passkey.
                  </p>
                </div>
              </div>
            </Card>

            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" icon={<UploadCloud className="size-4" />} onClick={reset}>
                Encrypt more files
              </Button>
              <Link to="/app/history">
                <Button variant="ghost">View my files</Button>
              </Link>
            </div>
          </div>
        ) : null}
      </PageBody>
    </>
  )
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const done = current > i
        const active = current === i
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors',
                done
                  ? 'border-ok/40 bg-ok/15 text-ok'
                  : active
                    ? 'border-brand-500/40 bg-brand-500/15 text-brand-400'
                    : 'border-ink-700 bg-ink-850 text-fg-subtle',
              )}
            >
              {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={cn(
                'whitespace-nowrap text-xs font-medium transition-colors',
                active ? 'text-fg' : done ? 'text-fg-muted' : 'text-fg-subtle',
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 ? (
              <span
                className={cn(
                  'h-px flex-1 transition-colors',
                  done ? 'bg-ok/40' : 'bg-ink-700',
                )}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
