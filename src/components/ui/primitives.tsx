import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ---------------------------------------------------------------------- Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-500 text-ink-onbrand font-semibold hover:bg-brand-600 active:bg-brand-700 shadow-sm shadow-brand-500/25',
  secondary: 'bg-ink-700 text-fg hover:bg-ink-600 border border-ink-600',
  ghost: 'text-fg-muted hover:text-fg hover:bg-ink-800',
  danger: 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
  outline: 'border border-ink-600 text-fg hover:bg-ink-800 hover:border-ink-600',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-xl',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
        'disabled:opacity-40 disabled:pointer-events-none',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------------ Card */

export function Card({
  className,
  children,
  interactive = false,
}: {
  className?: string
  children: ReactNode
  interactive?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl2 border border-ink-700 bg-ink-850 shadow-sm shadow-ink-600/5',
        interactive &&
          'transition-all duration-200 hover:border-ink-600 hover:bg-ink-800 hover:shadow-md hover:shadow-ink-600/10 cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-700 px-5 py-4">
      <div className="flex items-start gap-3">
        {icon ? <div className="mt-0.5 text-brand-400">{icon}</div> : null}
        <div>
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  )
}

/* ----------------------------------------------------------------------- Badge */

type BadgeTone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger' | 'violet'

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-700 text-fg-muted border-ink-600',
  brand: 'bg-brand-500/12 text-brand-400 border-brand-500/25',
  ok: 'bg-ok/12 text-ok border-ok/25',
  warn: 'bg-warn/12 text-warn border-warn/25',
  danger: 'bg-danger/12 text-danger border-danger/25',
  violet: 'bg-violet/12 text-violet border-violet/25',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
  icon,
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
  icon?: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium',
        BADGE_TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/* ----------------------------------------------------------------------- Input */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  icon?: ReactNode
}

export function Input({ label, hint, error, icon, className, id, ...rest }: InputProps) {
  const inputId = id ?? rest.name
  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-xs font-medium text-fg-muted"
        >
          {label}
        </label>
      ) : null}
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle">
            {icon}
          </span>
        ) : null}
        <input
          id={inputId}
          {...rest}
          className={cn(
            'h-11 w-full rounded-xl border bg-ink-900 px-3.5 text-sm text-fg placeholder:text-fg-subtle',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/50',
            Boolean(icon) && 'pl-10',
            error ? 'border-danger/50 focus:ring-danger/40' : 'border-ink-700 focus:border-brand-500/50',
            className,
          )}
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------- Progress */

export function Progress({
  value,
  tone = 'brand',
  className,
}: {
  value: number
  tone?: 'brand' | 'ok' | 'danger'
  className?: string
}) {
  const colors = { brand: 'bg-brand-500', ok: 'bg-ok', danger: 'bg-danger' }
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-ink-700', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-300', colors[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ EmptyState */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl2 border border-ink-700 bg-ink-800 text-fg-subtle">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-fg-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

/* --------------------------------------------------------------------- Avatar */

export function Avatar({
  name,
  size = 'md',
  tone = 'brand',
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  tone?: 'brand' | 'violet' | 'neutral'
}) {
  const sizes = {
    sm: 'size-7 text-[10px]',
    md: 'size-9 text-xs',
    lg: 'size-12 text-sm',
  }
  const tones = {
    brand: 'bg-brand-500/15 text-brand-400 border-brand-500/25',
    violet: 'bg-violet/15 text-violet border-violet/25',
    neutral: 'bg-ink-700 text-fg-muted border-ink-600',
  }
  const label = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border font-semibold',
        sizes[size],
        tones[tone],
      )}
    >
      {label}
    </span>
  )
}

/* ---------------------------------------------------------------------- Select */

export function Select({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <div className={className}>
      {label ? (
        <label className="mb-1.5 block text-xs font-medium text-fg-muted">{label}</label>
      ) : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full appearance-none rounded-xl border border-ink-700 bg-ink-900 px-3 text-sm text-fg transition-colors focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink-900">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ------------------------------------------------------------------ Stat tile */

export function StatTile({
  label,
  value,
  icon,
  tone = 'brand',
  hint,
}: {
  label: string
  value: string | number
  icon: ReactNode
  tone?: 'brand' | 'ok' | 'warn' | 'danger' | 'violet'
  hint?: string
}) {
  const tones = {
    brand: 'text-brand-400 bg-brand-500/10',
    ok: 'text-ok bg-ok/10',
    warn: 'text-warn bg-warn/10',
    danger: 'text-danger bg-danger/10',
    violet: 'text-violet bg-violet/10',
  }
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-fg-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-fg">{value}</p>
          {hint ? <p className="mt-1 text-[11px] text-fg-subtle">{hint}</p> : null}
        </div>
        <div
          className={cn(
            'flex size-9 items-center justify-center rounded-lg',
            tones[tone],
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  )
}
