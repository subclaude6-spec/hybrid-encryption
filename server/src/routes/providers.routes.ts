import crypto from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { env, features } from '../config/env'
import { requireAuth } from '../middleware/auth'
import { User } from '../models/User'
import { VaultFile } from '../models/VaultFile'
import {
  buildConsentUrl,
  deleteFile,
  disconnect,
  downloadFile,
  exchangeCode,
  listFiles,
  uploadEncrypted,
} from '../services/google.service'
import {
  MAX_UPLOAD_BYTES as GITHUB_MAX_UPLOAD_BYTES,
  buildConsentUrl as buildGithubConsentUrl,
  createRepo as createGithubRepo,
  deleteFile as deleteGithubFile,
  disconnect as disconnectGithub,
  downloadFile as downloadGithubFile,
  exchangeCode as exchangeGithubCode,
  listFiles as listGithubFiles,
  listRepos as listGithubRepos,
  uploadEncrypted as uploadGithubEncrypted,
} from '../services/github.service'
import { recordLog } from '../services/log.service'
import { emitToUserAndAdmins } from '../realtime/socket'
import { ApiError } from '../utils/ApiError'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

/** Sends the browser back into the SPA (HashRouter) with a status to display. */
function backToApp(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params).toString()
  return `${env.CLIENT_URL}/#${path}?${query}`
}

/* ------------------------------------------------------------ overview */

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.currentUser!
    const accountsFor = (provider: 'gdrive' | 'github') =>
      user.providerAccounts
        .filter((account) => account.provider === provider)
        .map((account) => ({
          id: String(account._id),
          email: account.accountEmail,
          connectedAt: account.connectedAt,
        }))

    res.json({
      providers: [
        {
          id: 'gdrive',
          name: 'Google Drive',
          available: features.googleDrive,
          accounts: accountsFor('gdrive'),
        },
        {
          id: 'github',
          name: 'GitHub',
          available: features.github,
          accounts: accountsFor('github'),
        },
        { id: 'dropbox', name: 'Dropbox', available: false, accounts: [] },
        { id: 'onedrive', name: 'OneDrive', available: false, accounts: [] },
        { id: 'mega', name: 'MEGA', available: false, accounts: [] },
      ],
    })
  }),
)

/* --------------------------------------------------------------- OAuth */

router.get(
  '/google/connect',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Random state, checked on return, so a forged callback can't bind someone
    // else's Google account to this session.
    const state = crypto.randomBytes(24).toString('hex')
    req.session.oauthState = state
    await new Promise<void>((resolve, reject) =>
      req.session.save((error) => (error ? reject(error) : resolve())),
    )
    res.redirect(buildConsentUrl(state))
  }),
)

router.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      code: z.string().optional(),
      state: z.string().optional(),
      error: z.string().optional(),
    })
    const { code, state, error } = schema.parse(req.query)

    if (error) {
      return res.redirect(backToApp('/app/upload', { provider: 'gdrive', error }))
    }
    if (!req.session.userId) {
      return res.redirect(backToApp('/login', { error: 'session_expired' }))
    }
    if (!code || !state || state !== req.session.oauthState) {
      return res.redirect(
        backToApp('/app/upload', { provider: 'gdrive', error: 'invalid_state' }),
      )
    }

    delete req.session.oauthState

    const user = await User.findById(req.session.userId)
    if (!user) return res.redirect(backToApp('/login', { error: 'session_expired' }))

    // Sent back into whichever role's upload page the user started from, so
    // an admin connecting a Drive account from /admin/upload doesn't land on
    // the employee route (which their session isn't allowed into).
    const returnPath = user.role === 'admin' ? '/admin/upload' : '/app/upload'

    try {
      const { accountId, accountEmail } = await exchangeCode(code, user)
      await recordLog({
        user,
        action: 'provider_connected',
        status: 'success',
        detail: `Google Drive account ${accountEmail} linked`,
        provider: 'gdrive',
        req,
      })
      return res.redirect(
        backToApp(returnPath, {
          provider: 'gdrive',
          connected: '1',
          account: accountEmail,
          accountId,
        }),
      )
    } catch (exchangeError) {
      return res.redirect(
        backToApp(returnPath, {
          provider: 'gdrive',
          error: (exchangeError as Error).message.slice(0, 200),
        }),
      )
    }
  }),
)

