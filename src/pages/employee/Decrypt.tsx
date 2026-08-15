import { useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CloudDownload,
  Download,
  FileLock2,
  KeyRound,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { useToast } from '@/components/ui/Toast'
import { PageBody, PageHeader } from '@/components/layout/AppShell'
import { Badge, Button, Card, CardHeader, Input } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { CloudProviderPicker } from '@/components/CloudProviderPicker'
import { CloudFileBrowser } from '@/components/CloudFileBrowser'
import { GoogleAccountPicker } from '@/components/GoogleAccountPicker'
import { LocalFileDrop } from '@/components/LocalFileDrop'
import { ProviderIcon } from '@/components/domain'
import { providerById } from '@/lib/mock-data'
import { ApiRequestError } from '@/lib/api'
import { CorruptFileError, decryptFile, WrongKeyError } from '@/lib/crypto'
import { downloadFromGoogleDrive } from '@/lib/providers'
import type { CloudFile, ProviderId } from '@/lib/types'
import { cn, formatBytes } from '@/lib/utils'

type Mode = 'choose' | 'upload' | 'fetch'

export default function Decrypt() {
  const { providers, visibleVaultFiles, recordDecryption, connectProvider, disconnectProvider } =
    useApp()
  const toast = useToast()

  const [mode, setMode] = useState<Mode>('choose')
  const [localFiles, setLocalFiles] = useState<File[]>([])
  const [providerId, setProviderId] = useState<ProviderId | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [cloudSelection, setCloudSelection] = useState<string[]>([])
  const [cloudSelectionFiles, setCloudSelectionFiles] = useState<CloudFile[]>([])

  const provider = providerId ? providers.find((p) => p.id === providerId) ?? null : null

  const [keyOpen, setKeyOpen] = useState(false)
  const [keyValue, setKeyValue] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [workingStage, setWorkingStage] = useState<'download' | 'decrypt' | null>(null)
  const [result, setResult] = useState<{ name: string; blob: Blob } | null>(null)
  const [locked, setLocked] = useState(false)

  const myFiles = visibleVaultFiles()

  const selectedName =
    mode === 'upload' ? localFiles[0]?.name : cloudSelectionFiles[0]?.name

  function openKeyPrompt() {
    setKeyValue('')
    setKeyError(null)
    setKeyOpen(true)
  }

  /**
   * Real end-to-end decryption: the source bytes come from the actual .hce
   * envelope (downloaded from Drive through the server relay, or read
   * straight off the local file the user dropped), and AES-GCM's own
   * authentication tag — not a key-string comparison — is what proves the
   * key is right. A wrong key throws `WrongKeyError`; nothing "succeeds"
   * silently with the wrong plaintext.
   */
  async function submitKey() {
    if (!selectedName) return
    setWorking(true)
    setKeyError(null)

    try {
      let envelope: Blob
      if (mode === 'upload' && localFiles[0]) {
        envelope = localFiles[0]
      } else if (mode === 'fetch' && cloudSelection[0] && accountId) {
        setWorkingStage('download')
        envelope = await downloadFromGoogleDrive({ accountId, fileId: cloudSelection[0] })
      } else {
        throw new Error('No file selected.')
      }

      setWorkingStage('decrypt')
      const decrypted = await decryptFile(envelope, keyValue)

      recordDecryption({
        fileName: decrypted.originalName,
        providerId: mode === 'fetch' ? providerId : null,
        success: true,
        attempt: attempts,
      })

      setResult({ name: decrypted.originalName, blob: decrypted.blob })
      setWorking(false)
      setWorkingStage(null)
      setKeyOpen(false)
      setAttempts(0)
      toast({
        tone: 'success',
        title: 'File decrypted',
        description: `${decrypted.originalName} is ready to download.`,
      })
    } catch (err) {
      setWorking(false)
      setWorkingStage(null)

      if (err instanceof WrongKeyError) {
        const next = attempts + 1
        setAttempts(next)
        recordDecryption({
          fileName: selectedName,
          providerId: mode === 'fetch' ? providerId : null,
          success: false,
          attempt: next,
        })

        if (next >= 3) {
          setLocked(true)
          setKeyOpen(false)
          toast({
            tone: 'error',
            title: 'Too many invalid keys',
            description: 'Your administrator has been alerted and can revoke your access.',
          })
          return
        }

        setKeyError(`Invalid decryption key — attempt ${next} of 3.`)
        return
      }

      // Corrupt/incomplete file or a download failure — not a key problem,
      // so it doesn't count against the 3-attempt lockout.
      const message =
        err instanceof CorruptFileError
          ? err.message
          : err instanceof ApiRequestError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Decryption failed.'
      setKeyError(message)
    }
  }

  function download() {
    if (!result) return
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.name
    a.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setMode('choose')
    setLocalFiles([])
    setProviderId(null)
    setAccountId(null)
    setCloudSelection([])
    setCloudSelectionFiles([])
    setResult(null)
    setAttempts(0)
    setLocked(false)
    setKeyError(null)
  }

  /* ------------------------------------------------------------------ locked */

  if (locked) {
    return (
      <>
        <PageHeader title="Decrypt" subtitle="Access temporarily blocked" />
        <PageBody>
          <Card className="animate-in-up mx-auto max-w-lg p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-danger/30 bg-danger/10">
              <ShieldAlert className="size-7 text-danger" />
            </div>
            <h2 className="mt-5 text-lg font-semibold tracking-tight text-fg">
              Three invalid keys — admin notified
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
              An alert email has gone to your administrator with the file name, your
              account and this device. They can revoke your credentials from their
              dashboard, or clear the flag if this was a mistake.
            </p>
            <Button variant="outline" className="mt-6" onClick={reset}>
              Back to decrypt
            </Button>
          </Card>
        </PageBody>
      </>
    )
  }

  /* ------------------------------------------------------------------ result */

  if (result) {
    return (
      <>
        <PageHeader title="Decrypt" subtitle="File unlocked" />
        <PageBody>
          <Card className="animate-in-up mx-auto max-w-lg p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-ok/30 bg-ok/10">
              <ShieldCheck className="size-7 text-ok" />
            </div>
            <h2 className="mt-5 text-lg font-semibold tracking-tight text-fg">
              Decryption successful
            </h2>
            <p className="mt-2 text-sm text-fg-muted">
              The authentication tag verified — the file is intact and unmodified.
            </p>
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-left">
              <FileLock2 className="size-4 shrink-0 text-ok" />
              <span className="min-w-0 flex-1 truncate text-sm text-fg">{result.name}</span>
              <span className="shrink-0 text-xs text-fg-subtle">
                {formatBytes(result.blob.size)}
              </span>
            </div>
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button icon={<Download className="size-4" />} onClick={download}>
                Download file
              </Button>
              <Button variant="ghost" onClick={reset}>
                Decrypt another
              </Button>
            </div>
          </Card>
        </PageBody>
      </>
    )
  }

  /* ------------------------------------------------------------------- flows */

  return (
    <>
      <PageHeader
        title="Decrypt"
        subtitle="Unlock a .hce file with the key issued when it was encrypted."
        actions={
          mode !== 'choose' ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="size-3.5" />}
              onClick={reset}
            >
              Back
            </Button>
          ) : null
        }
      />

      <PageBody className="space-y-6">
        {mode === 'choose' ? (
          <div className="animate-in-up mx-auto max-w-3xl">
            <h2 className="text-sm font-semibold text-fg">
              Where is the encrypted file?
            </h2>
            <p className="mt-1 text-xs text-fg-muted">
              Both paths end the same way — you paste your key, we verify it, you download
              the plaintext.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ModeCard
                icon={<UploadCloud className="size-5" />}
                title="Upload"
                detail="I already have the .hce file on this PC — I downloaded it from the cloud or someone sent it to me."
                onClick={() => setMode('upload')}
              />
              <ModeCard
                icon={<CloudDownload className="size-5" />}
                title="Fetch"
                detail="Browse my connected cloud accounts from inside the app and pick the encrypted file there."
                tone="violet"
                onClick={() => setMode('fetch')}
              />
            </div>

            {myFiles.length > 0 ? (
              <Card className="mt-6">
                <CardHeader
                  title="Your encrypted files"
                  subtitle="Key references are listed under My files"
                  icon={<FileLock2 className="size-4" />}
                />
                <ul className="divide-y divide-ink-800">
                  {myFiles.slice(0, 4).map((file) => (
                    <li key={file.id} className="flex items-center gap-3 px-5 py-3">
                      <ProviderIcon id={file.providerId} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm text-fg">
                        {file.encryptedName}
                      </span>
                      <Badge tone="neutral">{formatBytes(file.sizeBytes)}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        ) : null}

        {/* upload path */}
        {mode === 'upload' ? (
          <div className="animate-in-up mx-auto max-w-2xl space-y-4">
            <LocalFileDrop
              files={localFiles}
              onChange={setLocalFiles}
              multiple={false}
              accept=".hce"
              title="Upload the encrypted file"
              hint="Only .hce envelopes produced by this app can be decrypted here."
            />

            {localFiles[0] && !localFiles[0].name.endsWith('.hce') ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-warn/25 bg-warn/[0.07] px-4 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
                <p className="text-xs leading-relaxed text-warn">
                  {localFiles[0].name} is not a .hce envelope. It has no encryption header,
                  so there is nothing to unlock.
                </p>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                size="lg"
                disabled={!localFiles[0]?.name.endsWith('.hce')}
                icon={<KeyRound className="size-4" />}
                onClick={openKeyPrompt}
              >
                Enter decryption key
              </Button>
            </div>
          </div>
        ) : null}

        {/* fetch path */}
        {mode === 'fetch' ? (
          <div className="animate-in-up space-y-4">
            {!providerId || (providerId === 'gdrive' && !accountId) ? (
              <>
                <div>
                  <h2 className="text-sm font-semibold text-fg">
                    Which cloud account holds the file?
                  </h2>
                  <p className="mt-1 text-xs text-fg-muted">
                    The provider opens inside this app — you never leave the desktop
                    window.
                  </p>
                </div>
                <CloudProviderPicker
                  providers={providers}
                  value={providerId}
                  onSelect={(id) => {
                    setProviderId(id)
                    const target = providers.find((p) => p.id === id)
                    if (id === 'gdrive' && (target?.accounts.length ?? 0) > 0) {
                      setAccountModalOpen(true)
                    }
                  }}
                  onConnect={(id) => {
                    try {
                      connectProvider(id)
                    } catch (err) {
                      toast({
                        tone: 'error',
                        title: 'Not available yet',
                        description: err instanceof Error ? err.message : undefined,
                      })
                    }
                  }}
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <ProviderIcon id={providerId} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">
                      {providerById(providerId).name}
                    </p>
                    {providerId === 'gdrive' ? (
                      <p className="truncate text-[11px] text-fg-subtle">
                        {provider?.accounts.find((a) => a.id === accountId)?.email}
                      </p>
                    ) : null}
                  </div>
                  {providerId === 'gdrive' && (provider?.accounts.length ?? 0) > 0 ? (
                    <Button variant="ghost" size="sm" onClick={() => setAccountModalOpen(true)}>
                      Change account
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setProviderId(null)
                      setAccountId(null)
                      setCloudSelection([])
                      setCloudSelectionFiles([])
                    }}
                  >
                    Change provider
                  </Button>
                </div>

                <div className="h-[26rem]">
                  <CloudFileBrowser
                    providerId={providerId}
                    accountId={accountId}
                    selectable
                    selectionMode="single"
                    onlyEncrypted
                    selectedIds={cloudSelection}
                    onSelectionChange={(ids, files) => {
                      setCloudSelection(ids)
                      setCloudSelectionFiles(files)
                    }}
                    emptyHint="No .hce files in this account yet. Encrypt something first."
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-fg-muted">
                    {selectedName ? `Selected: ${selectedName}` : 'Pick one encrypted file.'}
                  </p>
                  <Button
                    size="lg"
                    disabled={cloudSelection.length === 0}
                    icon={<KeyRound className="size-4" />}
                    onClick={openKeyPrompt}
                  >
                    OK — enter key
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </PageBody>

      <GoogleAccountPicker
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        accounts={provider?.accounts ?? []}
        selectedId={accountId}
        onSelect={setAccountId}
        onConnectAnother={() => {
          setAccountModalOpen(false)
          connectProvider('gdrive')
        }}
        onDisconnect={async (id) => {
          setDisconnectingId(id)
          try {
            await disconnectProvider('gdrive', id)
            if (accountId === id) setAccountId(null)
            toast({ tone: 'info', title: 'Google Drive account disconnected' })
          } catch (err) {
            toast({
              tone: 'error',
              title: 'Could not disconnect',
              description: err instanceof Error ? err.message : undefined,
            })
          } finally {
            setDisconnectingId(null)
          }
        }}
        disconnectingId={disconnectingId}
      />

      {/* key prompt */}
      <Modal
        open={keyOpen}
        onClose={() => setKeyOpen(false)}
        title="Enter decryption key"
        subtitle={selectedName}
        icon={<KeyRound className="size-5" />}
        size="sm"
        dismissable={!working}
        footer={
          <>
            <Button variant="ghost" onClick={() => setKeyOpen(false)} disabled={working}>
              Cancel
            </Button>
            <Button loading={working} disabled={!keyValue.trim()} onClick={submitKey}>
              {working ? 'Verifying…' : 'Submit'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Decryption key"
            name="key"
            placeholder="HCE-XXXXX-XXXXX-XXXXX-XXXXX"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && keyValue.trim() && !working) submitKey()
            }}
            error={keyError ?? undefined}
            hint={keyError ? undefined : 'Paste the key from the email you received.'}
            className="font-mono tracking-wide"
            autoFocus
          />

          {working ? (
            <div className="flex items-center gap-2 text-xs text-fg-muted">
              <Loader2 className="size-3.5 animate-spin" />
              {workingStage === 'download'
                ? 'Downloading the encrypted file from Google Drive…'
                : 'Deriving the key and verifying the authentication tag…'}
            </div>
          ) : null}

          {attempts > 0 && !working ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/[0.07] px-3.5 py-3">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
              <p className="text-xs leading-relaxed text-danger">
                {3 - attempts} attempt{3 - attempts === 1 ? '' : 's'} left. After three
                failures your administrator is alerted by email and can revoke your access.
              </p>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  )
}

function ModeCard({
  icon,
  title,
  detail,
  onClick,
  tone = 'brand',
}: {
  icon: React.ReactNode
  title: string
  detail: string
  onClick: () => void
  tone?: 'brand' | 'violet'
}) {
  const tones = {
    brand: 'bg-brand-500/12 text-brand-400 border-brand-500/25',
    violet: 'bg-violet/12 text-violet border-violet/25',
  }
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-4 rounded-xl2 border border-ink-700 bg-ink-850 p-5 text-left transition-all duration-200 hover:border-ink-600 hover:bg-ink-800"
    >
      <span
        className={cn(
          'flex size-11 items-center justify-center rounded-xl border',
          tones[tone],
        )}
      >
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="mt-1.5 block text-xs leading-relaxed text-fg-muted">{detail}</span>
      </span>
    </button>
  )
}
