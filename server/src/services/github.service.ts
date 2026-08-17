import { Readable } from 'node:stream'
import { Types } from 'mongoose'
import { env, features } from '../config/env'
import { User, type UserDocument } from '../models/User'
import { ApiError } from '../utils/ApiError'

/**
 * GitHub integration.
 *
 * GitHub has no Drive-like blob store — the "cloud storage" here is a repo
 * the user picks (or creates) on the frontend, and files live in it as
 * commits via the Contents API. Unlike Drive's `drive.file` scope, GitHub
 * has no way to scope an OAuth App down to "only files this app created" —
 * `repo` grants access to all of the account's private repos, which is a
 * real privacy trade-off worth knowing about, not an oversight.
 *
 * The Contents API takes the whole file body as base64 in one JSON request
 * (no streaming upload), so uploads are buffered in memory here, capped by
 * MAX_UPLOAD_BYTES below — a deliberate difference from google.service.ts's
 * true streaming.
 */
const SCOPES = ['repo', 'user:email']
const GITHUB_API = 'https://api.github.com'
export const MAX_UPLOAD_BYTES = 100 * 1024 ** 2

function assertConfigured() {
  if (!features.github) {
    throw ApiError.badRequest(
      'GitHub is not configured on this server. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env, then restart.',
    )
  }
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

/** Every GitHub error body has a `message` field — surfaced as-is since it's
 *  already written for humans (e.g. "Bad credentials", "Not Found"). */
async function githubJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw ApiError.badRequest(
      (body as { message?: string } | null)?.message ?? `GitHub request failed (${response.status})`,
    )
  }
  return response.json() as Promise<T>
}

/* --------------------------------------------------------------- consent */

export function buildConsentUrl(state: string): string {
  assertConfigured()
  const qs = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID!,
    redirect_uri: env.GITHUB_REDIRECT_URI,
    scope: SCOPES.join(' '),
    state,
    allow_signup: 'false',
  })
  return `https://github.com/login/oauth/authorize?${qs.toString()}`
}

export interface LinkedAccount {
  accountId: string
  accountEmail: string
}

export async function exchangeCode(code: string, user: UserDocument): Promise<LinkedAccount> {
  assertConfigured()

  const tokenResponse = await githubJson<{
    access_token?: string
    scope?: string
    error?: string
    error_description?: string
  }>('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_REDIRECT_URI,
    }),
  })

  if (!tokenResponse.access_token) {
    throw ApiError.badRequest(tokenResponse.error_description ?? 'GitHub did not return an access token.')
  }
  const token = tokenResponse.access_token

  const profile = await githubJson<{ login: string; id: number }>(`${GITHUB_API}/user`, {
    headers: authHeaders(token),
  })

  // `login` (not email) doubles as this account's identifier here — it's
  // what every Contents API call needs as the repo owner, and GitHub emails
  // are frequently private anyway. The UI just shows it in the same slot
  // Drive shows an email in.
  const accountEmail = profile.login

  const tokenFields = {
    accessToken: token,
    refreshToken: null,
    expiryDate: null,
    scope: tokenResponse.scope ?? SCOPES.join(' '),
  }

  const existing = user.providerAccounts.find(
    (a) => a.provider === 'github' && a.accountEmail.toLowerCase() === accountEmail.toLowerCase(),
  )

  if (existing) {
    await User.updateOne(
      { _id: user._id, 'providerAccounts._id': existing._id },
      {
        $set: {
          'providerAccounts.$.accessToken': tokenFields.accessToken,
          'providerAccounts.$.scope': tokenFields.scope,
        },
      },
    )
    return { accountId: String(existing._id), accountEmail }
  }

  const account = {
    _id: new Types.ObjectId(),
    provider: 'github' as const,
    accountEmail,
    ...tokenFields,
    connectedAt: new Date(),
  }
  await User.updateOne({ _id: user._id }, { $push: { providerAccounts: account } })

  return { accountId: String(account._id), accountEmail }
}

/* --------------------------------------------------------------- client */

