import type { Readable } from 'node:stream'
import { Types } from 'mongoose'
import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import { env, features } from '../config/env'
import { User, type UserDocument } from '../models/User'
import { ApiError } from '../utils/ApiError'

/**
 * Google Drive integration.
 *
 * Scope is deliberately `drive.file`: the app can only see files it created
 * itself. It cannot read the user's existing Drive, which means no Google
 * security review, and a compromise here can't expose unrelated documents.
 *
 * Ciphertext streams straight through this server to Drive without being
 * buffered or written to disk, and the OAuth tokens never reach the browser.
 */
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
]

/** Folder the app creates and uploads into, so encrypted files stay together. */
const FOLDER_NAME = 'Hybrid Cloud Encryption'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

function assertConfigured() {
  if (!features.googleDrive) {
    throw ApiError.badRequest(
      'Google Drive is not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, then restart.',
    )
  }
}

function createOAuthClient(): OAuth2Client {
  assertConfigured()
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  )
}

/* ---------------------------------------------------- sign-in with Google */

/** Identity-only scopes. Signing in grants no access to the user's Drive —
 *  that is a separate consent, with its own redirect URI. */
const LOGIN_SCOPES = ['openid', 'email', 'profile']

function createLoginClient(): OAuth2Client {
  assertConfigured()
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_LOGIN_REDIRECT_URI,
  )
}

export function buildLoginUrl(state: string): string {
  return createLoginClient().generateAuthUrl({
    scope: LOGIN_SCOPES,
    state,
    prompt: 'select_account',
  })
}

export interface GoogleIdentity {
  googleId: string
  email: string
  name: string
  emailVerified: boolean
}

export async function exchangeLoginCode(code: string): Promise<GoogleIdentity> {
  const client = createLoginClient()
  const { tokens } = await client.getToken(code)

  if (!tokens.id_token) {
    throw ApiError.badRequest('Google did not return an identity token.')
  }

  // Verifying the ID token checks Google's signature and that the token was
  // issued for this client — reading the payload without this would let a
  // token minted for a different app be replayed here.
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  })
  const payload = ticket.getPayload()

  if (!payload?.sub || !payload.email) {
    throw ApiError.badRequest('Google did not return an email address.')
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name ?? payload.email,
    emailVerified: Boolean(payload.email_verified),
  }
}

/* -------------------------------------------------------------- consent */

export function buildConsentUrl(state: string): string {
  const client = createOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline', // required to receive a refresh token
    scope: SCOPES,
    state,
    // Without this, a second authorisation returns no refresh token and the
    // connection silently dies when the first access token expires.
    // `select_account` forces Google's account chooser every time, even if
    // the browser only has one Google session — that's what lets someone
    // deliberately link a Drive account that differs from how they log in,
    // or add a second/third Drive account instead of always reusing the
    // first one Google offers.
    prompt: 'select_account consent',
    include_granted_scopes: true,
  })
}

export interface LinkedAccount {
  accountId: string
  accountEmail: string
}

export async function exchangeCode(code: string, user: UserDocument): Promise<LinkedAccount> {
  const client = createOAuthClient()
  const { tokens } = await client.getToken(code)

  if (!tokens.refresh_token) {
    throw ApiError.badRequest(
      'Google did not return a refresh token. Remove this app at myaccount.google.com/permissions and connect again.',
    )
  }

  client.setCredentials(tokens)
  const info = await google.oauth2({ version: 'v2', auth: client }).userinfo.get()
  const accountEmail = info.data.email ?? user.email

  const tokenFields = {
    accessToken: tokens.access_token ?? '',
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scope: tokens.scope ?? SCOPES.join(' '),
  }

  // Re-authorising the same email refreshes that account's tokens in place;
  // a different email is linked as an additional account rather than
  // replacing the existing one.
  const existing = user.providerAccounts.find(
    (a) => a.provider === 'gdrive' && a.accountEmail.toLowerCase() === accountEmail.toLowerCase(),
  )

  if (existing) {
    await User.updateOne(
      { _id: user._id, 'providerAccounts._id': existing._id },
      {
        $set: {
          'providerAccounts.$.accessToken': tokenFields.accessToken,
          'providerAccounts.$.refreshToken': tokenFields.refreshToken,
          'providerAccounts.$.expiryDate': tokenFields.expiryDate,
          'providerAccounts.$.scope': tokenFields.scope,
        },
      },
    )
    return { accountId: String(existing._id), accountEmail }
  }

  const account = {
    _id: new Types.ObjectId(),
    provider: 'gdrive' as const,
    accountEmail,
    ...tokenFields,
    connectedAt: new Date(),
  }
  await User.updateOne({ _id: user._id }, { $push: { providerAccounts: account } })

  return { accountId: String(account._id), accountEmail }
}

/* --------------------------------------------------------------- client */

/**
 * Returns a Drive client authorised as one specific connected account,
 * refreshing its access token if needed and persisting the refreshed one so
 * the next request starts warm. `accountId` picks which of the user's
 * (possibly several) linked Google accounts to act as.
 */
