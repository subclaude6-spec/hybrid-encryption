import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchSession, signOut as signOutRequest } from '@/lib/auth'
import {
  ALERTS,
  LOGS,
  PROVIDERS,
  USERS,
  VAULT_FILES,
  providerById,
} from '@/lib/mock-data'
import type {
  CloudProvider,
  LogAction,
  LogEntry,
  LogStatus,
  ProviderId,
  SecurityAlert,
  User,
  VaultFile,
} from '@/lib/types'
import { mockKey, shortId } from '@/lib/utils'

/** Every vault file in the mock set decrypts with its own keyId. This mirrors the
 *  real check the crypto layer will do later: unwrap the DEK, then let AES-GCM's
 *  auth tag reject a wrong key. */
export function keyMatches(file: VaultFile, submitted: string): boolean {
  return submitted.trim().toUpperCase() === file.keyId.toUpperCase()
}

interface AppContextValue {
  currentUser: User | null
  /** True until the initial session check resolves — routes must wait for it. */
  bootstrapping: boolean
  users: User[]
  providers: CloudProvider[]
  vaultFiles: VaultFile[]
  logs: LogEntry[]
  alerts: SecurityAlert[]

  signIn: (user: User) => void
  signOut: () => Promise<void>

  /** Logs scoped to the caller: employees only ever see their own rows. */
  visibleLogs: (userId?: string) => LogEntry[]
  visibleVaultFiles: (userId?: string) => VaultFile[]

  addLog: (entry: {
    action: LogAction
    status: LogStatus
    detail: string
    providerId?: ProviderId | null
    user?: User
  }) => void

  recordEncryption: (args: {
    fileNames: string[]
    sizes: number[]
    providerId: ProviderId
  }) => { key: string; files: VaultFile[] }

  recordDecryption: (args: {
    file: VaultFile
    success: boolean
    attempt: number
  }) => void

  raiseAlert: (alert: Omit<SecurityAlert, 'id' | 'at' | 'resolved'>) => void
  resolveAlert: (id: string) => void

  setUserStatus: (userId: string, status: User['status']) => void
  connectProvider: (id: ProviderId, account: string) => void
  disconnectProvider: (id: ProviderId) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [users, setUsers] = useState<User[]>(USERS)

  // Restore an existing server session on load, so a refresh doesn't sign you out.
  useEffect(() => {
    let cancelled = false
    fetchSession()
      .then((user) => {
        if (!cancelled) setCurrentUser(user)
      })
      .catch(() => {
        // Server unreachable — treat as signed out rather than blocking the app.
      })
      .finally(() => {
        if (!cancelled) setBootstrapping(false)
      })
    return () => {
      cancelled = true
    }
  }, [])
  const [providers, setProviders] = useState<CloudProvider[]>(PROVIDERS)
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>(VAULT_FILES)
  const [logs, setLogs] = useState<LogEntry[]>(LOGS)
  const [alerts, setAlerts] = useState<SecurityAlert[]>(ALERTS)

  const pushLog = useCallback(
    (entry: {
      action: LogAction
      status: LogStatus
      detail: string
      providerId?: ProviderId | null
      user?: User
    }) => {
      const actor = entry.user ?? currentUser
      if (!actor) return
      const row: LogEntry = {
        id: shortId('l'),
        at: new Date().toISOString(),
        userId: actor.id,
        userName: actor.name,
        action: entry.action,
        status: entry.status,
        detail: entry.detail,
        providerId: entry.providerId ?? null,
        ip: '10.4.22.9',
        device: 'Windows 11 · Desktop App',
      }
      setLogs((prev) => [row, ...prev])
    },
    [currentUser],
  )

  const raiseAlert = useCallback(
    (alert: Omit<SecurityAlert, 'id' | 'at' | 'resolved'>) => {
      setAlerts((prev) => [
        { ...alert, id: shortId('a'), at: new Date().toISOString(), resolved: false },
        ...prev,
      ])
    },
    [],
  )