router.delete(
  '/google/:accountId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const accountId = z.string().min(1).parse(req.params.accountId)
    await disconnect(String(req.currentUser!._id), accountId)
    res.json({ ok: true })
  }),
)

/* ------------------------------------------------------------- listing */

router.get(
  '/google/files',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      accountId: z.string().min(1),
      search: z.string().optional(),
      onlyEncrypted: z.enum(['0', '1']).optional(),
      pageToken: z.string().optional(),
    })
    const query = schema.parse(req.query)

    const result = await listFiles({
      userId: String(req.currentUser!._id),
      accountId: query.accountId,
      search: query.search,
      onlyEncrypted: query.onlyEncrypted === '1',
      pageToken: query.pageToken,
    })

    res.json(result)
  }),
)

/* -------------------------------------------------------------- upload */

const uploadMetaSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(1),
  originalName: z.string().min(1),
  keyId: z.string().min(1),
  iv: z.string().min(1),
  mimeType: z.string().default('application/octet-stream'),
  originalSize: z.coerce.number().nonnegative().default(0),
})

/**
 * Accepts the already-encrypted body and streams it to Drive.
 *
 * No body parser runs for `application/octet-stream`, so `req` is still a raw
 * stream here — the ciphertext is never buffered in this process, and the
 * server has no way to read the plaintext even if it wanted to.
 */
router.post(
  '/google/upload',
  requireAuth,
  asyncHandler(async (req, res) => {
    const meta = uploadMetaSchema.parse(req.query)
    const user = req.currentUser!

    const uploaded = await uploadEncrypted({
      userId: String(user._id),
      accountId: meta.accountId,
      name: meta.name,
      body: req,
    })

    const record = await VaultFile.create({
      originalName: meta.originalName,
      encryptedName: uploaded.name,
      sizeBytes: uploaded.sizeBytes || meta.originalSize,
      mimeType: meta.mimeType,
      provider: 'gdrive',
      providerAccountId: meta.accountId,
      providerAccountEmail: uploaded.accountEmail,
      providerFileId: uploaded.fileId,
      providerWebLink: uploaded.webViewLink,
      owner: user._id,
      ownerName: user.name,
      iv: meta.iv,
      keyId: meta.keyId,
      status: 'encrypted',
    })

    await recordLog({
      user,
      action: 'encrypt_upload',
      status: 'success',
      detail: `${meta.originalName} encrypted (AES-256-GCM) and uploaded to Google Drive (${uploaded.accountEmail})`,
      provider: 'gdrive',
      req,
    })

    emitToUserAndAdmins(String(user._id), 'file:created', record.toJSON())

    res.status(201).json({ file: record.toJSON() })
  }),
)

/* ------------------------------------------------------------ download */

