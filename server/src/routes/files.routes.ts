import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, resolveScopeUserId } from '../middleware/auth'
import { SecurityAlert } from '../models/SecurityAlert'
import { VaultFile } from '../models/VaultFile'
import { recordLog } from '../services/log.service'
import { emitToAdmins, emitToUserAndAdmins } from '../realtime/socket'
import { ApiError } from '../utils/ApiError'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

/** Employees see only their own files; admins may filter by owner. Scoping is
 *  applied here rather than trusting any client-supplied owner id. */
function ownerFilter(req: Parameters<typeof resolveScopeUserId>[0], requested?: string) {
  const scoped = resolveScopeUserId(req, requested)
  return scoped ? { owner: scoped } : {}
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        ownerId: z.string().optional(),
        status: z.enum(['encrypted', 'decrypted', 'failed']).optional(),
        search: z.string().optional(),
        limit: z.coerce.number().min(1).max(200).default(100),
      })
      .parse(req.query)

    const filter: Record<string, unknown> = ownerFilter(req, query.ownerId)
    if (query.status) filter.status = query.status
    if (query.search?.trim()) {
      const term = query.search.trim()
      // Escaped so a user searching for "a.b" doesn't get regex behaviour.
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [
        { originalName: { $regex: safe, $options: 'i' } },
        { encryptedName: { $regex: safe, $options: 'i' } },
        { ownerName: { $regex: safe, $options: 'i' } },
      ]
    }

    const files = await VaultFile.find(filter).sort({ createdAt: -1 }).limit(query.limit)
    res.json({ files: files.map((file) => file.toJSON()) })
  }),
)

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const file = await VaultFile.findById(req.params.id)
    if (!file) throw ApiError.notFound('File not found')

    const user = req.currentUser!
    if (user.role === 'employee' && String(file.owner) !== String(user._id)) {
      throw ApiError.forbidden('That file belongs to another account.')
    }

    res.json({ file: file.toJSON() })
  }),
)

/**
 * Records the outcome of a decryption attempt. The actual decryption happens in
 * the browser — the server is told only whether the authentication tag verified,
 * so it can maintain the audit trail and the failed-attempt lockout.
 */
router.post(
  '/:id/decrypt-attempt',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { success } = z.object({ success: z.boolean() }).parse(req.body)
    const user = req.currentUser!

    const file = await VaultFile.findById(req.params.id)
    if (!file) throw ApiError.notFound('File not found')
    if (user.role === 'employee' && String(file.owner) !== String(user._id)) {
      throw ApiError.forbidden('That file belongs to another account.')
    }

    if (success) {
      file.status = 'decrypted'
      file.lastDecryptedAt = new Date()
      await file.save()

      user.failedDecryptAttempts = 0
      await user.save()

      await recordLog({
        user,
        action: 'decrypt_success',
        status: 'success',
        detail: `${file.encryptedName} decrypted and downloaded`,
        provider: file.provider,
        req,
      })

      emitToUserAndAdmins(String(user._id), 'file:updated', file.toJSON())
      return res.json({ ok: true, attempts: 0, locked: false })
    }

    const attempts = user.failedDecryptAttempts + 1
    user.failedDecryptAttempts = attempts
    await user.save()

    await recordLog({
      user,
      action: 'decrypt_failed',
      status: 'failed',
      detail: `Invalid decryption key — attempt ${attempts} of 3 on ${file.encryptedName}`,
      provider: file.provider,
      req,
    })

    // Three strikes raises a critical alert for the admin, who decides whether
    // to revoke. The account is not auto-suspended — a genuine mistyped key
    // shouldn't lock someone out without a human looking.
    if (attempts >= 3) {
      file.status = 'failed'
      await file.save()

      const alert = await SecurityAlert.create({
        severity: 'critical',
        title: 'Repeated invalid decryption key',
        detail: `${user.name} submitted ${attempts} consecutive invalid keys for ${file.encryptedName}.`,
        user: user._id,
        userName: user.name,
        attempts,
      })

      emitToAdmins('alert:created', alert.toJSON())
      return res.json({ ok: false, attempts, locked: true })
    }

    res.json({ ok: false, attempts, locked: false })
  }),
)

export default router
