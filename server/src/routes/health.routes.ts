import { Router } from 'express'
import mongoose from 'mongoose'
import { features } from '../config/env'
import { verifyChain } from '../services/log.service'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

// mongoose.ConnectionStates: 0-3 plus 99 (uninitialized), so not a dense tuple.
const DB_STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
  99: 'uninitialized',
}

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    database: {
      state: DB_STATES[mongoose.connection.readyState] ?? 'unknown',
      name: mongoose.connection.name ?? null,
    },
    features,
  })
})

/** Recomputes the whole audit chain. Useful as a demo of tamper-evidence:
 *  edit a log document in Atlas, hit this, watch it report the break. */
router.get(
  '/audit-chain',
  asyncHandler(async (_req, res) => {
    res.json(await verifyChain())
  }),
)

export default router
