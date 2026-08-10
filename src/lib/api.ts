/**
 * Thin fetch wrapper for the Express API.
 *
 * Requests go to a relative `/api/...` path, which Vite proxies to the server
 * in dev. Same-origin means the session cookie travels automatically and
 * WebAuthn sees one consistent origin.
 */

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown }
}

export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init

  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...rest,
      credentials: 'include',
      headers: {
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    })
  } catch {
    // fetch only rejects on network-level failure, which almost always means
    // the API process isn't running.
    throw new ApiRequestError(
      0,
      'network_error',
      'Cannot reach the server. Is the API running on port 5000?',
    )
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const payload = text ? (JSON.parse(text) as unknown) : null

  if (!response.ok) {
    const body = payload as ApiErrorBody | null
    throw new ApiRequestError(
      response.status,
      body?.error?.code ?? 'error',
      body?.error?.message ?? `Request failed with status ${response.status}`,
      body?.error?.details,
    )
  }

  return payload as T
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, json?: unknown) => request<T>(path, { method: 'POST', json }),
  patch: <T>(path: string, json?: unknown) => request<T>(path, { method: 'PATCH', json }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
