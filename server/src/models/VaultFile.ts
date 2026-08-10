import { Schema, model, type Document, type Types } from 'mongoose'
import { jsonTransform } from '../utils/toJSON'
import type { ProviderId } from './User'

export type VaultStatus = 'encrypted' | 'decrypted' | 'failed'

/** The per-file data key, encrypted to one recipient's wrapping key.
 *  The server stores only wrapped copies — never the raw DEK. */
export interface WrappedKey {
  recipient: Types.ObjectId
  recipientEmail: string
  wrappedDek: string
}

export interface VaultFileDocument extends Document {
  _id: Types.ObjectId
  originalName: string
  encryptedName: string
  sizeBytes: number
  mimeType: string
  provider: ProviderId
  /** The provider's own file identifier, e.g. a Google Drive fileId. */
  providerFileId: string
  providerWebLink: string | null
  owner: Types.ObjectId
  ownerName: string
  algorithm: 'AES-256-GCM'
  /** Base64 initialisation vector. Unique per file — never reused. */
  iv: string
  /** Short public reference shown in the UI. Not the key itself. */
  keyId: string
  wrappedKeys: WrappedKey[]
  status: VaultStatus
  lastDecryptedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const wrappedKeySchema = new Schema<WrappedKey>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientEmail: { type: String, required: true },
    wrappedDek: { type: String, required: true, select: false },
  },
  { _id: false },
)

const vaultFileSchema = new Schema<VaultFileDocument>(
  {
    originalName: { type: String, required: true },
    encryptedName: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    mimeType: { type: String, default: 'application/octet-stream' },
    provider: {
      type: String,
      enum: ['gdrive', 'github', 'dropbox', 'onedrive', 'mega'],
      required: true,
    },
    providerFileId: { type: String, required: true },
    providerWebLink: { type: String, default: null },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerName: { type: String, required: true },
    algorithm: { type: String, default: 'AES-256-GCM' },
    iv: { type: String, required: true },
    keyId: { type: String, required: true, index: true },
    wrappedKeys: { type: [wrappedKeySchema], default: [] },
    status: {
      type: String,
      enum: ['encrypted', 'decrypted', 'failed'],
      default: 'encrypted',
    },
    lastDecryptedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { transform: jsonTransform() },
  },
)

// The two queries the UI actually makes: an employee's own files, newest first,
// and the admin's org-wide listing.
vaultFileSchema.index({ owner: 1, createdAt: -1 })
vaultFileSchema.index({ createdAt: -1 })

export const VaultFile = model<VaultFileDocument>('VaultFile', vaultFileSchema)
