import type {
  CloudFile,
  CloudProvider,
  LogEntry,
  ProviderId,
  SecurityAlert,
  User,
  VaultFile,
} from './types'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
export const minutesAgo = (n: number) => ago(n * MINUTE)
export const hoursAgo = (n: number) => ago(n * HOUR)
export const daysAgo = (n: number) => ago(n * DAY)

/* ------------------------------------------------------------------ providers */

export const PROVIDERS: CloudProvider[] = [
  {
    id: 'gdrive',
    name: 'Google Drive',
    blurb: 'Primary storage target',
    connected: true,
    accounts: [{ id: 'mock-gdrive-1', email: 'arjun@company.io', connectedAt: daysAgo(9) }],
    usedBytes: 8.4 * 1024 ** 3,
    totalBytes: 15 * 1024 ** 3,
    maxFileBytes: null,
    accent: '#4285f4',
  },
  {
    id: 'github',
    name: 'GitHub',
    blurb: 'Repo + release assets',
    connected: true,
    accounts: [{ id: 'mock-github-1', email: 'subclaude6-spec', connectedAt: daysAgo(9) }],
    usedBytes: null,
    totalBytes: null,
    maxFileBytes: 100 * 1024 ** 2,
    accent: '#a78bfa',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    blurb: 'Team folder sync',
    connected: true,
    accounts: [{ id: 'mock-dropbox-1', email: 'arjun@company.io', connectedAt: daysAgo(9) }],
    usedBytes: 1.2 * 1024 ** 3,
    totalBytes: 2 * 1024 ** 3,
    maxFileBytes: null,
    accent: '#0061ff',
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    blurb: 'Microsoft 365 account',
    connected: false,
    accounts: [],
    usedBytes: null,
    totalBytes: null,
    maxFileBytes: null,
    accent: '#22d3ee',
  },
  {
    id: 'mega',
    name: 'MEGA',
    blurb: 'Community SDK — experimental',
    connected: false,
    accounts: [],
    usedBytes: null,
    totalBytes: null,
    maxFileBytes: null,
    accent: '#f87171',
  },
]

export const providerById = (id: ProviderId): CloudProvider =>
  PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]

/* ---------------------------------------------------------------------- users */

export const USERS: User[] = [
  {
    id: 'u_admin',
    name: 'Arjun Kumar',
    email: 'arjun@company.io',
    role: 'admin',
    status: 'active',
    department: 'Security & Infrastructure',
    createdAt: daysAgo(420),
    lastActiveAt: minutesAgo(2),
    passkeys: [
      {
        id: 'pk_1',
        label: 'This PC',
        kind: 'platform',
        authenticator: 'Windows Hello — Fingerprint',
        createdAt: daysAgo(400),
        lastUsedAt: minutesAgo(2),
      },
      {
        id: 'pk_2',
        label: 'Pixel 9 Pro',
        kind: 'phone',
        authenticator: 'Android — Face Unlock',
        createdAt: daysAgo(180),
        lastUsedAt: daysAgo(6),
      },
    ],
  },
  {
    id: 'u_002',
    name: 'Priya Sharma',
    email: 'priya.sharma@company.io',
    role: 'employee',
    status: 'active',
    department: 'Finance',
    createdAt: daysAgo(210),
    lastActiveAt: minutesAgo(24),
    passkeys: [
      {
        id: 'pk_3',
        label: 'ThinkPad X1',
        kind: 'platform',
        authenticator: 'Windows Hello — Face',
        createdAt: daysAgo(210),
        lastUsedAt: minutesAgo(24),
      },
    ],
  },
  {
    id: 'u_003',
    name: 'Rahul Menon',
    email: 'rahul.menon@company.io',
    role: 'employee',
    status: 'active',
    department: 'Legal',
    createdAt: daysAgo(150),
    lastActiveAt: hoursAgo(5),
    passkeys: [
      {
        id: 'pk_4',
        label: 'iPhone 16',
        kind: 'phone',
        authenticator: 'iOS — Face ID',
        createdAt: daysAgo(150),
        lastUsedAt: hoursAgo(5),
      },
    ],
  },
  {
    id: 'u_004',
    name: 'Sneha Iyer',
    email: 'sneha.iyer@company.io',
    role: 'employee',
    status: 'suspended',
    department: 'Operations',
    createdAt: daysAgo(96),
    lastActiveAt: daysAgo(2),
    passkeys: [
      {
        id: 'pk_5',
        label: 'MacBook Air',
        kind: 'platform',
        authenticator: 'macOS — Touch ID',
        createdAt: daysAgo(96),
        lastUsedAt: daysAgo(2),
      },
    ],
  },
  {
    id: 'u_005',
    name: 'Vikram Desai',
    email: 'vikram.desai@company.io',
    role: 'employee',
    status: 'pending',
    department: 'Engineering',
    createdAt: hoursAgo(9),
    lastActiveAt: null,
    passkeys: [],
  },
]

