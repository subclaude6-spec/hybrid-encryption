/**
 * Seeds the demo dataset — the same people and files the frontend mock used,
 * so the UI looks identical once it is pointed at the real API.
 *
 *   npm run seed            # refuses if data already exists
 *   npm run seed -- --force # wipes and reseeds
 *
 * Every account gets the same password (SEED_PASSWORD, default `Hce@2026Demo`)
 * and is flagged `mustChangePassword`. That is fine for a local demo and wrong
 * for anything real — change it before this leaves your machine.
 */
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../config/db'
import { env } from '../config/env'
import { LogEntry } from '../models/LogEntry'
import { SecurityAlert } from '../models/SecurityAlert'
import { User, type UserDocument } from '../models/User'
import { VaultFile } from '../models/VaultFile'
import { recordLog } from '../services/log.service'
import { hashPassword } from '../services/password.service'

const force = process.argv.includes('--force')

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const ago = (ms: number) => new Date(Date.now() - ms)

const PEOPLE = [
  {
    name: 'Arjun Kumar',
    email: env.ADMIN_EMAIL ?? 'arjun@company.io',
    role: 'admin' as const,
    status: 'active' as const,
    department: 'Security & Infrastructure',
  },
  {
    name: 'Priya Sharma',
    email: 'priya.sharma@company.io',
    role: 'employee' as const,
    status: 'active' as const,
    department: 'Finance',
  },
  {
    name: 'Rahul Menon',
    email: 'rahul.menon@company.io',
    role: 'employee' as const,
    status: 'active' as const,
    department: 'Legal',
  },
  {
    name: 'Sneha Iyer',
    email: 'sneha.iyer@company.io',
    role: 'employee' as const,
    status: 'suspended' as const,
    department: 'Operations',
  },
  {
    name: 'Vikram Desai',
    email: 'vikram.desai@company.io',
    role: 'employee' as const,
    status: 'pending' as const,
    department: 'Engineering',
  },
]

