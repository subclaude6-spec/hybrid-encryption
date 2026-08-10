import type { ErrorRequestHandler, RequestHandler } from 'express'
import { MongooseError } from 'mongoose'
import { ZodError } from 'zod'
import { isProd } from '../config/env'
import { ApiError } from '../utils/ApiError'

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`))
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    })
    return
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    })
    return
  }

  // Duplicate key — almost always a repeated email on user creation.
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    res.status(409).json({
      error: { code: 'conflict', message: 'That record already exists' },
    })
    return
  }

  if (err instanceof MongooseError) {
    res.status(400).json({
      error: { code: 'database_error', message: err.message },
    })
    return
  }

  console.error('Unhandled error:', err)
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong',
      ...(isProd ? {} : { details: (err as Error)?.stack }),
    },
  })
}
