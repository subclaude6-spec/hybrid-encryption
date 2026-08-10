import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth'
import { SecurityAlert } from '../models/SecurityAlert'
import { User } from '../models/User'
import { recordLog } from '../services/log.service'
import { assertPasswordAcceptable, hashPassword } from '../services/password.service'
import { emitToAdmins, emitToUser } from '../realtime/socket'
import { ApiError } from '../utils/ApiError'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(requireAuth, requireRole('admin'))

/** Readable but unguessable: ~62 bits of entropy, no ambiguous characters. */
function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(12)
  return `Hce-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, role } = z
      .object({
        status: z.enum(['active', 'suspended', 'pending']).optional(),
        role: z.enum(['admin', 'employee']).optional(),
      })
      .parse(req.query)

    const filter: Record<string, unknown> = {}
    if (status) filter.status = status
    if (role) filter.role = role

    const users = await User.find(filter).sort({ createdAt: 1 })
    res.json({ users: users.map((user) => user.toJSON()) })
  }),
)

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).max(120),
        email: z.string().email(),
        department: z.string().max(120).default('Unassigned'),
        role: z.enum(['admin', 'employee']).default('employee'),
        password: z.string().optional(),
      })
      .parse(req.body)

    const existing = await User.findOne({ email: body.email.toLowerCase() })
    if (existing) throw ApiError.conflict('An account with that email already exists.')

    // A generated password is safer than a predictable default — the admin
    // reads it back once from the response and passes it on out of band.
    const temporaryPassword = body.password ?? generateTemporaryPassword()
    assertPasswordAcceptable(temporaryPassword)

    // Created active: an admin adding someone by hand *is* the approval step.
    // Self-registered accounts are the ones that land in `pending`.
    const user = await User.create({
      name: body.name,
      email: body.email,
      department: body.department,
      role: body.role,
      status: 'active',
      passwordHash: await hashPassword(temporaryPassword),
      authProvider: 'password',
      mustChangePassword: true,
    })

    await recordLog({
      user: req.currentUser!,
      action: 'account_created',
      status: 'success',
      detail: `Provisioned ${user.name} (${user.email}) as ${user.role}`,
      req,
    })

    emitToAdmins('user:created', user.toJSON())
    // Returned exactly once, never stored in readable form.
    res.status(201).json({ user: user.toJSON(), temporaryPassword })
  }),
)

/** Approve, suspend, or restore an account. */
router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(['active', 'suspended', 'pending']) })
      .parse(req.body)

    const user = await User.findById(req.params.id)
    if (!user) throw ApiError.notFound('User not found')

    if (String(user._id) === String(req.currentUser!._id)) {
      throw ApiError.badRequest('You cannot change your own account status.')
    }

    const previous = user.status
    user.status = status
    // A restored account starts with a clean slate on the lockout counter.
    if (status === 'active') user.failedDecryptAttempts = 0
    await user.save()

    await recordLog({
      user: req.currentUser!,
      action: status === 'suspended' ? 'access_revoked' : 'account_created',
      status: status === 'suspended' ? 'warning' : 'success',
      detail:
        status === 'suspended'
          ? `Suspended ${user.name} — credentials revoked`
          : `${user.name} set to ${status} (was ${previous})`,
      req,
    })

    // Auto-resolve the alerts that prompted this revocation.
    if (status === 'suspended') {
      await SecurityAlert.updateMany(
        { user: user._id, resolved: false },
        { resolved: true, resolvedBy: req.currentUser!._id, resolvedAt: new Date() },
      )
    }

    emitToAdmins('user:updated', user.toJSON())
    // Tells the affected user's open tabs to re-check their session.
    emitToUser(String(user._id), 'session:invalidated', { status })

    res.json({ user: user.toJSON() })
  }),
)

export default router