async function seed() {
  await connectDatabase()

  const existing = await User.countDocuments()
  if (existing > 0 && !force) {
    console.error(
      `\n✗ Refusing to seed: ${existing} user(s) already exist.\n` +
        '  Re-run with --force to wipe and reseed:  npm run seed -- --force\n',
    )
    await disconnectDatabase()
    process.exit(1)
  }

  if (force) {
    console.log('  Wiping existing collections…')
    await Promise.all([
      User.deleteMany({}),
      VaultFile.deleteMany({}),
      LogEntry.deleteMany({}),
      SecurityAlert.deleteMany({}),
      mongoose.connection.collection('sessions').deleteMany({}),
    ])
  }

  const passwordHash = await hashPassword(env.SEED_PASSWORD)
  const users = await User.create(
    PEOPLE.map((person) => ({
      ...person,
      passwordHash,
      authProvider: 'password' as const,
      mustChangePassword: true,
    })),
  )
  const byEmail = new Map(users.map((u) => [u.email, u]))
  const admin = users.find((u) => u.role === 'admin')!
  console.log(`  Created ${users.length} users`)

  const priya = byEmail.get('priya.sharma@company.io')!
  const rahul = byEmail.get('rahul.menon@company.io')!
  const sneha = byEmail.get('sneha.iyer@company.io')!
  const vikram = byEmail.get('vikram.desai@company.io')!

  // Placeholder envelopes: providerFileId is a stub until a real Drive upload
  // replaces it, and wrappedKeys are empty because no user has a wrapping key
  // until they enrol one. These exist so the tables aren't empty on first run.
  const files = await VaultFile.create([
    {
      originalName: 'audit-notes.docx',
      encryptedName: 'audit-notes.hce',
      sizeBytes: Math.round(12.4 * 1024 ** 2),
      provider: 'gdrive',
      providerFileId: 'seed-placeholder-1',
      owner: priya._id,
      ownerName: priya.name,
      iv: Buffer.alloc(12).toString('base64'),
      keyId: 'HCE-4KDQ2-M7XPL-99TRV-BN3WZ',
      status: 'encrypted',
      createdAt: ago(2 * DAY),
    },
    {
      originalName: 'board-minutes-jul.pdf',
      encryptedName: 'board-minutes-jul.hce',
      sizeBytes: Math.round(3.1 * 1024 ** 2),
      provider: 'gdrive',
      providerFileId: 'seed-placeholder-2',
      owner: rahul._id,
      ownerName: rahul.name,
      iv: Buffer.alloc(12).toString('base64'),
      keyId: 'HCE-P2M4X-7LTQW-DK8VN-RJ5ZY',
      status: 'decrypted',
      createdAt: ago(8 * DAY),
    },
    {
      originalName: 'nda-signed-batch.zip',
      encryptedName: 'nda-signed-batch.hce',
      sizeBytes: Math.round(6.6 * 1024 ** 2),
      provider: 'dropbox',
      providerFileId: 'seed-placeholder-3',
      owner: sneha._id,
      ownerName: sneha.name,
      iv: Buffer.alloc(12).toString('base64'),
      keyId: 'HCE-JH6BN-QW2ER-TY8UI-OP4AS',
      status: 'failed',
      createdAt: ago(3 * DAY),
    },
  ])
  console.log(`  Created ${files.length} vault files`)

  // Written through recordLog so the hash chain is genuinely valid — you can
  // prove it with GET /api/health/audit-chain immediately after seeding.
  const events: Array<Parameters<typeof recordLog>[0]> = [
    {
      user: priya,
      action: 'encrypt_upload',
      status: 'success',
      detail: 'audit-notes.docx encrypted and uploaded',
      provider: 'gdrive',
    },
    {
      user: priya,
      action: 'key_issued',
      status: 'success',
      detail: `Wrapped DEK issued to ${priya.email} and ${admin.email}`,
      provider: 'gdrive',
    },
    {
      user: rahul,
      action: 'encrypt_upload',
      status: 'success',
      detail: 'board-minutes-jul.pdf encrypted and uploaded',
      provider: 'gdrive',
    },
    {
      user: rahul,
      action: 'decrypt_success',
      status: 'success',
      detail: 'board-minutes-jul.hce decrypted and downloaded',
      provider: 'gdrive',
    },
    {
      user: sneha,
      action: 'decrypt_failed',
      status: 'failed',
      detail: 'Invalid decryption key — attempt 3 of 3 on nda-signed-batch.hce',
      provider: 'dropbox',
    },
    {
      user: admin,
      action: 'access_revoked',
      status: 'warning',
      detail: 'Suspended Sneha Iyer after 3 failed key attempts',
    },
    {
      user: vikram,
      action: 'account_created',
      status: 'warning',
      detail: 'Account provisioned — awaiting admin approval',
    },
  ]

  for (const event of events) await recordLog(event)
  console.log(`  Created ${events.length} chained audit entries`)

  const alerts = await SecurityAlert.create([
    {
      severity: 'critical',
      title: 'Repeated invalid decryption key',
      detail:
        'Sneha Iyer submitted 3 consecutive invalid keys for nda-signed-batch.hce from an unrecognised IP.',
      user: sneha._id,
      userName: sneha.name,
      attempts: 3,
      resolved: false,
    },
    {
      severity: 'warning',
      title: 'Account awaiting approval',
      detail: 'Vikram Desai registered but has no admin-approved role yet.',
      user: vikram._id,
      userName: vikram.name,
      resolved: false,
    },
  ])
  console.log(`  Created ${alerts.length} security alerts`)

  await User.updateOne({ _id: sneha._id }, { failedDecryptAttempts: 3 })

  console.log('\n✓ Seed complete.\n')
  console.log(`  Password for every account:  ${env.SEED_PASSWORD}\n`)
  for (const user of users as UserDocument[]) {
    console.log(`   • ${user.email.padEnd(28)} ${user.role.padEnd(9)} ${user.status}`)
  }
  console.log('')

  await disconnectDatabase()
}

seed().catch(async (error) => {
  console.error('\n✗ Seed failed:', error)
  await disconnectDatabase().catch(() => undefined)
  process.exit(1)
})
