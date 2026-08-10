/**
 * Key material for the .hce format.
 *
 * The user-facing key is 20 characters of Crockford-style base32 — 100 bits of
 * entropy, which is far beyond brute-force reach while still being short enough
 * to paste out of an email. It is NOT used as the AES key directly: the real
 * 256-bit key is derived from it with PBKDF2 and a per-file random salt, so two
 * files encrypted with the same key string still get different AES keys.
 *
 * Nothing here is ever sent to the server. The server stores `keyId` (a one-way
 * reference) and, later, a copy of the key wrapped to the admin's public key —
 * never the key string itself.
 */

/** Excludes I, O, 0 and 1 so a key can be read aloud or retyped without ambiguity. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const KEY_CHARS = 20
const GROUP_SIZE = 5

export const PBKDF2_ITERATIONS = 210_000
export const SALT_BYTES = 16

export class InvalidKeyError extends Error {
  constructor(message = 'That does not look like a valid decryption key') {
    super(message)
    this.name = 'InvalidKeyError'
  }
}

/**
 * Generates a fresh key string, e.g. `HCE-4KDQ2-M7XPL-99TRV-BN3WZ`.
 *
 * 256 is an exact multiple of 32, so masking a random byte with 31 yields a
 * uniform index — no modulo bias to correct for.
 */
export function generateKeyString(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(KEY_CHARS))
  let chars = ''
  for (const byte of bytes) chars += ALPHABET[byte & 31]
  return formatKeyString(chars)
}

/** Adds the `HCE-` prefix and dash grouping to 20 raw characters. */
export function formatKeyString(raw: string): string {
  const groups: string[] = []
  for (let i = 0; i < raw.length; i += GROUP_SIZE) {
    groups.push(raw.slice(i, i + GROUP_SIZE))
  }
  return `HCE-${groups.join('-')}`
}

/**
 * Strips formatting and validates. Accepts lowercase, missing dashes, missing
 * prefix, and stray whitespace — people paste keys out of emails in every
 * possible shape.
 */
export function normalizeKeyString(input: string): string {
  const cleaned = input
    .trim()
    .toUpperCase()
    .replace(/^HCE[-\s]*/, '')
    .replace(/[-\s]/g, '')

  if (cleaned.length !== KEY_CHARS) {
    throw new InvalidKeyError(
      `Key must be ${KEY_CHARS} characters — got ${cleaned.length}. Check for a truncated paste.`,
    )
  }
  for (const char of cleaned) {
    if (!ALPHABET.includes(char)) {
      throw new InvalidKeyError(
        `"${char}" is not a valid key character. Note that I, O, 0 and 1 are never used — did you mean 1 → L, 0 → O?`,
      )
    }
  }
  return cleaned
}

/** True when the input is a well-formed key. Does not prove it's the right one. */
export function isValidKeyString(input: string): boolean {
  try {
    normalizeKeyString(input)
    return true
  } catch {
    return false
  }
}

/** Derives the AES-256-GCM key. Deliberately slow — that's PBKDF2 doing its job. */
export async function deriveAesKey(
  keyString: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const normalized = normalizeKeyString(keyString)

  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(normalized),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: the raw key cannot be read back out
    ['encrypt', 'decrypt'],
  )
}

/**
 * A short public reference for a key, safe to store server-side and show in the
 * UI. One-way: the salt and the SHA-256 mean it cannot be turned back into the
 * key, so a database dump never yields anything decryptable.
 */
export async function computeKeyId(keyString: string, salt: Uint8Array): Promise<string> {
  const normalized = normalizeKeyString(keyString)
  const material = new Uint8Array(salt.length + normalized.length)
  material.set(salt, 0)
  material.set(new TextEncoder().encode(normalized), salt.length)

  const digest = await crypto.subtle.digest('SHA-256', material as BufferSource)
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hex.slice(0, 16)
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES))
}
