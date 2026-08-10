import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth'
import { SecurityAlert } from '../models/SecurityAlert'
import { emitToAdmins } from '../realtime/socket'
import { ApiError } from '../utils/ApiError'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

// Alerts are an administrator surface end to end — employees never see them,
// not even their own.
router.use(requireAuth, requireRole('admin'))

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { resolved } = z
      .object({ resolved: z.enum(['0', '1']).optional() })
      .parse(req.query)

    const filter: Record<string, unknown> = {}
    if (resolved) filter.resolved = resolved === '1'

    const alerts = await SecurityAlert.find(filter).sort({ createdAt: -1 }).limit(200)
    res.json({ alerts: alerts.map((alert) => alert.toJSON()) })
  }),
)

router.post(
  '/:id/resolve',
  asyncHandler(async (req, res) => {
    const alert = await SecurityAlert.findById(req.params.id)
    if (!alert) throw ApiError.notFound('Alert not found')

    alert.resolved = true
    alert.resolvedBy = req.currentUser!._id
    alert.resolvedAt = new Date()
    await alert.save()

    emitToAdmins('alert:updated', alert.toJSON())
    res.json({ alert: alert.toJSON() })
  }),
)

export default router
