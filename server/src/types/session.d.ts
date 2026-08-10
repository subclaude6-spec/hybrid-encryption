import 'express-session'

declare module 'express-session' {
  interface SessionData {
    userId?: string
    role?: 'admin' | 'employee'
    /** Transient WebAuthn challenge, held only for the duration of a ceremony. */
    currentChallenge?: string
    /** CSRF state for the Google OAuth redirect. */
    oauthState?: string
  }
}
