import crypto from 'node:crypto'
import { Router, type Request } from 'express'
import { z } from 'zod'
import { env, features } from '../config/env'
import { requireAuth } from '../middleware/auth'
import { User, type UserDocument } from '../models/User'
import { recordLog } from '../services/log.service'
import { buildLoginUrl, exchangeLoginCode } from '../services/google.service'
import {
  LOCKOUT_MINUTES,
  assertPasswordAcceptable,
  clearFailedAttempts,
  hashPassword,
  isLocked,
  minutesUntilUnlock,
  registerFailedAttempt,
  verifyPassword,
} from '../services/password.service'
import { ApiError } from '../utils/ApiError'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

/** Regenerates the session id on login so a pre-login cookie can't be reused. */
function establishSession(req: Request, userId: string, role: 'admin' | 'employee') {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) return reject(regenerateError)
      req.session.userId = userId
      req.session.role = role
      req.session.save((saveError) => (saveError ? reject(saveError) : resolve()))
    })
  })
}

/** Blocks a sign-in that passed authentication but isn't allowed to proceed. */
function assertCanSignIn(user: UserDocument): void {
  if (user.status === 'suspended') {
    throw ApiError.forbidden('Access revoked by your administrator. Contact the security team.')
  }
  if (user.status === 'pending') {
    throw ApiError.forbidden('Your account is awaiting administrator approval.')
  }
}

function backToApp(path: string, params: Record<string, string>) {
  return `${env.CLIENT_URL}/#${path}?${new URLSearchParams(params).toString()}`
}

/* -------------------------------------------------------------- session */

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.currentUser!.toJSON() })
  }),
)

router.get('/config', (_req, res) => {
  // Lets the login screen hide the Google button when it isn't configured.
  res.json({ googleSignIn: features.googleDrive })
})

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const user = req.session.userId ? await User.findById(req.session.userId) : null
    if (user) {
      await recordLog({
        user,
        action: 'logout',
        status: 'success',
        detail: 'Session ended by user',
        req,
      })
    }
    req.session.destroy(() => {
      res.clearCookie('hce.sid')
      res.json({ ok: true })
    })
  }),
)

/* ------------------------------------------------------- password login */

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = z
      .object({
        email: z.string().email('Enter a valid email address'),
        password: z.string().min(1, 'Enter your password'),
      })
      .parse(req.body)

    // passwordHash is select:false, so it must be asked for explicitly.
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      '+passwordHash',
    )

    // Same message whether the account is missing or the password is wrong —
    // anything more specific tells an attacker which emails are registered.
    const invalid = ApiError.unauthorized('Incorrect email or password.')

    if (!user || !user.passwordHash) throw invalid

    if (isLocked(user)) {
      throw ApiError.tooManyRequests(
        `Too many failed attempts. Try again in ${minutesUntilUnlock(user)} minute(s).`,
      )
    }

    const matches = await verifyPassword(password, user.passwordHash)

    if (!matches) {
      const nowLocked = await registerFailedAttempt(user)
      await recordLog({
        user,
        action: 'login_failed',
        status: 'failed',
        detail: nowLocked
          ? `Incorrect password — account locked for ${LOCKOUT_MINUTES} minutes`
          : 'Incorrect password',
        req,
      })
      if (nowLocked) {
        throw ApiError.tooManyRequests(
          `Too many failed attempts. This account is locked for ${LOCKOUT_MINUTES} minutes.`,
        )
      }
      throw invalid
    }

    try {
      assertCanSignIn(user)
    } catch (error) {
      await recordLog({
        user,
        action: 'login_failed',
        status: 'failed',
        detail: (error as Error).message,
        req,
      })
      throw error
    }

    await clearFailedAttempts(user)
    user.lastActiveAt = new Date()
    await user.save()

    await establishSession(req, String(user._id), user.role)
    await recordLog({
      user,
      action: 'login',
      status: 'success',
      detail: 'Signed in with email and password',
      req,
    })

    res.json({ user: user.toJSON(), mustChangePassword: user.mustChangePassword })
  }),
)

router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(1),
      })
      .parse(req.body)

    const user = await User.findById(req.currentUser!._id).select('+passwordHash')
    if (!user?.passwordHash) {
      throw ApiError.badRequest('This account has no password set. Sign in with Google instead.')
    }

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw ApiError.unauthorized('Your current password is incorrect.')
    }

    assertPasswordAcceptable(newPassword)

    user.passwordHash = await hashPassword(newPassword)
    user.mustChangePassword = false
    await user.save()

    await recordLog({
      user,
      action: 'account_created',
      status: 'success',
      detail: 'Password changed',
      req,
    })

    res.json({ ok: true })
  }),
)

/* --------------------------------------------------------- Google login */

router.get(
  '/google',
  asyncHandler(async (req, res) => {
    if (!features.googleDrive) {
      return res.redirect(backToApp('/login', { error: 'google_not_configured' }))
    }

    const state = crypto.randomBytes(24).toString('hex')
    req.session.oauthState = state
    await new Promise<void>((resolve, reject) =>
      req.session.save((error) => (error ? reject(error) : resolve())),
    )
    res.redirect(buildLoginUrl(state))
  }),
)

router.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error } = z
      .object({
        code: z.string().optional(),
        state: z.string().optional(),
        error: z.string().optional(),
      })
      .parse(req.query)

    if (error) return res.redirect(backToApp('/login', { error }))
    if (!code || !state || state !== req.session.oauthState) {
      return res.redirect(backToApp('/login', { error: 'invalid_state' }))
    }
    delete req.session.oauthState

    let identity
    try {
      identity = await exchangeLoginCode(code)
    } catch (exchangeError) {
      return res.redirect(
        backToApp('/login', { error: (exchangeError as Error).message.slice(0, 160) }),
      )
    }

    // An unverified Google email could belong to someone else entirely.
    if (!identity.emailVerified) {
      return res.redirect(backToApp('/login', { error: 'google_email_unverified' }))
    }

    // Match on the stable Google subject id first, then fall back to email so
    // an admin-provisioned account can be claimed on first Google sign-in.
    const user =
      (await User.findOne({ googleId: identity.googleId })) ??
      (await User.findOne({ email: identity.email }))

    if (!user) {
      return res.redirect(backToApp('/login', { error: 'not_provisioned' }))
    }

    if (user.status !== 'active') {
      await recordLog({
        user,
        action: 'login_failed',
        status: 'failed',
        detail: `Google sign-in blocked — account is ${user.status}`,
        req,
      })
      return res.redirect(backToApp('/login', { error: `account_${user.status}` }))
    }

    if (!user.googleId) {
      user.googleId = identity.googleId
      user.authProvider = user.passwordHash ? 'both' : 'google'
    }
    user.lastActiveAt = new Date()
    await clearFailedAttempts(user)
    await user.save()

    await establishSession(req, String(user._id), user.role)
    await recordLog({
      user,
      action: 'login',
      status: 'success',
      detail: `Signed in with Google (${identity.email})`,
      req,
    })

    res.redirect(`${env.CLIENT_URL}/#${user.role === 'admin' ? '/admin' : '/app'}`)
  }),
)

export default router