async function getGithubAccount(userId: string, accountId: string) {
  assertConfigured()

  const user = await User.findById(userId).select('+providerAccounts.accessToken')
  const account = user?.providerAccounts.find(
    (a) => a.provider === 'github' && String(a._id) === accountId,
  )

  if (!user || !account) {
    throw ApiError.badRequest('That GitHub account is not connected to your profile.')
  }

  // accountEmail holds the GitHub login for this provider — see exchangeCode.
  return { token: account.accessToken, login: account.accountEmail }
}

export async function disconnect(userId: string, accountId: string) {
  await User.updateOne(
    { _id: userId },
    { $pull: { providerAccounts: { _id: accountId, provider: 'github' } } },
  )
}

/* ----------------------------------------------------------------- repo */

export interface RepoSummary {
  name: string
  private: boolean
  description: string | null
  updatedAt: string
}

/** Repos this account owns outright — Contents API writes need push access,
 *  and "owner" is the one affiliation that's guaranteed to have it. */
export async function listRepos(userId: string, accountId: string): Promise<RepoSummary[]> {
  const { token } = await getGithubAccount(userId, accountId)

  const repos: RepoSummary[] = []
  let page = 1
  // GitHub caps per_page at 100; a handful of pages comfortably covers even
  // a very active account without pulling in pagination-link parsing.
  for (; page <= 5; page++) {
    const response = await fetch(
      `${GITHUB_API}/user/repos?affiliation=owner&per_page=100&page=${page}&sort=updated`,
      { headers: authHeaders(token) },
    )
    if (!response.ok) throw ApiError.badRequest(`Could not list GitHub repos (status ${response.status}).`)

    type Entry = { name: string; private: boolean; description: string | null; updated_at: string }
    const batch = (await response.json()) as Entry[]
    repos.push(
      ...batch.map((r) => ({
        name: r.name,
        private: r.private,
        description: r.description,
        updatedAt: r.updated_at,
      })),
    )
    if (batch.length < 100) break
  }

  return repos
}

export async function createRepo(userId: string, accountId: string, name: string): Promise<RepoSummary> {
  const { token } = await getGithubAccount(userId, accountId)

  const created = await githubJson<{ name: string; private: boolean; description: string | null; updated_at: string }>(
    `${GITHUB_API}/user/repos`,
    {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        private: true,
        description: 'Encrypted vault for Hybrid Cloud Encryption. Every file here is ciphertext.',
        auto_init: true,
      }),
    },
  )

  return {
    name: created.name,
    private: created.private,
    description: created.description,
    updatedAt: created.updated_at,
  }
}

/** A clear "that repo doesn't exist (or isn't yours)" error beats a Contents
 *  API 404 that a client can't easily tell apart from "file not found". */
async function assertRepoAccess(token: string, login: string, repo: string): Promise<void> {
  const check = await fetch(`${GITHUB_API}/repos/${login}/${repo}`, { headers: authHeaders(token) })
  if (check.ok) return
  if (check.status === 404) {
    throw ApiError.badRequest(`Repository "${repo}" wasn't found on this GitHub account.`)
  }
  throw ApiError.badRequest(`Could not reach GitHub (status ${check.status}).`)
}

/* --------------------------------------------------------------- upload */

export interface UploadResult {
  fileId: string
  name: string
  webViewLink: string | null
  sizeBytes: number
  accountEmail: string
}

/** `buffer` must already be fully read — the Contents API takes one base64
 *  JSON body, so there's no streaming path the way Drive has. */
