import mongoose from 'mongoose'
import { env, isProd } from './env'

/** Redacts the password so a connection failure can be logged safely. */
function safeUri(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:••••@')
}

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true)
  if (!isProd) mongoose.set('debug', false)

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
    })
    const { host, name } = mongoose.connection
    console.log(`✓ MongoDB connected — ${host}/${name}`)
  } catch (error) {
    console.error(`\n✗ MongoDB connection failed for ${safeUri(env.MONGODB_URI)}`)
    console.error(`  ${(error as Error).message}\n`)
    console.error('  Common causes:')
    console.error('   • Password not URL-encoded (@ → %40, # → %23, / → %2F)')
    console.error('   • Your IP is not in Atlas → Network Access')
    console.error('   • Database user lacks read/write permission')
    console.error('   • Missing database name before the "?" in the URI\n')
    process.exit(1)
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('! MongoDB disconnected — driver will retry automatically')
  })
  mongoose.connection.on('reconnected', () => {
    console.log('✓ MongoDB reconnected')
  })
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close()
}
