import type { NextFunction, Request, RequestHandler, Response } from 'express'

/** Express 4 does not catch rejections from async handlers — an unhandled one
 *  hangs the request instead of reaching the error middleware. Wrap every async
 *  route in this. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
