import { Schema, model, type Document, type Types } from 'mongoose'
import { jsonTransformWithAt } from '../utils/toJSON'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface SecurityAlertDocument extends Document {
  _id: Types.ObjectId
  severity: AlertSeverity
  title: string
  detail: string
  user: Types.ObjectId
  userName: string
  /** Consecutive bad key attempts that triggered this, when applicable. */
  attempts: number | null
  resolved: boolean
  resolvedBy: Types.ObjectId | null
  resolvedAt: Date | null
  emailSentAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const securityAlertSchema = new Schema<SecurityAlertDocument>(
  {
    severity: {
      type: String,
      enum: ['critical', 'warning', 'info'],
      default: 'warning',
    },
    title: { type: String, required: true },
    detail: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String, required: true },
    attempts: { type: Number, default: null },
    resolved: { type: Boolean, default: false, index: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    emailSentAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { transform: jsonTransformWithAt },
  },
)

// Drives the "open alerts" badge in the admin sidebar.
securityAlertSchema.index({ resolved: 1, createdAt: -1 })

export const SecurityAlert = model<SecurityAlertDocument>(
  'SecurityAlert',
  securityAlertSchema,
)
