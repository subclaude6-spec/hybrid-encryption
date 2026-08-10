/* eslint-disable @typescript-eslint/no-explicit-any */

/** Mongoose types the `ret` argument as the strict document shape, which makes
 *  the usual `_id` → `id` rename and any field redaction fail to compile. The
 *  serialised form is deliberately a different shape from the document, so a
 *  loose record is the honest type here. */
type JsonRecord = Record<string, any>

/**
 * Standard document serialiser: exposes `id`, drops `_id`/`__v`, and runs an
 * optional hook for per-model renames or redaction.
 */
export function jsonTransform(extra?: (ret: JsonRecord) => void) {
  return function transform(_doc: any, ret: JsonRecord) {
    ret.id = String(ret._id)
    delete ret._id
    delete ret.__v
    extra?.(ret)
    return ret
  }
}

/** Timestamped records expose `at` as well, matching the frontend's log/alert types. */
export const jsonTransformWithAt = jsonTransform((ret) => {
  ret.at = ret.createdAt
})
