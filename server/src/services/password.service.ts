import bcrypt from 'bcryptjs'
import { ApiError } from '../utils/ApiError'
import type { UserDocument } from '../models/User'

/** 12 rounds ≈ 250 ms per hash — slow enough to make offline cracking painful,
 *  fast enough that a login doesn't feel sluggish. */
const BCRYPT_ROUNDS = 12

export const MAX_LOGIN_ATTEMPTS = 5
export const LOCKOUT_MINUTES = 15

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/**
 * Length is the property that actually matters; the usual symbol-and-digit
 * rules mostly produce `Password1!`. A short blocklist catches the handful of
 * passwords that get tried first in any real attack.
 */
const COMMON = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  'qwerty123',
  'admin123',
  'letmein1',
  'welcome1',
  'iloveyou',
])

export function assertPasswordAcceptable(password: string): void {
  if (password.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters.')
  }
  if (password.length > 200) {
    throw ApiError.badRequest('Password must be 200 characters or fewer.')
  }
  if (COMMON.has(password.toLowerCase())) {
    throw ApiError.badRequest('That password is too common. Choose something less guessable.')
  }
}

/* --------------------------------------------------------------- lockout */

export function isLocked(user: UserDocument): boolean {
  return Boolean(user.lockedUntil && user.lockedUntil > new Date())
}

export function minutesUntilUnlock(user: UserDocument): number {
  if (!user.lockedUntil) return 0
  return Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000))
}

/** Locks the account once the attempt budget is spent. Returns true if this
 *  failure was the one that triggered the lock. */
export async function registerFailedAttempt(user: UserDocument): Promise<boolean> {
  user.failedLoginAttempts += 1
  const shouldLock = user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS
  if (shouldLock) {
    user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
    user.failedLoginAttempts = 0
  }
  await user.save()
  return shouldLock
}

export async function clearFailedAttempts(user: UserDocument): Promise<void> {
  if (user.failedLoginAttempts === 0 && !user.lockedUntil) return
  user.failedLoginAttempts = 0
  user.lockedUntil = null
  await user.save()
}
