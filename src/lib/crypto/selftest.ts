/**
 * Self-test for the crypto layer. Uses only Web APIs, so it runs unchanged in
 * the browser console or under Node:
 *
 *   cd server && npx tsx ../src/lib/crypto/selftest.ts
 */
import { decryptFile, readHeader } from './decrypt'
import { encryptFile } from './encrypt'
import { CorruptFileError, WrongKeyError } from './hce'
import { InvalidKeyError, generateKeyString, normalizeKeyString } from './keys'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function expectThrows(name: string, fn: () => Promise<unknown>, type: Function) {
  try {
    await fn()
    check(name, false, 'expected a throw, got success')
  } catch (error) {
    check(name, error instanceof type, `threw ${(error as Error).name} instead`)
  }
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length)
  // getRandomValues caps at 65536 bytes per call.
  for (let i = 0; i < length; i += 65536) {
    crypto.getRandomValues(out.subarray(i, Math.min(i + 65536, length)))
  }
  return out
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

async function main() {
  console.log('\nKey handling')
  const key = generateKeyString()
  check('generated key matches HCE-XXXXX-XXXXX-XXXXX-XXXXX', /^HCE(-[A-Z2-9]{5}){4}$/.test(key), key)
  check('no ambiguous characters (I O 0 1)', !/[IO01]/.test(key.replace('HCE-', '')), key)

  const raw = normalizeKeyString(key)
  check('lowercase input normalizes', normalizeKeyString(key.toLowerCase()) === raw)
  check('dashes optional', normalizeKeyString(key.replace(/-/g, '')) === raw)
  check('prefix optional', normalizeKeyString(raw) === raw)
  check('surrounding whitespace tolerated', normalizeKeyString(`  ${key}\n`) === raw)

  await expectThrows('too-short key rejected', async () => normalizeKeyString('HCE-ABC'), InvalidKeyError)
  await expectThrows('ambiguous character rejected', async () => normalizeKeyString('HCE-IIIII-IIIII-IIIII-IIIII'), InvalidKeyError)

  console.log('\nRoundtrip')
  const payload = randomBytes(300_000)
  const file = new File([payload as BufferSource], 'quarterly-report.pdf', {
    type: 'application/pdf',
  })

  const encrypted = await encryptFile(file)
  check('encrypted name swaps extension', encrypted.encryptedName === 'quarterly-report.hce', encrypted.encryptedName)
  check('ciphertext differs from plaintext size', encrypted.blob.size !== file.size)

  const cipherBytes = new Uint8Array(await encrypted.blob.arrayBuffer())
  check('plaintext is absent from ciphertext', !sameBytes(cipherBytes.subarray(0, payload.length), payload))

  const decrypted = await decryptFile(encrypted.blob, encrypted.keyString)
  const recovered = new Uint8Array(await decrypted.blob.arrayBuffer())
  check('bytes recovered exactly', sameBytes(recovered, payload))
  check('original filename recovered', decrypted.originalName === 'quarterly-report.pdf')
  check('mime type recovered', decrypted.blob.type === 'application/pdf')

  console.log('\nHeader')
  const header = await readHeader(encrypted.blob)
  check('header readable without a key', header.originalName === 'quarterly-report.pdf')
  check('header carries no key material', !JSON.stringify(header).includes(normalizeKeyString(encrypted.keyString)))

  console.log('\nWrong key and tampering')
  await expectThrows('wrong key rejected', () => decryptFile(encrypted.blob, generateKeyString()), WrongKeyError)
  await expectThrows('malformed key rejected', () => decryptFile(encrypted.blob, 'not-a-key'), InvalidKeyError)

  const tampered = cipherBytes.slice()
  tampered[tampered.length - 1] ^= 0xff
  await expectThrows(
    'flipped ciphertext bit rejected',
    () => decryptFile(new Blob([tampered as BufferSource]), encrypted.keyString),
    WrongKeyError,
  )

  await expectThrows(
    'non-.hce file rejected',
    () => decryptFile(new Blob([new TextEncoder().encode('just a text file') as BufferSource]), encrypted.keyString),
    CorruptFileError,
  )

  const truncated = cipherBytes.slice(0, Math.floor(cipherBytes.length / 2))
  await expectThrows(
    'truncated file rejected',
    () => decryptFile(new Blob([truncated as BufferSource]), encrypted.keyString),
    WrongKeyError,
  )

  console.log('\nChunking')
  const chunkPayload = randomBytes(250_000)
  const chunked = await encryptFile(new Blob([chunkPayload as BufferSource]), {
    originalName: 'big.bin',
    chunkSize: 64 * 1024,
  })
  check('multiple chunks produced', chunked.header.totalChunks === 4, `got ${chunked.header.totalChunks}`)
  const chunkedBack = await decryptFile(chunked.blob, chunked.keyString)
  check(
    'chunked roundtrip exact',
    sameBytes(new Uint8Array(await chunkedBack.blob.arrayBuffer()), chunkPayload),
  )

  console.log('\nEdge cases')
  const empty = await encryptFile(new Blob([]), { originalName: 'empty.txt' })
  const emptyBack = await decryptFile(empty.blob, empty.keyString)
  check('empty file roundtrips', emptyBack.blob.size === 0)
  await expectThrows('empty file still verifies the key', () => decryptFile(empty.blob, generateKeyString()), WrongKeyError)

  const shared = generateKeyString()
  const a = await encryptFile(new Blob([new Uint8Array([1, 2, 3]) as BufferSource]), { originalName: 'a', keyString: shared })
  const b = await encryptFile(new Blob([new Uint8Array([1, 2, 3]) as BufferSource]), { originalName: 'b', keyString: shared })
  check('same key, different salt', a.header.kdf.salt !== b.header.kdf.salt)
  check('same key, different keyId', a.keyId !== b.keyId)
  check(
    'identical plaintext yields different ciphertext',
    !sameBytes(new Uint8Array(await a.blob.arrayBuffer()), new Uint8Array(await b.blob.arrayBuffer())),
  )

  console.log(`\n${failed === 0 ? '✓' : '✗'} ${passed} passed, ${failed} failed\n`)
  if (failed > 0) throw new Error(`${failed} crypto self-test(s) failed`)
}

main().catch((error) => {
  console.error(error)
  throw error
})
