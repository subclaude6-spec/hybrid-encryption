import { ApiRequestError, api } from './api'
import type { User } from './types'

/** Shape the server returns (see User.toJSON on the server). */
interface ApiUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'employee'
  status: 'active' | 'suspended' | 'pending'
  department: string
  authProvider: 'password' | 'google' | 'both'
  locked: boolean
  mustChangePassword: boolean
  createdAt: string
  lastActiveAt: string | null
  providerAccounts: { provider: string; accountEmail: string; connectedAt: string }[]
}

export function toAppUser(apiUser: ApiUser): User {
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role: apiUser.role,
    status: apiUser.status,
    department: apiUser.department,
    authProvider: apiUser.authProvider,
    locked: apiUser.locked,
    mustChangePassword: apiUser.mustChangePassword,
    createdAt: apiUser.createdAt,
    lastActiveAt: apiUser.lastActiveAt,
  }
}

export interface LoginResult {
  user: User
  mustChangePassword: boolean
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<LoginResult> {
  const result = await api.post<{ user: ApiUser; mustChangePassword: boolean }>(
    '/auth/login',
    { email: email.trim(), password },
  )
  return { user: toAppUser(result.user), mustChangePassword: result.mustChangePassword }
}

/**
 * Google sign-in is a full-page redirect, not a fetch — the OAuth flow has to
 * happen in the top-level browsing context so Google can show its account
 * chooser and set its own cookies.
 */
export function startGoogleSignIn(): void {
  window.location.href = '/api/auth/google'
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await api.post('/auth/change-password', { currentPassword, newPassword })
}

/** Tells the login screen whether to offer the Google button. */
export async function fetchAuthConfig(): Promise<{ googleSignIn: boolean }> {
  try {
    return await api.get<{ googleSignIn: boolean }>('/auth/config')
  } catch {
    return { googleSignIn: false }
  }
}

/** Returns null when nobody is signed in — a 401 here is expected, not an error. */
export async function fetchSession(): Promise<User | null> {
  try {
    const { user } = await api.get<{ user: ApiUser }>('/auth/me')
    return toAppUser(user)
  } catch (error) {
    if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
      return null
    }
    throw error
  }
}

export async function signOut(): Promise<void> {
  await api.post('/auth/logout')
}

/** Maps the `?error=` codes the Google callback redirects back with. */
export function describeAuthError(code: string | null): string | null {
  if (!code) return null
  switch (code) {
    case 'not_provisioned':
      return 'That Google account is not registered. Ask your administrator to provision it first.'
    case 'account_pending':
      return 'Your account is awaiting administrator approval.'
    case 'account_suspended':
      return 'Access revoked by your administrator. Contact the security team.'
    case 'google_email_unverified':
      return 'That Google account has an unverified email address.'
    case 'google_not_configured':
      return 'Google sign-in is not configured on this server.'
    case 'invalid_state':
      return 'The sign-in attempt expired. Please try again.'
    case 'access_denied':
      return 'You cancelled the Google sign-in.'
    default:
      return decodeURIComponent(code)
  }
}
