/**
 * The `.hce` container format.
 *
 *   ┌──────────┬──────────────┬──────────────────┬─────────────────────────┐
 *   │ "HCE1"   │ headerLen    │ header (JSON)    │ encrypted chunks        │
 *   │ 4 bytes  │ uint32 BE    │ headerLen bytes  │ rest of file            │
 *   └──────────┴──────────────┴──────────────────┴─────────────────────────┘
 *
 * The header is plaintext by design. It holds the original filename, the KDF
 * salt and the chunk layout — all things a decryptor needs *before* it has a
 * key. None of it reveals file contents. If a filename is itself sensitive,
 * rename before uploading; the header is metadata, not a secret.
 *
 * Why chunks: Web Crypto's AES-GCM is one-shot — it has no streaming interface,
 * so a naive implementation must hold the whole file and its ciphertext in
 * memory at once. Encrypting in 4 MiB chunks keeps memory flat regardless of
 * file size, and each chunk carries its own GCM authentication tag.
 */

export const MAGIC = 'HCE1'
export const MAGIC_BYTES = new TextEncoder().encode(MAGIC)
export const FORMAT_VERSION = 1

/** Plaintext bytes per chunk. Each encrypted chunk is this + 16 tag bytes. */
export const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024

export const GCM_TAG_BYTES = 16
export const IV_BYTES = 12
/** 8 random bytes + a 4-byte counter, so no IV is ever reused under one key. */
export const IV_PREFIX_BYTES = 8

export interface HceHeader {
  version: number
  originalName: string
  mimeType: string
  originalSize: number
  algorithm: 'AES-256-GCM'
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    /** base64 */
    salt: string
  }
  /** base64, 8 bytes — the per-chunk IV is this plus a big-endian counter. */
  ivPrefix: string
  chunkSize: number
  totalChunks: number
  /** One-way reference to the key. Never the key itself. */
  keyId: string
  createdAt: string
}

export class CorruptFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CorruptFileError'
  }
}

export class WrongKeyError extends Error {
  constructor(
    message = 'Decryption failed — the key is wrong, or the file has been altered.',
  ) {
    super(message)
    this.name = 'WrongKeyError'
  }
}

/* ------------------------------------------------------------------ base64 */

/** Chunked to avoid blowing the call stack on large inputs. */
export function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/* ------------------------------------------------------------------ header */

export function encodeHeader(header: HceHeader): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(header))
  const out = new Uint8Array(MAGIC_BYTES.length + 4 + json.length)

  out.set(MAGIC_BYTES, 0)
  new DataView(out.buffer).setUint32(MAGIC_BYTES.length, json.length, false)
  out.set(json, MAGIC_BYTES.length + 4)

  return out
}

export interface ParsedHeader {
  header: HceHeader
  /** Byte offset where the encrypted chunks begin. */
  payloadOffset: number
}

/** Reads and validates the header from the first bytes of an .hce file. */
export function decodeHeader(bytes: Uint8Array): ParsedHeader {
  if (bytes.length < MAGIC_BYTES.length + 4) {
    throw new CorruptFileError('File is too short to be an .hce envelope.')
  }

  for (let i = 0; i < MAGIC_BYTES.length; i++) {
    if (bytes[i] !== MAGIC_BYTES[i]) {
      throw new CorruptFileError(
        'Not an .hce file — the format marker is missing. Was this encrypted by a different tool?',
      )
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const headerLength = view.getUint32(MAGIC_BYTES.length, false)
  const headerStart = MAGIC_BYTES.length + 4
  const headerEnd = headerStart + headerLength

  if (headerLength === 0 || headerEnd > bytes.length) {
    throw new CorruptFileError('Header is truncated — the file is incomplete.')
  }

  let header: HceHeader
  try {
    header = JSON.parse(new TextDecoder().decode(bytes.subarray(headerStart, headerEnd)))
  } catch {
    throw new CorruptFileError('Header is not readable — the file is damaged.')
  }

  if (header.version !== FORMAT_VERSION) {
    throw new CorruptFileError(
      `Unsupported .hce version ${header.version}. This build reads version ${FORMAT_VERSION}.`,
    )
  }
  if (header.algorithm !== 'AES-256-GCM') {
    throw new CorruptFileError(`Unsupported algorithm "${header.algorithm}".`)
  }

  return { header, payloadOffset: headerEnd }
}

/** Per-chunk IV: 8 random bytes shared across the file, then a chunk counter. */
export function chunkIv(prefix: Uint8Array, index: number): Uint8Array {
  const iv = new Uint8Array(IV_BYTES)
  iv.set(prefix.subarray(0, IV_PREFIX_BYTES), 0)
  new DataView(iv.buffer).setUint32(IV_PREFIX_BYTES, index, false)
  return iv
}

/** Swaps any extension for `.hce`; adds one if there wasn't an extension. */
export function toEncryptedName(originalName: string): string {
  const base = originalName.replace(/\.[^./\\]+$/, '')
  return `${base || originalName}.hce`
}
