import crypto from 'node:crypto'
import type { Request } from 'express'
import { LogEntry, type LogAction, type LogStatus } from '../models/LogEntry'
import type { ProviderId, UserDocument } from '../models/User'
import { emitToUserAndAdmins } from '../realtime/socket'

const GENESIS_HASH = '0'.repeat(64)

interface LogInput {
  user: Pick<UserDocument, '_id' | 'name'>
  action: LogAction
  status: LogStatus
  detail: string
  provider?: ProviderId | null
  req?: Request
}

/** Hash over the fields a tamperer would want to change, chained to the
 *  previous entry. Field order is fixed — changing it invalidates every
 *  existing chain, so treat this function as append-only. */
function computeHash(input: {
  prevHash: string
  userId: string
  action: string
  status: string
  detail: string
  createdAt: string
}): string {
  const canonical = [
    input.prevHash,
    input.userId,
    input.action,
    input.status,
    input.detail,
    input.createdAt,
  ].join('|')
  return crypto.createHash('sha256').update(canonical).digest('hex')
}

function clientIp(req?: Request): string {
  if (!req) return 'system'
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0]!.trim()
  return req.ip ?? 'unknown'
}

function clientDevice(req?: Request): string {
  if (!req) return 'server'
  return req.headers['user-agent']?.slice(0, 200) ?? 'unknown'
}

/**
 * Appends a tamper-evident audit entry and pushes it to connected clients.
 *
 * Note: the prevHash read and the insert are not atomic. Under genuinely
 * concurrent writes two entries can claim the same predecessor, which
 * verifyChain reports as a fork. Fine at this scale; if it ever matters,
 * move the tail pointer into a single-document counter and update it with
 * findOneAndUpdate.
 */
export async function recordLog(input: LogInput) {
  const previous = await LogEntry.findOne().sort({ createdAt: -1 }).lean()
  const prevHash = previous?.hash ?? GENESIS_HASH
  const createdAt = new Date()

  const hash = computeHash({
    prevHash,
    userId: String(input.user._id),
    action: input.action,
    status: input.status,
    detail: input.detail,
    createdAt: createdAt.toISOString(),
  })

  const entry = await LogEntry.create({
    user: input.user._id,
    userName: input.user.name,
    action: input.action,
    status: input.status,
    detail: input.detail,
    provider: input.provider ?? null,
    ip: clientIp(input.req),
    device: clientDevice(input.req),
    prevHash,
    hash,
    createdAt,
  })

  emitToUserAndAdmins(String(input.user._id), 'log:created', entry.toJSON())
  return entry
}

export interface ChainVerification {
  valid: boolean
  checked: number
  brokenAt: string | null
}

/** Walks the chain oldest-first and reports the first entry whose stored hash
 *  disagrees with its recomputed value. */
export async function verifyChain(): Promise<ChainVerification> {
  const entries = await LogEntry.find().sort({ createdAt: 1 }).lean()
  let expectedPrev = GENESIS_HASH

  for (const entry of entries) {
    const recomputed = computeHash({
      prevHash: entry.prevHash,
      userId: String(entry.user),
      action: entry.action,
      status: entry.status,
      detail: entry.detail,
      createdAt: new Date(entry.createdAt).toISOString(),
    })

    if (entry.prevHash !== expectedPrev || recomputed !== entry.hash) {
      return { valid: false, checked: entries.length, brokenAt: String(entry._id) }
    }
    expectedPrev = entry.hash
  }

  return { valid: true, checked: entries.length, brokenAt: null }
}
