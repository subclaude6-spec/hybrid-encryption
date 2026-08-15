import path from 'node:path'
import express, { type RequestHandler } from 'express'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { env, isProd } from './config/env'
import { errorHandler, notFoundHandler } from './middleware/error'
import alertRoutes from './routes/alerts.routes'
import authRoutes from './routes/auth.routes'
import fileRoutes from './routes/files.routes'
import healthRoutes from './routes/health.routes'
import logRoutes from './routes/logs.routes'
import providerRoutes from './routes/providers.routes'
import userRoutes from './routes/users.routes'

/** Shared with Socket.IO so both surfaces authenticate off the same cookie. */
export const sessionMiddleware: RequestHandler = session({
  name: 'hce.sid',
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 60 * 60 * 8,
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 8,
  },
})

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)

  app.use(
    helmet({
      // The API serves JSON only; CSP belongs on whatever serves the client.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  )

  // credentials:true is required — the session cookie must travel with requests
  // from the Vite dev server on a different origin.
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }))

  // Ciphertext uploads are streamed through this, so the default 100kb is far
  // too small. Raise it once the upload route lands if you need bigger blobs.
  app.use(express.json({ limit: '25mb' }))
  app.use(express.urlencoded({ extended: true }))

  if (!isProd) app.use(morgan('dev'))

  app.use(sessionMiddleware)

  app.use('/api/health', healthRoutes)
  app.use('/api/auth', authRoutes)
  app.use('/api/providers', providerRoutes)
  app.use('/api/files', fileRoutes)
  app.use('/api/logs', logRoutes)
  app.use('/api/alerts', alertRoutes)
  app.use('/api/users', userRoutes)

  // On Render (and any single-service deploy) this same process also serves
  // the built frontend, so the app is reachable at one origin — the client's
  // relative `/api/...` fetches and WebAuthn's exact-origin check both depend
  // on that. Only wired up in prod; `vite dev` serves the frontend locally.
  if (isProd) {
    const clientDist = path.join(__dirname, '../../dist')
    app.use(express.static(clientDist))
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'))
    })
  }

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
