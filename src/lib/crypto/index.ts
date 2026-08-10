export {
  CorruptFileError,
  WrongKeyError,
  DEFAULT_CHUNK_SIZE,
  FORMAT_VERSION,
  MAGIC,
  toEncryptedName,
  type HceHeader,
} from './hce'

export {
  InvalidKeyError,
  PBKDF2_ITERATIONS,
  formatKeyString,
  generateKeyString,
  isValidKeyString,
  normalizeKeyString,
} from './keys'

export { encryptFile, type CryptoProgress, type EncryptOptions, type EncryptResult } from './encrypt'

export { decryptFile, readHeader, type DecryptOptions, type DecryptResult } from './decrypt'