export async function uploadEncrypted(args: {
  userId: string
  accountId: string
  repo: string
  name: string
  buffer: Buffer
}): Promise<UploadResult> {
  const { token, login } = await getGithubAccount(args.userId, args.accountId)
  await assertRepoAccess(token, login, args.repo)

  const data = await githubJson<{ content: { sha: string; size: number; path: string; name: string; html_url: string | null } }>(
    `${GITHUB_API}/repos/${login}/${args.repo}/contents/${encodeURIComponent(args.name)}`,
    {
      method: 'PUT',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Add ${args.name}`,
        content: args.buffer.toString('base64'),
      }),
    },
  )

  return {
    fileId: data.content.path,
    name: data.content.name,
    webViewLink: data.content.html_url,
    sizeBytes: data.content.size,
    accountEmail: login,
  }
}

/* ------------------------------------------------------------ listing */

export interface GithubFileSummary {
  id: string
  name: string
  sizeBytes: number
  modifiedAt: string
  mimeType: string
  encrypted: boolean
  webViewLink: string | null
}

export async function listFiles(args: {
  userId: string
  accountId: string
  repo: string
  search?: string
  onlyEncrypted?: boolean
}): Promise<{ files: GithubFileSummary[]; nextPageToken: string | null }> {
  const { token, login } = await getGithubAccount(args.userId, args.accountId)

  const listing = await fetch(`${GITHUB_API}/repos/${login}/${args.repo}/contents/`, {
    headers: authHeaders(token),
  })
  // The repo doesn't exist until the first upload creates it — an empty
  // vault, not an error.
  if (listing.status === 404) return { files: [], nextPageToken: null }
  if (!listing.ok) throw ApiError.badRequest(`Could not list GitHub files (status ${listing.status}).`)

  type Entry = { name: string; path: string; size: number; type: string; html_url: string | null }
  const entries = ((await listing.json()) as Entry[]).filter((e) => e.type === 'file')

  const filtered = entries.filter((entry) => {
    if (args.onlyEncrypted && !entry.name.endsWith('.hce')) return false
    if (args.search?.trim() && !entry.name.toLowerCase().includes(args.search.trim().toLowerCase())) {
      return false
    }
    return true
  })

  // The Contents listing endpoint doesn't include a modified date — one more
  // request per file gets the real one from its most recent commit. Fine at
  // vault-repo scale (this isn't meant to hold thousands of files).
  const files = await Promise.all(
    filtered.map(async (entry) => {
      let modifiedAt = new Date().toISOString()
      try {
        const commits = await fetch(
          `${GITHUB_API}/repos/${login}/${args.repo}/commits?path=${encodeURIComponent(entry.path)}&per_page=1`,
          { headers: authHeaders(token) },
        )
        if (commits.ok) {
          const [latest] = (await commits.json()) as Array<{ commit: { author: { date: string } } }>
          if (latest) modifiedAt = latest.commit.author.date
        }
      } catch {
        // Fine to fall back to "now" — this only affects a display timestamp.
      }
      return {
        id: entry.path,
        name: entry.name,
        sizeBytes: entry.size,
        modifiedAt,
        mimeType: 'application/octet-stream',
        encrypted: entry.name.endsWith('.hce'),
        webViewLink: entry.html_url,
      }
    }),
  )

  return { files, nextPageToken: null }
}

/* ------------------------------------------------------------ download */

export async function downloadFile(userId: string, accountId: string, repo: string, fileId: string) {
  const { token, login } = await getGithubAccount(userId, accountId)

  const response = await fetch(
    `${GITHUB_API}/repos/${login}/${repo}/contents/${encodeURIComponent(fileId)}`,
    { headers: { ...authHeaders(token), Accept: 'application/vnd.github.raw+json' } },
  )
  if (!response.ok || !response.body) {
    throw ApiError.notFound('That file is no longer on GitHub.')
  }

  return {
    name: fileId,
    sizeBytes: Number(response.headers.get('content-length') ?? 0),
    stream: Readable.fromWeb(response.body as import('stream/web').ReadableStream),
  }
}

export async function deleteFile(userId: string, accountId: string, repo: string, fileId: string) {
  const { token, login } = await getGithubAccount(userId, accountId)

  const meta = await githubJson<{ sha: string }>(
    `${GITHUB_API}/repos/${login}/${repo}/contents/${encodeURIComponent(fileId)}`,
    { headers: authHeaders(token) },
  )

  const del = await fetch(
    `${GITHUB_API}/repos/${login}/${repo}/contents/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Delete ${fileId}`, sha: meta.sha }),
    },
  )
  if (!del.ok) throw ApiError.badRequest(`Could not delete that file on GitHub (status ${del.status}).`)
}