  // The server records the login event itself, so nothing is pushed here —
  // duplicating it locally would show the sign-in twice in the activity feed.
  const signIn = useCallback((user: User) => {
    setCurrentUser(user)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await signOutRequest()
    } finally {
      // Clear locally even if the request failed — the user asked to leave.
      setCurrentUser(null)
    }
  }, [])

  const visibleLogs = useCallback(
    (userId?: string) => {
      if (!currentUser) return []
      // Employees are hard-scoped to themselves regardless of the filter passed in.
      if (currentUser.role === 'employee') {
        return logs.filter((l) => l.userId === currentUser.id)
      }
      return userId ? logs.filter((l) => l.userId === userId) : logs
    },
    [currentUser, logs],
  )

  const visibleVaultFiles = useCallback(
    (userId?: string) => {
      if (!currentUser) return []
      if (currentUser.role === 'employee') {
        return vaultFiles.filter((f) => f.ownerId === currentUser.id)
      }
      return userId ? vaultFiles.filter((f) => f.ownerId === userId) : vaultFiles
    },
    [currentUser, vaultFiles],
  )

  const recordEncryption = useCallback(
    ({
      fileNames,
      sizes,
      providerId,
    }: {
      fileNames: string[]
      sizes: number[]
      providerId: ProviderId
    }) => {
      const key = mockKey()
      const owner = currentUser!
      const created: VaultFile[] = fileNames.map((name, i) => ({
        id: shortId('v'),
        originalName: name,
        encryptedName: `${name.replace(/\.[^.]+$/, '')}.hce`,
        sizeBytes: sizes[i] ?? 0,
        providerId,
        ownerId: owner.id,
        ownerName: owner.name,
        createdAt: new Date().toISOString(),
        algorithm: 'AES-256-GCM',
        keyId: key,
        status: 'encrypted',
        recipients: [owner.email, 'arjun@company.io'],
      }))

      setVaultFiles((prev) => [...created, ...prev])
      pushLog({
        action: 'encrypt_upload',
        status: 'success',
        detail: `${fileNames.length} file${fileNames.length > 1 ? 's' : ''} encrypted (AES-256-GCM) and uploaded to ${providerById(providerId).name}`,
        providerId,
      })
      pushLog({
        action: 'key_issued',
        status: 'success',
        detail: `Wrapped DEK issued to ${owner.email} and arjun@company.io`,
        providerId,
      })
      return { key, files: created }
    },
    [currentUser, pushLog],
  )

  const recordDecryption = useCallback(
    ({ file, success, attempt }: { file: VaultFile; success: boolean; attempt: number }) => {
      if (success) {
        setVaultFiles((prev) =>
          prev.map((f) => (f.id === file.id ? { ...f, status: 'decrypted' } : f)),
        )
        pushLog({
          action: 'decrypt_success',
          status: 'success',
          detail: `${file.encryptedName} decrypted and downloaded`,
          providerId: file.providerId,
        })
        return
      }

      pushLog({
        action: 'decrypt_failed',
        status: 'failed',
        detail: `Invalid decryption key — attempt ${attempt} of 3 on ${file.encryptedName}`,
        providerId: file.providerId,
      })

      if (attempt >= 3 && currentUser) {
        raiseAlert({
          severity: 'critical',
          title: 'Repeated invalid decryption key',
          detail: `${currentUser.name} submitted 3 consecutive invalid keys for ${file.encryptedName}. Admin has been notified by email.`,
          userId: currentUser.id,
          userName: currentUser.name,
          attempts: attempt,
        })
      }
    },
    [currentUser, pushLog, raiseAlert],
  )

  const resolveAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, resolved: true } : a)))
  }, [])

  const setUserStatus = useCallback(
    (userId: string, status: User['status']) => {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)))
      const target = users.find((u) => u.id === userId)
      if (target) {
        pushLog({
          action: status === 'suspended' ? 'access_revoked' : 'account_created',
          status: status === 'suspended' ? 'warning' : 'success',
          detail:
            status === 'suspended'
              ? `Suspended ${target.name} — credentials revoked`
              : `${target.name} approved as ${target.role}`,
        })
      }
    },
    [pushLog, users],
  )

  const connectProvider = useCallback(
    (id: ProviderId, account: string) => {
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, connected: true, account } : p)),
      )
      pushLog({
        action: 'provider_connected',
        status: 'success',
        detail: `${providerById(id).name} account ${account} linked`,
        providerId: id,
      })
    },
    [pushLog],
  )

  const disconnectProvider = useCallback((id: ProviderId) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, connected: false, account: null } : p)),
    )
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      currentUser,
      bootstrapping,
      users,
      providers,
      vaultFiles,
      logs,
      alerts,
      signIn,
      signOut,
      visibleLogs,
      visibleVaultFiles,
      addLog: pushLog,
      recordEncryption,
      recordDecryption,
      raiseAlert,
      resolveAlert,
      setUserStatus,
      connectProvider,
      disconnectProvider,
    }),
    [
      currentUser,
      bootstrapping,
      users,
      providers,
      vaultFiles,
      logs,
      alerts,
      signIn,
      signOut,
      visibleLogs,
      visibleVaultFiles,
      pushLog,
      recordEncryption,
      recordDecryption,
      raiseAlert,
      resolveAlert,
      setUserStatus,
      connectProvider,
      disconnectProvider,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppStoreProvider>')
  return ctx
}
