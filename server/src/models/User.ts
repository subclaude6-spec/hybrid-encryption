import { Schema, model, type Document, type Types } from 'mongoose'
import { jsonTransform } from '../utils/toJSON'

export type Role = 'admin' | 'employee'
export type UserStatus = 'active' | 'suspended' | 'pending'
export type ProviderId = 'gdrive' | 'github' | 'dropbox' | 'onedrive' | 'mega'

/** How the account can sign in. `both` means a password was set and a Google
 *  account has been linked — either one works. */
export type AuthProvider = 'password' | 'google' | 'both'

/** An OAuth link to a cloud provider. Tokens are `select: false` so a stray
 *  `User.find()` can never leak them into an API response. A user can link
 *  several accounts for the same provider (e.g. two Google Drive accounts) —
 *  `_id` is what the UI and upload/download calls use to pick one. */
export interface ProviderAccount {
  _id: Types.ObjectId
  provider: ProviderId
  accountEmail: string
  accessToken: string
  /** Google's OAuth flow always returns one; GitHub's classic OAuth Apps
   *  never do (tokens don't expire there), so this is null for GitHub. */
  refreshToken: string | null
  expiryDate: Date | null
  scope: string
  connectedAt: Date
}

export interface UserDocument extends Document {
  _id: Types.ObjectId
  name: string
  email: string
  role: Role
  status: UserStatus
  department: string
  /** bcrypt hash. `select: false` so it is never loaded by accident. */
  passwordHash: string | null
  /** Google's stable subject id — survives an email change on their side. */
  googleId: string | null
  authProvider: AuthProvider
  mustChangePassword: boolean
  failedLoginAttempts: number
  lockedUntil: Date | null
  providerAccounts: ProviderAccount[]
  /** SPKI public key used to wrap per-file data keys for this user. */
  wrappingPublicKey: string | null
  failedDecryptAttempts: number
  lastActiveAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const providerAccountSchema = new Schema<ProviderAccount>(
  {
    provider: {
      type: String,
      enum: ['gdrive', 'github', 'dropbox', 'onedrive', 'mega'],
      required: true,
    },
    accountEmail: { type: String, required: true },
    accessToken: { type: String, required: true, select: false },
    refreshToken: { type: String, default: null, select: false },
    expiryDate: { type: Date, default: null },
    scope: { type: String, default: '' },
    connectedAt: { type: Date, default: Date.now },
  },
  { _id: true },
)

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: { type: String, enum: ['admin', 'employee'], default: 'employee' },
    status: {
      type: String,
      enum: ['active', 'suspended', 'pending'],
      // New accounts wait for an admin — matches the approval flow in the UI.
      default: 'pending',
    },
    department: { type: String, default: 'Unassigned' },
    passwordHash: { type: String, default: null, select: false },
    googleId: { type: String, default: null, index: true, sparse: true },
    authProvider: {
      type: String,
      enum: ['password', 'google', 'both'],
      default: 'password',
    },
    mustChangePassword: { type: Boolean, default: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    providerAccounts: { type: [providerAccountSchema], default: [] },
    wrappingPublicKey: { type: String, default: null },
    failedDecryptAttempts: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: jsonTransform((ret) => {
        // Belt and braces — tokens are select:false, but never serialise them
        // even if some future query explicitly selects them back in.
        if (Array.isArray(ret.providerAccounts)) {
          ret.providerAccounts = ret.providerAccounts.map((account: ProviderAccount) => ({
            id: String(account._id),
            provider: account.provider,
            accountEmail: account.accountEmail,
            connectedAt: account.connectedAt,
          }))
        }
        // The UI only needs to know whether the account is locked right now,
        // so read the timestamp before stripping it.
        const lockedUntil = ret.lockedUntil as string | Date | null
        ret.locked = Boolean(lockedUntil && new Date(lockedUntil) > new Date())

        // Never serialise credential material or lockout internals.
        delete ret.passwordHash
        delete ret.googleId
        delete ret.failedLoginAttempts
        delete ret.lockedUntil
      }),
    },
  },
)

export const User = model<UserDocument>('User', userSchema)
