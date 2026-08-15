import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import {
  describeAuthError,
  fetchAuthConfig,
  signInWithPassword,
  startGoogleSignIn,
} from '@/lib/auth'
import { Button, Input } from '@/components/ui/primitives'
import LightRays from '@/components/LightRays'

export default function Login() {
  const navigate = useNavigate()
  const { currentUser, bootstrapping, signIn } = useApp()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [googleAvailable, setGoogleAvailable] = useState(false)

  // The Google callback redirects back here with ?error=... when it refuses.
  useEffect(() => {
    const redirectError = describeAuthError(searchParams.get('error'))
    if (redirectError) setError(redirectError)
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    fetchAuthConfig().then((config) => {
      if (!cancelled) setGoogleAvailable(config.googleSignIn)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (bootstrapping) {
    return (
      <div className="flex h-full items-center justify-center bg-ink-950">
        <div className="text-center">
          <Loader2 className="mx-auto size-6 animate-spin text-brand-400" />
          <p className="mt-3 text-sm text-fg-muted">Checking your session…</p>
        </div>
      </div>
    )
  }

  if (currentUser) {
    return <Navigate to={currentUser.role === 'admin' ? '/admin' : '/app'} replace />
  }

  async function submit() {
    if (!email.trim() || !password) return
    setSubmitting(true)
    setError(null)
    try {
      const { user } = await signInWithPassword(email, password)
      signIn(user)
      navigate(user.role === 'admin' ? '/admin' : '/app', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex h-full items-center justify-center overflow-y-auto bg-ink-950 px-6 py-10">
      <div className="pointer-events-none absolute inset-0 z-0">
        <LightRays
          raysOrigin="top-center"
          raysColor="#06b6d4"
          raysSpeed={1.2}
          lightSpread={0.75}
          rayLength={1.4}
          followMouse
          mouseInfluence={0.12}
          noiseAmount={0.08}
          distortion={0.04}
          saturation={1}
          fadeDistance={1.1}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="animate-in-up rounded-2xl border border-ink-800 bg-ink-900 p-8 shadow-xl">
          <div className="mb-7 flex justify-center">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-500 text-ink-onbrand">
              <ShieldCheck className="size-5" strokeWidth={2.4} />
            </span>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-fg">Sign in</h2>
            <p className="mt-1.5 text-sm text-fg-muted">
              Use the account your administrator provisioned for you.
            </p>
          </div>

          <div className="mt-5">
            {error ? (
              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/[0.07] px-3.5 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
                <p className="text-xs leading-relaxed text-danger">{error}</p>
              </div>
            ) : null}

            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="size-3.5" />}
                autoFocus
              />

              <div className="relative">
                <Input
                  label="Password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock className="size-3.5" />}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-[30px] rounded p-1 text-fg-subtle transition-colors hover:text-fg"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={submitting}
                disabled={!email.trim() || !password}
                icon={submitting ? undefined : <LogIn className="size-4" />}
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            {googleAvailable ? (
              <>
                <div className="mt-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-ink-700" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                    or
                  </span>
                  <span className="h-px flex-1 bg-ink-700" />
                </div>

                <Button
                  variant="outline"
                  size="lg"
                  className="mt-5 w-full"
                  icon={<GoogleMark />}
                  onClick={startGoogleSignIn}
                >
                  Continue with Google
                </Button>
              </>
            ) : null}

            <p className="mt-6 text-center text-[11px] leading-relaxed text-fg-subtle">
              Accounts are created by your administrator. There is no self-signup — if you
              don&rsquo;t have one, ask them to provision it.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Google's mark, inline so the page makes no external requests. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.64v3h3.86c2.26-2.09 3.57-5.17 3.57-8.88Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.28a12 12 0 0 0 0 10.76l3.99-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  )
}