router.get(
  '/google/files/:fileId/download',
  requireAuth,
  asyncHandler(async (req, res) => {
    const fileId = z.string().min(1).parse(req.params.fileId)
    const accountId = z.string().min(1).parse(req.query.accountId)

    const file = await downloadFile(String(req.currentUser!._id), accountId, fileId)

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`)
    if (file.sizeBytes) res.setHeader('Content-Length', String(file.sizeBytes))

    file.stream.on('error', (error) => {
      // Headers are already sent by this point, so the only honest signal left
      // is to break the connection rather than pretend the file completed.
      console.error('Drive download stream failed:', error)
      res.destroy(error)
    })

    file.stream.pipe(res)
  }),
)

router.delete(
  '/google/files/:fileId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const fileId = z.string().min(1).parse(req.params.fileId)
    const userId = String(req.currentUser!._id)

    const record = await VaultFile.findOne({ providerFileId: fileId, provider: 'gdrive' })
    if (record && String(record.owner) !== userId && req.currentUser!.role !== 'admin') {
      throw ApiError.forbidden('You can only delete your own files.')
    }

    // A vault record already knows which of the owner's accounts holds it.
    // Falling back to the query param covers deleting a raw Drive listing
    // entry that was never turned into a vault record.
    const accountId =
      record?.providerAccountId != null
        ? String(record.providerAccountId)
        : z.string().min(1).parse(req.query.accountId)

    await deleteFile(userId, accountId, fileId)
    if (record) await record.deleteOne()

    res.json({ ok: true })
  }),
)

/* ============================================================== GitHub */

router.get(
  '/github/connect',
  requireAuth,
  asyncHandler(async (req, res) => {
    const state = crypto.randomBytes(24).toString('hex')
    req.session.oauthState = state
    await new Promise<void>((resolve, reject) =>
      req.session.save((error) => (error ? reject(error) : resolve())),
    )
    res.redirect(buildGithubConsentUrl(state))
  }),
)

router.get(
  '/github/callback',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      code: z.string().optional(),
      state: z.string().optional(),
      error: z.string().optional(),
    })
    const { code, state, error } = schema.parse(req.query)

    if (error) {
      return res.redirect(backToApp('/app/upload', { provider: 'github', error }))
    }
    if (!req.session.userId) {
      return res.redirect(backToApp('/login', { error: 'session_expired' }))
    }
    if (!code || !state || state !== req.session.oauthState) {
      return res.redirect(
        backToApp('/app/upload', { provider: 'github', error: 'invalid_state' }),
      )
    }

    delete req.session.oauthState

    const user = await User.findById(req.session.userId)
    if (!user) return res.redirect(backToApp('/login', { error: 'session_expired' }))

    const returnPath = user.role === 'admin' ? '/admin/upload' : '/app/upload'

    try {
      const { accountId, accountEmail } = await exchangeGithubCode(code, user)
      await recordLog({
        user,
        action: 'provider_connected',
        status: 'success',
        detail: `GitHub account ${accountEmail} linked`,
        provider: 'github',
        req,
      })
      return res.redirect(
        backToApp(returnPath, {
          provider: 'github',
          connected: '1',
          account: accountEmail,
          accountId,
        }),
      )
    } catch (exchangeError) {
      return res.redirect(
        backToApp(returnPath, {
          provider: 'github',
          error: (exchangeError as Error).message.slice(0, 200),
        }),
      )
    }
  }),
)

router.delete(
  '/github/:accountId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const accountId = z.string().min(1).parse(req.params.accountId)
    await disconnectGithub(String(req.currentUser!._id), accountId)
    res.json({ ok: true })
  }),
)

router.get(
  '/github/repos',
  requireAuth,
  asyncHandler(async (req, res) => {
    const accountId = z.string().min(1).parse(req.query.accountId)
    const repos = await listGithubRepos(String(req.currentUser!._id), accountId)
    res.json({ repos })
  }),
)

router.post(
  '/github/repos',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { accountId, name } = z
      .object({
        accountId: z.string().min(1),
        // GitHub's own repo-name rules: letters, digits, hyphen, underscore, dot.
        name: z.string().min(1).max(100).regex(/^[\w.-]+$/, 'Only letters, numbers, . _ and - are allowed.'),
      })
      .parse(req.body)

    const repo = await createGithubRepo(String(req.currentUser!._id), accountId, name)
    res.status(201).json({ repo })
  }),
)

router.get(
  '/github/files',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      accountId: z.string().min(1),
      repo: z.string().min(1),
      search: z.string().optional(),
      onlyEncrypted: z.enum(['0', '1']).optional(),
    })
    const query = schema.parse(req.query)

    const result = await listGithubFiles({
      userId: String(req.currentUser!._id),
      accountId: query.accountId,
      repo: query.repo,
      search: query.search,
      onlyEncrypted: query.onlyEncrypted === '1',
    })

    res.json(result)
  }),
)

/** Reads the raw request body into memory, up to `maxBytes`. The Contents
 *  API needs the whole file as one base64 JSON field — there's no streaming
 *  path the way Drive's upload has — so this cap keeps a bad/huge upload
 *  from growing this process's memory unbounded. */
function bufferRequest(req: import('node:stream').Readable, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    req.on('data', (chunk: Buffer) => {
      total += chunk.length
      if (total > maxBytes) {
        reject(ApiError.badRequest(`File exceeds GitHub's ${maxBytes / 1024 ** 2}MB limit.`))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const githubUploadMetaSchema = uploadMetaSchema.extend({ repo: z.string().min(1) })

router.post(
  '/github/upload',
  requireAuth,
  asyncHandler(async (req, res) => {
    const meta = githubUploadMetaSchema.parse(req.query)
    const user = req.currentUser!

    const buffer = await bufferRequest(req, GITHUB_MAX_UPLOAD_BYTES)

    const uploaded = await uploadGithubEncrypted({
      userId: String(user._id),
      accountId: meta.accountId,
      repo: meta.repo,
      name: meta.name,
      buffer,
    })

    const record = await VaultFile.create({
      originalName: meta.originalName,
      encryptedName: uploaded.name,
      sizeBytes: uploaded.sizeBytes || meta.originalSize,
      mimeType: meta.mimeType,
      provider: 'github',
      providerAccountId: meta.accountId,
      providerAccountEmail: uploaded.accountEmail,
      providerRepo: meta.repo,
      providerFileId: uploaded.fileId,
      providerWebLink: uploaded.webViewLink,
      owner: user._id,
      ownerName: user.name,
      iv: meta.iv,
      keyId: meta.keyId,
      status: 'encrypted',
    })

    await recordLog({
      user,
      action: 'encrypt_upload',
      status: 'success',
      detail: `${meta.originalName} encrypted (AES-256-GCM) and uploaded to GitHub (${uploaded.accountEmail})`,
      provider: 'github',
      req,
    })

    emitToUserAndAdmins(String(user._id), 'file:created', record.toJSON())

    res.status(201).json({ file: record.toJSON() })
  }),
)

router.get(
  '/github/files/:fileId/download',
  requireAuth,
  asyncHandler(async (req, res) => {
    const fileId = z.string().min(1).parse(req.params.fileId)
    const accountId = z.string().min(1).parse(req.query.accountId)
    const repo = z.string().min(1).parse(req.query.repo)

    const file = await downloadGithubFile(String(req.currentUser!._id), accountId, repo, fileId)

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`)
    if (file.sizeBytes) res.setHeader('Content-Length', String(file.sizeBytes))

    file.stream.on('error', (error) => {
      console.error('GitHub download stream failed:', error)
      res.destroy(error)
    })

    file.stream.pipe(res)
  }),
)

router.delete(
  '/github/files/:fileId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const fileId = z.string().min(1).parse(req.params.fileId)
    const userId = String(req.currentUser!._id)
    // Query-param repo is the fallback for a raw listing entry that never
    // became a VaultFile record — same pattern as accountId below.
    const queryRepo = req.query.repo ? z.string().min(1).parse(req.query.repo) : undefined

    // Unlike Drive's opaque file ids, a GitHub "file id" is just its
    // filename — two employees (or two repos) can easily pick the same one,
    // so an unscoped lookup could resolve to the wrong record. Prefer the
    // caller's own file, narrowed by repo when given; only an admin falls
    // back to searching everyone.
    const ownFilter: Record<string, unknown> = { providerFileId: fileId, provider: 'github', owner: userId }
    if (queryRepo) ownFilter.providerRepo = queryRepo
    let record = await VaultFile.findOne(ownFilter)
    if (!record && req.currentUser!.role === 'admin') {
      const anyFilter: Record<string, unknown> = { providerFileId: fileId, provider: 'github' }
      if (queryRepo) anyFilter.providerRepo = queryRepo
      record = await VaultFile.findOne(anyFilter)
    }
    if (record && String(record.owner) !== userId && req.currentUser!.role !== 'admin') {
      throw ApiError.forbidden('You can only delete your own files.')
    }

    const accountId =
      record?.providerAccountId != null
        ? String(record.providerAccountId)
        : z.string().min(1).parse(req.query.accountId)
    const repo = record?.providerRepo ?? queryRepo
    if (!repo) throw ApiError.badRequest('Missing repo.')

    await deleteGithubFile(userId, accountId, repo, fileId)
    if (record) await record.deleteOne()

    res.json({ ok: true })
  }),
)

export default router
