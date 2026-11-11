import type { ErrorRequestHandler, RequestHandler } from 'express'
import { MongooseError } from 'mongoose'
import { ZodError } from 'zod'
import { isProd } from '../config/env'
import { ApiError } from '../utils/ApiError'

interface ProviderErrorLike {
  response?: {
    status?: number
    data?: {
      error?: {
        message?: string
        status?: string
      }
    }
  }
}

function isProviderApiError(error: unknown): error is ProviderErrorLike {
  if (!error || typeof error !== 'object') return false
  const response = (error as ProviderErrorLike).response
  return Boolean(response && typeof response.status === 'number')
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`))
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  // A response already in flight (e.g. a static file send aborted mid-stream
  // by the client navigating away) can't be re-sent — headers are committed.
  // Handing off to Express's default handler just closes the connection.
  if (res.headersSent) {
    next(err)
    return
  }

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

  // Cloud SDKs expose upstream failures as errors with a response object.
  // Translate them instead of hiding expired credentials, permissions, and
  // quota failures behind an unhelpful 500.
  if (isProviderApiError(err)) {
    const upstreamStatus = err.response?.status ?? 502
    const status =
      upstreamStatus >= 400 && upstreamStatus < 500 && upstreamStatus !== 408
        ? upstreamStatus
        : 502
    const upstreamMessage = err.response?.data?.error?.message
    const message =
      upstreamStatus === 401
        ? 'Cloud provider authorization expired or was revoked. Disconnect and reconnect the account.'
        : upstreamStatus === 403
          ? 'Cloud provider denied this operation. Check that the provider API is enabled and the account has access.'
          : upstreamMessage ?? 'Cloud provider request failed. Check the server logs for details.'

    console.error('Cloud provider request failed:', {
      status: upstreamStatus,
      message: upstreamMessage,
    })
    res.status(status).json({
      error: {
        code: 'provider_api_error',
        message,
        ...(!isProd && { details: upstreamMessage }),
      },
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
