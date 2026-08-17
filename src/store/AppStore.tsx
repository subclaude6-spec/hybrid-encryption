import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchSession, signOut as signOutRequest, toAppUser, type ApiUser } from '@/lib/auth'
import { api } from '@/lib/api'
import {
  disconnectGithub,
  disconnectGoogleDrive,
  fetchProviders,
  startGithubConnect,
  startGoogleDriveConnect,
} from '@/lib/providers'
import { connectSocket, disconnectSocket } from '@/lib/socket'
import {
  ALERTS,
  LOGS,
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
    fileName: string
    providerId: ProviderId | null
    success: boolean
    attempt: number
  }) => void

  raiseAlert: (alert: Omit<SecurityAlert, 'id' | 'at' | 'resolved'>) => void
  resolveAlert: (id: string) => void

  setUserStatus: (userId: string, status: User['status']) => Promise<void>
  refreshUsers: () => Promise<void>
  createEmployee: (input: {
    name: string
    email: string
    department: string
  }) => Promise<{ user: User; temporaryPassword: string }>
  refreshProviders: () => Promise<void>
  /** Google Drive redirects the whole page; other providers aren't wired up yet. */
  connectProvider: (id: ProviderId) => void
  disconnectProvider: (id: ProviderId, accountId: string) => Promise<void>
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

  const refreshUsers = useCallback(async () => {
    const { users: apiUsers } = await api.get<{ users: ApiUser[] }>('/users')
    setUsers(apiUsers.map(toAppUser))
  }, [])

  // Admins manage real accounts — load them from the database instead of
  // the frontend's mock roster as soon as an admin session is known.
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      refreshUsers().catch(() => {
        // Left showing whatever was there before — the Employees page surfaces its own errors.
      })
    }
  }, [currentUser, refreshUsers])

  const [providers, setProviders] = useState<CloudProvider[]>([])

  const refreshProviders = useCallback(async () => {
    setProviders(await fetchProviders())
  }, [])

  // Every signed-in role needs to know what's actually connected — this isn't
  // admin-only like the user roster.
  useEffect(() => {
    if (currentUser) {
      refreshProviders().catch(() => {
        // Left showing whatever was there before — Upload/Decrypt surface their own errors.
      })
    }
  }, [currentUser, refreshProviders])

  // Realtime channel mirrors the session: connect once someone's signed in,
  // drop it the moment they're not so a stale socket never lingers.
  useEffect(() => {
    if (currentUser) {
      connectSocket()
      return () => disconnectSocket()
    }
    return undefined
  }, [currentUser])
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
    ({
      fileName,
      providerId,
      success,
      attempt,
    }: {
      fileName: string
      providerId: ProviderId | null
      success: boolean
      attempt: number
    }) => {
      if (success) {
        pushLog({
          action: 'decrypt_success',
          status: 'success',
          detail: `${fileName} decrypted and downloaded`,
          providerId,
        })
        return
      }

      pushLog({
        action: 'decrypt_failed',
        status: 'failed',
        detail: `Invalid decryption key — attempt ${attempt} of 3 on ${fileName}`,
        providerId,
      })

      if (attempt >= 3 && currentUser) {
        raiseAlert({
          severity: 'critical',
          title: 'Repeated invalid decryption key',
          detail: `${currentUser.name} submitted 3 consecutive invalid keys for ${fileName}. Admin has been notified by email.`,
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
    async (userId: string, status: User['status']) => {
      const { user: updated } = await api.patch<{ user: ApiUser }>(
        `/users/${userId}/status`,
        { status },
      )
      const applied = toAppUser(updated)
      setUsers((prev) => prev.map((u) => (u.id === userId ? applied : u)))
      // The server records its own audit-log entry for this change, so this
      // only needs to update local state — no local pushLog here.
    },
    [],
  )

  const createEmployee = useCallback(
    async (input: { name: string; email: string; department: string }) => {
      const { user: created, temporaryPassword } = await api.post<{
        user: ApiUser
        temporaryPassword: string
      }>('/users', { ...input, role: 'employee' })
      const applied = toAppUser(created)
      setUsers((prev) => [...prev, applied])
      return { user: applied, temporaryPassword }
    },
    [],
  )

  const connectProvider = useCallback((id: ProviderId) => {
    if (id === 'gdrive') {
      startGoogleDriveConnect()
      return
    }
    if (id === 'github') {
      startGithubConnect()
      return
    }
    throw new Error(`${providerById(id).name} isn't wired up yet.`)
  }, [])

  const disconnectProvider = useCallback(
    async (id: ProviderId, accountId: string) => {
      if (id === 'gdrive') {
        await disconnectGoogleDrive(accountId)
      } else if (id === 'github') {
        await disconnectGithub(accountId)
      } else {
        throw new Error(`${providerById(id).name} isn't wired up yet.`)
      }
      await refreshProviders()
    },
    [refreshProviders],
  )

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
      refreshUsers,
      createEmployee,
      refreshProviders,
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
      refreshUsers,
      createEmployee,
      refreshProviders,
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