export const userById = (id: string): User | undefined => USERS.find((u) => u.id === id)

/* ---------------------------------------------------------------- cloud files */

const gdriveFiles: CloudFile[] = [
  { id: 'g1', name: 'Board Reports', sizeBytes: 0, modifiedAt: daysAgo(3), kind: 'folder', providerId: 'gdrive', encrypted: false },
  { id: 'g2', name: 'Payroll', sizeBytes: 0, modifiedAt: daysAgo(11), kind: 'folder', providerId: 'gdrive', encrypted: false },
  { id: 'g3', name: 'Q3-financials.xlsx', sizeBytes: 4.2 * 1024 ** 2, modifiedAt: hoursAgo(6), kind: 'file', providerId: 'gdrive', encrypted: false },
  { id: 'g4', name: 'client-contract-mehta.pdf', sizeBytes: 1.8 * 1024 ** 2, modifiedAt: daysAgo(1), kind: 'file', providerId: 'gdrive', encrypted: false },
  { id: 'g5', name: 'salary-structure-2026.xlsx', sizeBytes: 890 * 1024, modifiedAt: daysAgo(4), kind: 'file', providerId: 'gdrive', encrypted: false },
  { id: 'g6', name: 'audit-notes.hce', sizeBytes: 12.4 * 1024 ** 2, modifiedAt: daysAgo(2), kind: 'file', providerId: 'gdrive', encrypted: true },
  { id: 'g7', name: 'board-minutes-jul.hce', sizeBytes: 3.1 * 1024 ** 2, modifiedAt: daysAgo(8), kind: 'file', providerId: 'gdrive', encrypted: true },
  { id: 'g8', name: 'product-roadmap.pptx', sizeBytes: 22 * 1024 ** 2, modifiedAt: daysAgo(5), kind: 'file', providerId: 'gdrive', encrypted: false },
  { id: 'g9', name: 'vendor-invoices.zip', sizeBytes: 64 * 1024 ** 2, modifiedAt: daysAgo(9), kind: 'file', providerId: 'gdrive', encrypted: false },
]

const githubFiles: CloudFile[] = [
  { id: 'h1', name: 'secure-vault', sizeBytes: 0, modifiedAt: daysAgo(1), kind: 'folder', providerId: 'github', encrypted: false },
  { id: 'h2', name: 'release-assets', sizeBytes: 0, modifiedAt: daysAgo(7), kind: 'folder', providerId: 'github', encrypted: false },
  { id: 'h3', name: 'deployment-keys.hce', sizeBytes: 18 * 1024, modifiedAt: daysAgo(1), kind: 'file', providerId: 'github', encrypted: true },
  { id: 'h4', name: 'infra-credentials.hce', sizeBytes: 42 * 1024, modifiedAt: daysAgo(14), kind: 'file', providerId: 'github', encrypted: true },
  { id: 'h5', name: 'architecture.md', sizeBytes: 28 * 1024, modifiedAt: hoursAgo(20), kind: 'file', providerId: 'github', encrypted: false },
]

const dropboxFiles: CloudFile[] = [
  { id: 'd1', name: 'Shared with Legal', sizeBytes: 0, modifiedAt: daysAgo(2), kind: 'folder', providerId: 'dropbox', encrypted: false },
  { id: 'd2', name: 'nda-signed-batch.hce', sizeBytes: 6.6 * 1024 ** 2, modifiedAt: daysAgo(3), kind: 'file', providerId: 'dropbox', encrypted: true },
  { id: 'd3', name: 'employee-handbook.pdf', sizeBytes: 9.1 * 1024 ** 2, modifiedAt: daysAgo(30), kind: 'file', providerId: 'dropbox', encrypted: false },
  { id: 'd4', name: 'insurance-claims.csv', sizeBytes: 320 * 1024, modifiedAt: daysAgo(6), kind: 'file', providerId: 'dropbox', encrypted: false },
]

