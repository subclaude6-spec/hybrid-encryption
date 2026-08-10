import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { User, type Role, type UserDocument } from '../models/User'
import { ApiError } from '../utils/ApiError'
import { asyncHandler } from '../utils/asyncHandler'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      currentUser?: UserDocument
    }
  }
}

/** Loads the session user and rejects anyone suspended mid-session — a revoked
 *  employee loses access on their next request, not at their next login. */
export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const userId = req.session.userId
  if (!userId) throw ApiError.unauthorized()

  const user = await User.findById(userId)
  if (!user) {
    req.session.destroy(() => undefined)
    throw ApiError.unauthorized('Session no longer valid')
  }

  if (user.status === 'suspended') {
    throw ApiError.forbidden('Your access has been revoked by an administrator')
  }
  if (user.status === 'pending') {
    throw ApiError.forbidden('Your account is awaiting administrator approval')
  }

  req.currentUser = user
  next()
})

export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.currentUser) return next(ApiError.unauthorized())
    if (!roles.includes(req.currentUser.role)) {
      return next(ApiError.forbidden())
    }
    next()
  }
}

/** Employees are hard-scoped to their own records; admins may pass an explicit
 *  target. Route handlers use this instead of trusting a client-supplied id. */
export function resolveScopeUserId(req: Request, requestedUserId?: string): string | null {
  const user = req.currentUser
  if (!user) return null
  if (user.role === 'employee') return String(user._id)
  return requestedUserId ?? null
}
