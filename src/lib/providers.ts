import { api, ApiRequestError } from './api'
import type { CloudProvider, ConnectedAccount, ProviderId } from './types'

/** Visual-only metadata the server has no reason to know about. */
const PROVIDER_META: Record<ProviderId, { blurb: string; accent: string; maxFileBytes: number | null }> = {
  gdrive: { blurb: 'Primary storage target', accent: '#4285f4', maxFileBytes: null },
  github: { blurb: 'Repo + release assets', accent: '#a78bfa', maxFileBytes: 100 * 1024 ** 2 },
  dropbox: { blurb: 'Team folder sync', accent: '#0061ff', maxFileBytes: null },
  onedrive: { blurb: 'Microsoft 365 account', accent: '#22d3ee', maxFileBytes: null },
  mega: { blurb: 'Community SDK — experimental', accent: '#f87171', maxFileBytes: null },
}

interface ApiProvider {
  id: ProviderId
  name: string
  available: boolean
  accounts: ConnectedAccount[]
}

export async function fetchProviders(): Promise<CloudProvider[]> {
  const { providers } = await api.get<{ providers: ApiProvider[] }>('/providers')
  return providers.map((p) => ({
    id: p.id,
    name: p.name,
    blurb: p.available ? PROVIDER_META[p.id].blurb : 'Not available yet',
    connected: p.accounts.length > 0,
    accounts: p.accounts,
    usedBytes: null,
    totalBytes: null,
    maxFileBytes: PROVIDER_META[p.id].maxFileBytes,
    accent: PROVIDER_META[p.id].accent,
  }))
}

/** Full-page redirect — the OAuth flow needs the top-level browsing context. */
export function startGoogleDriveConnect(): void {
  window.location.href = '/api/providers/google/connect'
}

export async function disconnectGoogleDrive(accountId: string): Promise<void> {
  await api.delete(`/providers/google/${accountId}`)
}

export function startGithubConnect(): void {
  window.location.href = '/api/providers/github/connect'
}

export async function disconnectGithub(accountId: string): Promise<void> {
  await api.delete(`/providers/github/${accountId}`)
}

export interface DriveFileSummary {
  id: string
  name: string
  sizeBytes: number
  modifiedAt: string
  mimeType: string
  encrypted: boolean
  webViewLink: string | null
}

/**
 * Streams a file's raw (still-encrypted) bytes back from Drive through the
 * server relay — the browser never talks to Google directly, since the OAuth
 * tokens live server-side only.
 */
export async function downloadFromGoogleDrive(args: {
  accountId: string
  fileId: string
}): Promise<Blob> {
  const qs = new URLSearchParams({ accountId: args.accountId })
  const response = await fetch(
    `/api/providers/google/files/${encodeURIComponent(args.fileId)}/download?${qs.toString()}`,
    { credentials: 'include' },
  )

  if (!response.ok) {
    let message = `Download failed with status ${response.status}`
    try {
      const body = (await response.json()) as { error?: { message?: string } }
      message = body?.error?.message ?? message
    } catch {
      // Non-JSON error body (e.g. the connection dropped mid-stream) — the
      // generic status-based message above is the best we can say.
    }
    throw new ApiRequestError(response.status, 'download_failed', message)
  }

  return response.blob()
}

export async function fetchDriveFiles(params: {
  accountId: string
  search?: string
  onlyEncrypted?: boolean
}): Promise<{ files: DriveFileSummary[]; nextPageToken: string | null }> {
  const qs = new URLSearchParams({ accountId: params.accountId })
  if (params.search?.trim()) qs.set('search', params.search.trim())
  if (params.onlyEncrypted) qs.set('onlyEncrypted', '1')
  return api.get(`/providers/google/files?${qs.toString()}`)
}

export async function downloadFromGithub(args: {
  accountId: string
  fileId: string
}): Promise<Blob> {
  const qs = new URLSearchParams({ accountId: args.accountId })
  const response = await fetch(
    `/api/providers/github/files/${encodeURIComponent(args.fileId)}/download?${qs.toString()}`,
    { credentials: 'include' },
  )

  if (!response.ok) {
    let message = `Download failed with status ${response.status}`
    try {
      const body = (await response.json()) as { error?: { message?: string } }
      message = body?.error?.message ?? message
    } catch {
      // Non-JSON error body — the generic status-based message stands.
    }
    throw new ApiRequestError(response.status, 'download_failed', message)
  }

  return response.blob()
}

export async function fetchGithubFiles(params: {
  accountId: string
  search?: string
  onlyEncrypted?: boolean
}): Promise<{ files: DriveFileSummary[]; nextPageToken: string | null }> {
  const qs = new URLSearchParams({ accountId: params.accountId })
  if (params.search?.trim()) qs.set('search', params.search.trim())
  if (params.onlyEncrypted) qs.set('onlyEncrypted', '1')
  return api.get(`/providers/github/files?${qs.toString()}`)
}

export interface ApiVaultFile {
  id: string
  originalName: string
  encryptedName: string
  sizeBytes: number
  mimeType: string
  provider: ProviderId
  providerFileId: string
  providerWebLink: string | null
  owner: string
  ownerName: string
  algorithm: 'AES-256-GCM'
  iv: string
  keyId: string
  status: 'encrypted' | 'decrypted' | 'failed'
  createdAt: string
  updatedAt: string
}

interface UploadArgs {
  accountId: string
  blob: Blob
  encryptedName: string
  originalName: string
  keyId: string
  iv: string
  mimeType: string
  originalSize: number
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

/**
 * Streams an already-encrypted blob to the server via XHR rather than fetch —
 * only XHR exposes upload progress, which the "Encrypt & upload" step shows live.
 */
function uploadEncryptedTo(uploadPath: string, args: UploadArgs): Promise<{ file: ApiVaultFile }> {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams({
      accountId: args.accountId,
      name: args.encryptedName,
      originalName: args.originalName,
      keyId: args.keyId,
      iv: args.iv,
      mimeType: args.mimeType,
      originalSize: String(args.originalSize),
    })

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${uploadPath}?${qs.toString()}`)
    xhr.withCredentials = true
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) args.onProgress?.(Math.round((e.loaded / e.total) * 100))
    }

    xhr.onload = () => {
      let body: unknown = null
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        // Non-JSON body — fall through to the status check below.
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as { file: ApiVaultFile })
        return
      }
      const errBody = body as { error?: { code?: string; message?: string } } | null
      reject(
        new ApiRequestError(
          xhr.status,
          errBody?.error?.code ?? 'error',
          errBody?.error?.message ?? `Upload failed with status ${xhr.status}`,
        ),
      )
    }

    xhr.onerror = () => {
      reject(new ApiRequestError(0, 'network_error', 'Cannot reach the server during upload.'))
    }

    args.signal?.addEventListener('abort', () => xhr.abort())

    xhr.send(args.blob)
  })
}

export function uploadEncryptedToGoogleDrive(args: UploadArgs): Promise<{ file: ApiVaultFile }> {
  return uploadEncryptedTo('/api/providers/google/upload', args)
}

export function uploadEncryptedToGithub(args: UploadArgs): Promise<{ file: ApiVaultFile }> {
  return uploadEncryptedTo('/api/providers/github/upload', args)
}
