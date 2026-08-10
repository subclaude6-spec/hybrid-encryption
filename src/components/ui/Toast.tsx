import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn, shortId } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  tone: ToastTone
  title: string
  description?: string
}

const ToastContext = createContext<{
  toast: (t: Omit<Toast, 'id'>) => void
} | null>(null)

const TONE_STYLES: Record<ToastTone, { icon: ReactNode; ring: string }> = {
  success: { icon: <CheckCircle2 className="size-4 text-ok" />, ring: 'border-ok/30' },
  error: { icon: <XCircle className="size-4 text-danger" />, ring: 'border-danger/30' },
  warning: {
    icon: <AlertTriangle className="size-4 text-warn" />,
    ring: 'border-warn/30',
  },
  info: { icon: <Info className="size-4 text-brand-400" />, ring: 'border-brand-500/30' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = shortId('t')
      setToasts((prev) => [...prev, { ...t, id }])
      setTimeout(() => dismiss(id), 5000)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'animate-in-up glass pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-xl shadow-ink-950/50',
              TONE_STYLES[t.tone].ring,
            )}
          >
            <div className="mt-0.5">{TONE_STYLES[t.tone].icon}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">{t.title}</p>
              {t.description ? (
                <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">
                  {t.description}
                </p>
              ) : null}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="rounded p-0.5 text-fg-subtle transition-colors hover:text-fg"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx.toast
}
