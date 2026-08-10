import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole, resolveScopeUserId } from '../middleware/auth'
import { LogEntry } from '../models/LogEntry'
import { verifyChain } from '../services/log.service'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        userId: z.string().optional(),
        status: z.enum(['success', 'failed', 'warning']).optional(),
        action: z.string().optional(),
        search: z.string().optional(),
        limit: z.coerce.number().min(1).max(500).default(200),
      })
      .parse(req.query)

    // An employee's `userId` parameter is ignored — resolveScopeUserId pins
    // them to their own id regardless of what they ask for.
    const scopedUserId = resolveScopeUserId(req, query.userId)

    const filter: Record<string, unknown> = {}
    if (scopedUserId) filter.user = scopedUserId
    if (query.status) filter.status = query.status
    if (query.action) filter.action = query.action
    if (query.search?.trim()) {
      const safe = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [
        { detail: { $regex: safe, $options: 'i' } },
        { userName: { $regex: safe, $options: 'i' } },
      ]
    }

    const logs = await LogEntry.find(filter).sort({ createdAt: -1 }).limit(query.limit)
    res.json({ logs: logs.map((log) => log.toJSON()) })
  }),
)

/** Recomputes the hash chain. Admin-only: it reads every entry in the log. */
router.get(
  '/verify',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    res.json(await verifyChain())
  }),
)

export default router
