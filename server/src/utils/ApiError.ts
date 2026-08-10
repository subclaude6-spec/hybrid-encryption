/** An error with an HTTP status attached, so the error middleware can respond
 *  properly instead of turning every failure into a 500. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    Error.captureStackTrace(this, ApiError)
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, 'bad_request', details)
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message, 'unauthorized')
  }

  static forbidden(message = 'You do not have access to this resource') {
    return new ApiError(403, message, 'forbidden')
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, message, 'not_found')
  }

  static conflict(message: string) {
    return new ApiError(409, message, 'conflict')
  }

  static tooManyRequests(message = 'Too many attempts') {
    return new ApiError(429, message, 'too_many_requests')
  }
}
