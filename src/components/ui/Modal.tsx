import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  size = 'md',
  children,
  footer,
  dismissable = true,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: ReactNode
  size?: ModalSize
  children: ReactNode
  footer?: ReactNode
  dismissable?: boolean
}) {
  useEffect(() => {
    if (!open || !dismissable) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, dismissable])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="animate-fade absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
        onClick={dismissable ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'animate-in-up relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl2 border border-ink-700 bg-ink-850 shadow-2xl shadow-ink-950/60',
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-700 px-6 py-4">
          <div className="flex items-start gap-3">
            {icon ? <div className="mt-0.5 text-brand-400">{icon}</div> : null}
            <div>
              <h2 className="text-base font-semibold text-fg">{title}</h2>
              {subtitle ? (
                <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {dismissable ? (
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-ink-700 hover:text-fg"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-ink-700 bg-ink-900/50 px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
