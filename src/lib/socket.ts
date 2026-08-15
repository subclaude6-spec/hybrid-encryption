import { io, type Socket } from 'socket.io-client'

/**
 * In dev, the Vite server can't proxy WebSocket upgrades the way it proxies
 * `/api`, so this connects straight to the API's port. In prod the same
 * Express process serves both the API and the frontend (see server/app.ts),
 * so the socket lives at the page's own origin.
 */
const SOCKET_ORIGIN = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:5000`
  : window.location.origin

let socket: Socket | null = null

/** Opens the realtime connection. Safe to call repeatedly — a no-op if already connected. */
export function connectSocket(): Socket {
  if (socket) return socket
  socket = io(SOCKET_ORIGIN, { withCredentials: true, autoConnect: true })
  return socket
}

export function getSocket(): Socket | null {
  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}
