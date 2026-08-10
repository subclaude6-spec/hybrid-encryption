import {
  DEFAULT_CHUNK_SIZE,
  FORMAT_VERSION,
  IV_PREFIX_BYTES,
  chunkIv,
  encodeHeader,
  toBase64,
  toEncryptedName,
  type HceHeader,
} from './hce'
import {
  PBKDF2_ITERATIONS,
  computeKeyId,
  deriveAesKey,
  generateKeyString,
  generateSalt,
} from './keys'

export interface CryptoProgress {
  chunk: number
  totalChunks: number
  processedBytes: number
  totalBytes: number
  percent: number
}

export interface EncryptOptions {
  /** Defaults to the File's own name. Required for a bare Blob. */
  originalName?: string
  mimeType?: string
  chunkSize?: number
  /** Reuse a key across a multi-file upload so one key opens the whole batch. */
  keyString?: string
  onProgress?: (progress: CryptoProgress) => void
  signal?: AbortSignal
}

export interface EncryptResult {
  blob: Blob
  encryptedName: string
  /** Show this to the user once, then forget it. The server never sees it. */
  keyString: string
  keyId: string
  header: HceHeader
}

/**
 * Encrypts a file into an .hce envelope, entirely in the browser.
 *
 * The plaintext never leaves this function, and the returned `keyString` is the
 * only thing that can undo it — losing it means the file is unrecoverable.
 */
export async function encryptFile(
  file: Blob,
  options: EncryptOptions = {},
): Promise<EncryptResult> {
  const originalName =
    options.originalName ?? (file instanceof File ? file.name : 'untitled.bin')
  const mimeType = options.mimeType ?? file.type ?? 'application/octet-stream'
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE

  const keyString = options.keyString ?? generateKeyString()
  const salt = generateSalt()
  const key = await deriveAesKey(keyString, salt)
  const keyId = await computeKeyId(keyString, salt)

  const ivPrefix = crypto.getRandomValues(new Uint8Array(IV_PREFIX_BYTES))

  // Always at least one chunk: an empty file still needs an authentication tag,
  // otherwise a wrong key would silently "succeed" on it.
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize))

  const header: HceHeader = {
    version: FORMAT_VERSION,
    originalName,
    mimeType,
    originalSize: file.size,
    algorithm: 'AES-256-GCM',
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: toBase64(salt),
    },
    ivPrefix: toBase64(ivPrefix),
    chunkSize,
    totalChunks,
    keyId,
    createdAt: new Date().toISOString(),
  }

  const parts: BlobPart[] = [encodeHeader(header) as BufferSource]
  let processedBytes = 0

  for (let index = 0; index < totalChunks; index++) {
    options.signal?.throwIfAborted()

    const start = index * chunkSize
    const slice = file.slice(start, Math.min(start + chunkSize, file.size))
    const plaintext = await slice.arrayBuffer()

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: chunkIv(ivPrefix, index) as BufferSource },
      key,
      plaintext,
    )

    parts.push(ciphertext)
    processedBytes += plaintext.byteLength

    options.onProgress?.({
      chunk: index + 1,
      totalChunks,
      processedBytes,
      totalBytes: file.size,
      percent: Math.round(((index + 1) / totalChunks) * 100),
    })
  }

  return {
    blob: new Blob(parts, { type: 'application/octet-stream' }),
    encryptedName: toEncryptedName(originalName),
    keyString,
    keyId,
    header,
  }
}
