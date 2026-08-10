import {
  CorruptFileError,
  GCM_TAG_BYTES,
  WrongKeyError,
  chunkIv,
  decodeHeader,
  fromBase64,
  type HceHeader,
} from './hce'
import { deriveAesKey } from './keys'
import type { CryptoProgress } from './encrypt'

/** Generous enough for any realistic filename; headers are a few hundred bytes. */
const HEADER_PROBE_BYTES = 64 * 1024

export interface DecryptOptions {
  onProgress?: (progress: CryptoProgress) => void
  signal?: AbortSignal
}

export interface DecryptResult {
  blob: Blob
  header: HceHeader
  originalName: string
}

/** Reads just the header — cheap enough to call before prompting for a key. */
export async function readHeader(file: Blob): Promise<HceHeader> {
  const probe = new Uint8Array(
    await file.slice(0, Math.min(HEADER_PROBE_BYTES, file.size)).arrayBuffer(),
  )
  return decodeHeader(probe).header
}

/**
 * Decrypts an .hce envelope.
 *
 * Correctness is enforced by AES-GCM's authentication tag, not by comparing key
 * strings: a wrong key, a flipped bit, or a truncated download all fail the tag
 * and throw. There is no path that returns silently-wrong plaintext.
 */
export async function decryptFile(
  file: Blob,
  keyString: string,
  options: DecryptOptions = {},
): Promise<DecryptResult> {
  const probe = new Uint8Array(
    await file.slice(0, Math.min(HEADER_PROBE_BYTES, file.size)).arrayBuffer(),
  )
  const { header, payloadOffset } = decodeHeader(probe)

  const salt = fromBase64(header.kdf.salt)
  const ivPrefix = fromBase64(header.ivPrefix)
  // Trust the file's own iteration count, not our current default — otherwise
  // files written by an older build would stop opening.
  const key = await deriveAesKey(keyString, salt, header.kdf.iterations)

  const encryptedChunkSize = header.chunkSize + GCM_TAG_BYTES
  const parts: BlobPart[] = []
  let processedBytes = 0

  for (let index = 0; index < header.totalChunks; index++) {
    options.signal?.throwIfAborted()

    const start = payloadOffset + index * encryptedChunkSize
    const end = Math.min(start + encryptedChunkSize, file.size)

    if (start >= file.size) {
      throw new CorruptFileError(
        `File ends after ${index} of ${header.totalChunks} chunks — the download is incomplete.`,
      )
    }

    const ciphertext = await file.slice(start, end).arrayBuffer()

    let plaintext: ArrayBuffer
    try {
      plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: chunkIv(ivPrefix, index) as BufferSource },
        key,
        ciphertext,
      )
    } catch {
      // Web Crypto deliberately gives no detail here — a distinguishable error
      // would leak whether the key was close. Treat every failure the same.
      throw new WrongKeyError()
    }

    parts.push(plaintext)
    processedBytes += plaintext.byteLength

    options.onProgress?.({
      chunk: index + 1,
      totalChunks: header.totalChunks,
      processedBytes,
      totalBytes: header.originalSize,
      percent: Math.round(((index + 1) / header.totalChunks) * 100),
    })
  }

  const blob = new Blob(parts, { type: header.mimeType })

  if (blob.size !== header.originalSize) {
    throw new CorruptFileError(
      `Recovered ${blob.size} bytes but the header claims ${header.originalSize}.`,
    )
  }

  return { blob, header, originalName: header.originalName }
}