export const CLOUD_FILES: Record<ProviderId, CloudFile[]> = {
  gdrive: gdriveFiles,
  github: githubFiles,
  dropbox: dropboxFiles,
  onedrive: [],
  mega: [],
}

/* ----------------------------------------------------------------- vault files */

export const VAULT_FILES: VaultFile[] = [
  {
    id: 'v_001',
    originalName: 'audit-notes.docx',
    encryptedName: 'audit-notes.hce',
    sizeBytes: 12.4 * 1024 ** 2,
    providerId: 'gdrive',
    ownerId: 'u_002',
    ownerName: 'Priya Sharma',
    createdAt: daysAgo(2),
    algorithm: 'AES-256-GCM',
    keyId: 'HCE-4KDQ2-M7XPL-99TRV-BN3WZ',
    status: 'encrypted',
    recipients: ['priya.sharma@company.io', 'arjun@company.io'],
  },
  {
    id: 'v_002',
    originalName: 'board-minutes-jul.pdf',
    encryptedName: 'board-minutes-jul.hce',
    sizeBytes: 3.1 * 1024 ** 2,
    providerId: 'gdrive',
    ownerId: 'u_003',
    ownerName: 'Rahul Menon',
    createdAt: daysAgo(8),
    algorithm: 'AES-256-GCM',
    keyId: 'HCE-P2M4X-7LTQW-DK8VN-RJ5ZY',
    status: 'decrypted',
    recipients: ['rahul.menon@company.io', 'arjun@company.io'],
  },
  {
    id: 'v_003',
    originalName: 'deployment-keys.env',
    encryptedName: 'deployment-keys.hce',
    sizeBytes: 18 * 1024,
    providerId: 'github',
    ownerId: 'u_002',
    ownerName: 'Priya Sharma',
    createdAt: daysAgo(1),
    algorithm: 'AES-256-GCM',
    keyId: 'HCE-W9RTY-3XBNM-K7QLP-42VDS',
    status: 'encrypted',
    recipients: ['priya.sharma@company.io', 'arjun@company.io'],
  },
  {
    id: 'v_004',
    originalName: 'nda-signed-batch.zip',
    encryptedName: 'nda-signed-batch.hce',
    sizeBytes: 6.6 * 1024 ** 2,
    providerId: 'dropbox',
    ownerId: 'u_004',
    ownerName: 'Sneha Iyer',
    createdAt: daysAgo(3),
    algorithm: 'AES-256-GCM',
    keyId: 'HCE-JH6BN-QW2ER-TY8UI-OP4AS',
    status: 'failed',
    recipients: ['sneha.iyer@company.io', 'arjun@company.io'],
  },
  {
    id: 'v_005',
    originalName: 'infra-credentials.yaml',
    encryptedName: 'infra-credentials.hce',
    sizeBytes: 42 * 1024,
    providerId: 'github',
    ownerId: 'u_003',
    ownerName: 'Rahul Menon',
    createdAt: daysAgo(14),
    algorithm: 'AES-256-GCM',
    keyId: 'HCE-ZX3CV-BN7M4-QS8DF-GH2JK',
    status: 'encrypted',
    recipients: ['rahul.menon@company.io', 'arjun@company.io'],
  },
]

/* ------------------------------------------------------------------------ logs */

