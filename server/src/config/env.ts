import path from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'

// The .env lives at the repo root so the client and server share one file.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

/** Vars without a default here are required — the process refuses to boot without them. */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required — see .env.example'),

  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),

  // Optional at boot: the app starts without them, but the matching feature is
  // disabled rather than crashing halfway through a request.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Two distinct callbacks: one links a Drive account, one signs a user in.
  // Both must be listed in the Cloud Console client's authorised redirect URIs.
  GOOGLE_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:5000/api/providers/google/callback'),
  GOOGLE_LOGIN_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:5000/api/auth/google/callback'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Hybrid Cloud Encryption <no-reply@localhost>'),

  ADMIN_EMAIL: z.string().email().optional(),

  /** Password given to seeded demo accounts. Change it for anything real. */
  SEED_PASSWORD: z.string().min(8).default('Hce@2026Demo'),
})

// A blank line in .env (ADMIN_EMAIL=) arrives as "", which Zod validates as a
// present-but-invalid value. Drop empties so optional fields and defaults apply.
const present = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== ''),
)

const parsed = schema.safeParse(present)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  console.error(`\nInvalid environment configuration:\n${issues}\n`)
  console.error('Copy server/.env.example to .env at the repo root and fill it in.\n')
  process.exit(1)
}

export const env = parsed.data

export const isProd = env.NODE_ENV === 'production'

/** Feature flags derived from which credentials are actually present. */
export const features = {
  googleDrive: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  email: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
}

export function reportFeatureStatus(): void {
  const line = (name: string, on: boolean, hint: string) =>
    console.log(`  ${on ? '✓' : '·'} ${name.padEnd(14)} ${on ? 'enabled' : `disabled — ${hint}`}`)

  console.log('\nFeature status:')
  line('Google Drive', features.googleDrive, 'set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET')
  line('Email', features.email, 'set SMTP_HOST, SMTP_USER and SMTP_PASS')
  console.log('')
}