export async function getDriveClient(userId: string, accountId: string) {
  assertConfigured()

  const user = await User.findById(userId).select(
    '+providerAccounts.accessToken +providerAccounts.refreshToken',
  )
  const account = user?.providerAccounts.find(
    (a) => a.provider === 'gdrive' && String(a._id) === accountId,
  )

  if (!user || !account) {
    throw ApiError.badRequest('That Google Drive account is not connected to your profile.')
  }

  const client = createOAuthClient()
  client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.expiryDate?.getTime() ?? undefined,
  })

  client.on('tokens', (tokens) => {
    if (!tokens.access_token) return
    void User.updateOne(
      { _id: user._id, 'providerAccounts._id': account._id },
      {
        $set: {
          'providerAccounts.$.accessToken': tokens.access_token,
          'providerAccounts.$.expiryDate': tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : null,
        },
      },
    ).exec()
  })

  return { drive: google.drive({ version: 'v3', auth: client }), accountEmail: account.accountEmail }
}

export async function disconnect(userId: string, accountId: string) {
  await User.updateOne(
    { _id: userId },
    { $pull: { providerAccounts: { _id: accountId, provider: 'gdrive' } } },
  )
}

/* --------------------------------------------------------------- folder */

/** Finds or creates the app's folder. Cheap enough to call per upload. */
async function ensureFolder(drive: ReturnType<typeof google.drive>): Promise<string> {
  const existing = await drive.files.list({
    q: `name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`,
    fields: 'files(id,name)',
    pageSize: 1,
  })

  const found = existing.data.files?.[0]?.id
  if (found) return found

  const created = await drive.files.create({
    requestBody: { name: FOLDER_NAME, mimeType: FOLDER_MIME },
    fields: 'id',
  })
  return created.data.id!
}

/* --------------------------------------------------------------- upload */

export interface UploadResult {
  fileId: string
  name: string
  webViewLink: string | null
  sizeBytes: number
  accountEmail: string
}

/**
 * Streams an already-encrypted body to Drive. `body` is the request stream, so
 * a multi-gigabyte upload never lands in this process's memory.
 */
export async function uploadEncrypted(args: {
  userId: string
  accountId: string
  name: string
  body: Readable
}): Promise<UploadResult> {
  const { drive, accountEmail } = await getDriveClient(args.userId, args.accountId)
  const folderId = await ensureFolder(drive)

  const created = await drive.files.create({
    requestBody: {
      name: args.name,
      parents: [folderId],
      // Generic type on purpose — Drive should not try to interpret ciphertext.
      mimeType: 'application/octet-stream',
      description: 'Encrypted with Hybrid Cloud Encryption (AES-256-GCM)',
    },
    media: { mimeType: 'application/octet-stream', body: args.body },
    fields: 'id,name,size,webViewLink',
  })

  return {
    fileId: created.data.id!,
    name: created.data.name ?? args.name,
    webViewLink: created.data.webViewLink ?? null,
    sizeBytes: Number(created.data.size ?? 0),
    accountEmail,
  }
}

/* ------------------------------------------------------------ listing */

export interface DriveFileSummary {
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
  search?: string
  onlyEncrypted?: boolean
  pageToken?: string
}): Promise<{ files: DriveFileSummary[]; nextPageToken: string | null }> {
  const { drive } = await getDriveClient(args.userId, args.accountId)

  const clauses = ['trashed=false']
  if (args.search?.trim()) {
    // Escape single quotes — a name containing one would break the query.
    clauses.push(`name contains '${args.search.trim().replace(/'/g, "\\'")}'`)
  }
  if (args.onlyEncrypted) clauses.push("name contains '.hce'")

  const response = await drive.files.list({
    q: clauses.join(' and '),
    fields: 'nextPageToken, files(id,name,size,modifiedTime,mimeType,webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: 100,
    pageToken: args.pageToken,
  })

  const files = (response.data.files ?? []).map((file) => ({
    id: file.id!,
    name: file.name ?? 'untitled',
    sizeBytes: Number(file.size ?? 0),
    modifiedAt: file.modifiedTime ?? new Date().toISOString(),
    mimeType: file.mimeType ?? 'application/octet-stream',
    encrypted: (file.name ?? '').endsWith('.hce'),
    webViewLink: file.webViewLink ?? null,
  }))

  return { files, nextPageToken: response.data.nextPageToken ?? null }
}

/* ------------------------------------------------------------ download */

/** Returns a stream of the raw (still encrypted) bytes. */
export async function downloadFile(userId: string, accountId: string, fileId: string) {
  const { drive } = await getDriveClient(userId, accountId)

  const meta = await drive.files.get({ fileId, fields: 'id,name,size,mimeType' })
  const stream = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' },
  )

  return {
    name: meta.data.name ?? 'download.hce',
    sizeBytes: Number(meta.data.size ?? 0),
    stream: stream.data as Readable,
  }
}

export async function deleteFile(userId: string, accountId: string, fileId: string) {
  const { drive } = await getDriveClient(userId, accountId)
  await drive.files.delete({ fileId })
}