export const LOGS: LogEntry[] = [
  { id: 'l_01', at: minutesAgo(2), userId: 'u_admin', userName: 'Arjun Kumar', action: 'login', status: 'success', detail: 'Passkey verified via Windows Hello (fingerprint)', providerId: null, ip: '10.4.22.9', device: 'Windows 11 · Desktop App' },
  { id: 'l_02', at: minutesAgo(24), userId: 'u_002', userName: 'Priya Sharma', action: 'encrypt_upload', status: 'success', detail: 'deployment-keys.env encrypted and uploaded', providerId: 'github', ip: '10.4.19.51', device: 'Windows 11 · Desktop App' },
  { id: 'l_03', at: minutesAgo(26), userId: 'u_002', userName: 'Priya Sharma', action: 'key_issued', status: 'success', detail: 'Wrapped DEK issued to owner + admin', providerId: 'github', ip: '10.4.19.51', device: 'Windows 11 · Desktop App' },
  { id: 'l_04', at: hoursAgo(5), userId: 'u_003', userName: 'Rahul Menon', action: 'decrypt_success', status: 'success', detail: 'board-minutes-jul.hce decrypted and downloaded', providerId: 'gdrive', ip: '10.4.31.8', device: 'macOS 15 · Desktop App' },
  { id: 'l_05', at: hoursAgo(9), userId: 'u_005', userName: 'Vikram Desai', action: 'account_created', status: 'warning', detail: 'Account provisioned — awaiting admin approval', providerId: null, ip: '10.4.44.2', device: 'Windows 11 · Desktop App' },
  { id: 'l_06', at: daysAgo(2), userId: 'u_004', userName: 'Sneha Iyer', action: 'decrypt_failed', status: 'failed', detail: 'Invalid decryption key — attempt 3 of 3 on nda-signed-batch.hce', providerId: 'dropbox', ip: '203.0.113.77', device: 'Unknown · Web' },
  { id: 'l_07', at: daysAgo(2), userId: 'u_admin', userName: 'Arjun Kumar', action: 'access_revoked', status: 'warning', detail: 'Suspended Sneha Iyer after 3 failed key attempts', providerId: null, ip: '10.4.22.9', device: 'Windows 11 · Desktop App' },
  { id: 'l_08', at: daysAgo(2), userId: 'u_002', userName: 'Priya Sharma', action: 'encrypt_upload', status: 'success', detail: 'audit-notes.docx encrypted and uploaded', providerId: 'gdrive', ip: '10.4.19.51', device: 'Windows 11 · Desktop App' },
  { id: 'l_09', at: daysAgo(3), userId: 'u_004', userName: 'Sneha Iyer', action: 'login_failed', status: 'failed', detail: 'Passkey assertion rejected — unrecognised device', providerId: null, ip: '203.0.113.77', device: 'Unknown · Web' },
  { id: 'l_10', at: daysAgo(4), userId: 'u_003', userName: 'Rahul Menon', action: 'provider_connected', status: 'success', detail: 'GitHub account subclaude6-spec linked', providerId: 'github', ip: '10.4.31.8', device: 'macOS 15 · Desktop App' },
  { id: 'l_11', at: daysAgo(6), userId: 'u_admin', userName: 'Arjun Kumar', action: 'passkey_enrolled', status: 'success', detail: 'Phone passkey enrolled — Pixel 9 Pro (Face Unlock)', providerId: null, ip: '10.4.22.9', device: 'Windows 11 · Desktop App' },
  { id: 'l_12', at: daysAgo(8), userId: 'u_003', userName: 'Rahul Menon', action: 'encrypt_upload', status: 'success', detail: 'board-minutes-jul.pdf encrypted and uploaded', providerId: 'gdrive', ip: '10.4.31.8', device: 'macOS 15 · Desktop App' },
  { id: 'l_13', at: daysAgo(11), userId: 'u_002', userName: 'Priya Sharma', action: 'logout', status: 'success', detail: 'Session ended by user', providerId: null, ip: '10.4.19.51', device: 'Windows 11 · Desktop App' },
  { id: 'l_14', at: daysAgo(14), userId: 'u_003', userName: 'Rahul Menon', action: 'encrypt_upload', status: 'success', detail: 'infra-credentials.yaml encrypted and uploaded', providerId: 'github', ip: '10.4.31.8', device: 'macOS 15 · Desktop App' },
]

/* ---------------------------------------------------------------------- alerts */

export const ALERTS: SecurityAlert[] = [
  {
    id: 'a_01',
    at: daysAgo(2),
    severity: 'critical',
    title: 'Repeated invalid decryption key',
    detail:
      'Sneha Iyer submitted 3 consecutive invalid keys for nda-signed-batch.hce from an unrecognised IP (203.0.113.77).',
    userId: 'u_004',
    userName: 'Sneha Iyer',
    resolved: false,
    attempts: 3,
  },
  {
    id: 'a_02',
    at: hoursAgo(9),
    severity: 'warning',
    title: 'Account awaiting approval',
    detail: 'Vikram Desai registered a passkey but has no admin-approved role yet.',
    userId: 'u_005',
    userName: 'Vikram Desai',
    resolved: false,
  },
  {
    id: 'a_03',
    at: daysAgo(3),
    severity: 'warning',
    title: 'Login from unrecognised device',
    detail: 'Passkey assertion rejected for Sneha Iyer — device fingerprint not enrolled.',
    userId: 'u_004',
    userName: 'Sneha Iyer',
    resolved: true,
  },
]
