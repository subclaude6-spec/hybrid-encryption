export type ClassValue = string | false | null | undefined

/** Minimal classnames joiner. Keep variant classes non-overlapping so we don't
 *  need tailwind-merge's conflict resolution. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ')
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const steps: [number, string][] = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
    [2592000, 'month'],
  ]
  for (let i = steps.length - 1; i >= 0; i--) {
    const [unitSeconds, label] = steps[i]
    if (seconds >= unitSeconds) {
      const n = Math.floor(seconds / unitSeconds)
      return `${n} ${label}${n > 1 ? 's' : ''} ago`
    }
  }
  return 'just now'
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

/** Display-only key generator. Real DEK generation happens in the crypto layer later. */
export function mockKey(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const group = () =>
    Array.from(
      { length: 5 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join('')
  return `HCE-${group()}-${group()}-${group()}-${group()}`
}

export function shortId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
