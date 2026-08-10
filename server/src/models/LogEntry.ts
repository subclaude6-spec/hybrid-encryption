import { Schema, model, type Document, type Types } from 'mongoose'
import { jsonTransformWithAt } from '../utils/toJSON'
import type { ProviderId } from './User'

export type LogAction =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'passkey_enrolled'
  | 'encrypt_upload'
  | 'decrypt_success'
  | 'decrypt_failed'
  | 'key_issued'
  | 'provider_connected'
  | 'access_revoked'
  | 'account_created'

export type LogStatus = 'success' | 'failed' | 'warning'

export interface LogEntryDocument extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  userName: string
  action: LogAction
  status: LogStatus
  detail: string
  provider: ProviderId | null
  ip: string
  device: string
  /** Hash of the previous entry, making the log tamper-evident: editing any
   *  row breaks every hash after it. Written by log.service, never by hand. */
  prevHash: string
  hash: string
  createdAt: Date
  updatedAt: Date
}

const logEntrySchema = new Schema<LogEntryDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String, required: true },
    action: {
      type: String,
      required: true,
      enum: [
        'login',
        'login_failed',
        'logout',
        'passkey_enrolled',
        'encrypt_upload',
        'decrypt_success',
        'decrypt_failed',
        'key_issued',
        'provider_connected',
        'access_revoked',
        'account_created',
      ],
    },
    status: { type: String, enum: ['success', 'failed', 'warning'], required: true },
    detail: { type: String, required: true },
    provider: {
      type: String,
      enum: ['gdrive', 'github', 'dropbox', 'onedrive', 'mega', null],
      default: null,
    },
    ip: { type: String, default: 'unknown' },
    device: { type: String, default: 'unknown' },
    prevHash: { type: String, required: true },
    hash: { type: String, required: true },
  },
  {
    timestamps: true,
    toJSON: { transform: jsonTransformWithAt },
  },
)

logEntrySchema.index({ createdAt: -1 })
logEntrySchema.index({ user: 1, createdAt: -1 })

export const LogEntry = model<LogEntryDocument>('LogEntry', logEntrySchema)
