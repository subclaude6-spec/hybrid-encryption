export type Role = 'admin' | 'employee'

export type UserStatus = 'active' | 'suspended' | 'pending'

/** How the account can sign in. `both` means a password is set and a Google
 *  account is linked — either one works. */
export type AuthProvider = 'password' | 'google' | 'both'

export interface Passkey {
  id: string
  label: string
  kind: 'platform' | 'phone' | 'security-key'
  authenticator: string
  createdAt: string
  lastUsedAt: string | null
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  status: UserStatus
  department: string
  authProvider: AuthProvider
  /** True while a failed-login lockout is in force. */
  locked: boolean
  mustChangePassword: boolean
  createdAt: string
  lastActiveAt: string | null
  passkeys?: Passkey[]
}

export type ProviderId = 'gdrive' | 'github' | 'dropbox' | 'onedrive' | 'mega'

/** One linked account for a provider. A user can connect several — e.g. a
 *  work and a personal Google Drive — and pick which one to use per upload. */
export interface ConnectedAccount {
  id: string
  email: string
  connectedAt: string
}

export interface CloudProvider {
  id: ProviderId
  name: string
  blurb: string
  connected: boolean
  accounts: ConnectedAccount[]
  /** Bytes. null when the provider doesn't report a quota (e.g. GitHub). */
  usedBytes: number | null
  totalBytes: number | null
  /** GitHub caps blobs at 100 MB, so the upload flow warns before it fails. */
  maxFileBytes: number | null
  accent: string
}

export interface CloudFile {
  id: string
  name: string
  sizeBytes: number
  modifiedAt: string
  kind: 'file' | 'folder'
  providerId: ProviderId
  /** True when the object is one of our own .hce envelopes. */
  encrypted: boolean
}

export type VaultStatus = 'encrypted' | 'decrypted' | 'failed'

export interface VaultFile {
  id: string
  originalName: string
  encryptedName: string
  sizeBytes: number
  providerId: ProviderId
  ownerId: string
  ownerName: string
  createdAt: string
  algorithm: 'AES-256-GCM'
  keyId: string
  status: VaultStatus
  /** Who the wrapped DEK was issued to. */
  recipients: string[]
}

export type LogAction =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'passkey_enrolled'
  | 'encrypt_upload'
  | 'decrypt_success'
  | 'decrypt_failed'
  | 'key_issued'
  | 'provider_connected'
  | 'access_revoked'
  | 'account_created'

export type LogStatus = 'success' | 'failed' | 'warning'

export interface LogEntry {
  id: string
  at: string
  userId: string
  userName: string
  action: LogAction
  status: LogStatus
  detail: string
  providerId: ProviderId | null
  ip: string
  device: string
}

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface SecurityAlert {
  id: string
  at: string
  severity: AlertSeverity
  title: string
  detail: string
  userId: string
  userName: string
  resolved: boolean
  /** Number of consecutive bad key attempts that triggered this. */
  attempts?: number
}
