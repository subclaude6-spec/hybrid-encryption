import type { Server as HttpServer } from 'node:http'
import type { RequestHandler } from 'express'
import { Server as IOServer, type Socket } from 'socket.io'
import { env } from '../config/env'

let io: IOServer | null = null

/** Employees may only ever receive their own events; admins get everything. */
const adminRoom = 'role:admin'
const userRoom = (userId: string) => `user:${userId}`

interface SessionSocket extends Socket {
  request: Socket['request'] & {
    session?: { userId?: string; role?: 'admin' | 'employee' }
  }
}

export function initSocket(server: HttpServer, sessionMiddleware: RequestHandler): IOServer {
  io = new IOServer(server, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  })

  // Reuse the Express session so socket connections are authenticated by the
  // same cookie as the REST API — no second auth mechanism to keep in sync.
  io.engine.use(sessionMiddleware)

  io.on('connection', (socket: SessionSocket) => {
    const session = socket.request.session

    if (!session?.userId) {
      socket.emit('unauthorized')
      socket.disconnect(true)
      return
    }

    socket.join(userRoom(session.userId))
    if (session.role === 'admin') socket.join(adminRoom)

    socket.on('disconnect', () => {
      // Rooms are cleaned up automatically; nothing to do.
    })
  })

  return io
}

export function getIO(): IOServer {
  if (!io) throw new Error('Socket.IO accessed before initSocket()')
  return io
}

/** Send to the owning user and every admin — the visibility rule the UI expects. */
export function emitToUserAndAdmins(userId: string, event: string, payload: unknown): void {
  if (!io) return
  io.to(userRoom(userId)).to(adminRoom).emit(event, payload)
}

export function emitToAdmins(event: string, payload: unknown): void {
  if (!io) return
  io.to(adminRoom).emit(event, payload)
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!io) return
  io.to(userRoom(userId)).emit(event, payload)
}
