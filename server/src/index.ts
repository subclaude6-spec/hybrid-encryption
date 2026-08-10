import http from 'node:http'
import { createApp, sessionMiddleware } from './app'
import { connectDatabase, disconnectDatabase } from './config/db'
import { env, reportFeatureStatus } from './config/env'
import { initSocket } from './realtime/socket'

async function main() {
  await connectDatabase()

  const app = createApp()
  const server = http.createServer(app)
  initSocket(server, sessionMiddleware)

  server.listen(env.PORT, () => {
    console.log(`✓ API listening on http://localhost:${env.PORT}`)
    console.log(`  CORS origin: ${env.CLIENT_URL}`)
    reportFeatureStatus()
  })

  // Drain in-flight requests before dropping the DB connection, so a restart
  // never leaves a half-written audit entry.
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down`)
    server.close(async () => {
      await disconnectDatabase()
      process.exit(0)
    })
    setTimeout(() => process.exit(1), 10_000).unref()
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((error) => {
  console.error('Fatal startup error:', error)
  process.exit(1)
})
