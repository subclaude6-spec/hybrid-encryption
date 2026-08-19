import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Eye,
  EyeOff,
  FileLock2,
  Loader2,
  Lock,
  LogIn,
  Mail,
  ScrollText,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import {
  describeAuthError,
  fetchAuthConfig,
  signInWithPassword,
  startGoogleSignIn,
} from '@/lib/auth'
import { Button, Input } from '@/components/ui/primitives'
import LightRays from '@/components/LightRays'

const TRUST_POINTS = [
  {
    icon: FileLock2,
    title: 'Hybrid AES + RSA encryption',
    body: 'Files are sealed in your browser. Plaintext never reaches the server or the cloud provider.',
  },
  {
    icon: UserCheck,
    title: 'Administrator-provisioned access',
    body: 'No self-signup. Every account is issued, scoped, and revocable by your security team.',
  },
  {
    icon: ScrollText,
    title: 'Complete audit trail',
    body: 'Every encrypt, decrypt, and download is recorded with actor, file, and timestamp.',
  },
]

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
    <div className="grid h-full grid-cols-1 bg-ink-950 lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      {/* ------------------------------------------------------- sign-in column */}
      <div className="flex h-full flex-col overflow-y-auto px-6 py-10 sm:px-10">
        <div className="flex w-full flex-1 items-center justify-center">
          <div className="animate-in-up w-full max-w-[380px]">
            {/* Compact wordmark — the brand panel is hidden at this width. */}
            <div className="mb-9 flex items-center gap-2.5 lg:hidden">
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-500 text-ink-onbrand">
                <ShieldCheck className="size-5" strokeWidth={2.4} />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-fg">Hybrid Cloud</p>
                <p className="text-[11px] text-fg-subtle">Encryption</p>
              </div>
            </div>

            <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-fg">
              Sign in
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              Use the account your administrator provisioned for you.
            </p>

            {error ? (
              <div
                role="alert"
                className="mt-6 flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/[0.06] px-3.5 py-3"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
                <p className="text-xs leading-relaxed text-danger">{error}</p>
              </div>
            ) : null}

            <form
              className="mt-7 space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              <Input
                label="Work email"
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
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-[30px] rounded-md p-1 text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
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
                <div className="mt-6 flex items-center gap-3">
                  <span className="h-px flex-1 bg-ink-700" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                    or
                  </span>
                  <span className="h-px flex-1 bg-ink-700" />
                </div>

                <Button
                  variant="outline"
                  size="lg"
                  className="mt-6 w-full"
                  icon={<GoogleMark />}
                  onClick={startGoogleSignIn}
                >
                  Continue with Google
                </Button>
              </>
            ) : null}

            <p className="mt-8 border-t border-ink-700 pt-5 text-[12px] leading-relaxed text-fg-subtle">
              Accounts are created by your administrator. There is no self-signup — if you
              don&rsquo;t have one, ask them to provision it.
            </p>
          </div>
        </div>

        <footer className="mt-10 flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-fg-subtle">
          <span>&copy; {new Date().getFullYear()} Hybrid Cloud Encryption</span>
          <Link
            to="/blog"
            className="transition-colors hover:text-fg-muted hover:underline"
          >
            Blog
          </Link>
          <Link
            to="/privacy"
            className="transition-colors hover:text-fg-muted hover:underline"
          >
            Privacy policy
          </Link>
        </footer>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- Brand panel */

/**
 * The marketing half of the split screen. Hidden below `lg`, where the form
 * takes the full width and carries a compact wordmark instead.
 */
function BrandPanel() {
  return (
    <div
      className="relative hidden overflow-hidden lg:flex lg:flex-col"
      style={{
        backgroundImage:
          'radial-gradient(125% 125% at 12% -10%, var(--color-brand-600) 0%, #06293a 42%, #04131c 100%)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 z-0 opacity-90">
        <LightRays
          raysOrigin="top-center"
          raysColor="#22d3ee"
          raysSpeed={0.9}
          lightSpread={0.9}
          rayLength={1.3}
          followMouse
          mouseInfluence={0.08}
          noiseAmount={0.06}
          distortion={0.03}
          saturation={0.9}
          fadeDistance={1.15}
        />
      </div>

      {/* Grounds the copy so the rays never wash out the text. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-2/3 bg-gradient-to-t from-black/45 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-sm">
            <ShieldCheck className="size-5" strokeWidth={2.2} />
          </span>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold text-white">Hybrid Cloud</p>
            <p className="text-xs text-white/55">Encryption</p>
          </div>
        </div>

        <div className="max-w-md">
          <h2 className="text-[32px] font-semibold leading-[1.15] tracking-tight text-white xl:text-[38px]">
            Your files stay encrypted.
            <br />
            Even from us.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65">
            Client-side hybrid encryption for teams that have to put sensitive
            documents in the cloud without handing over the keys.
          </p>

          <ul className="mt-8 space-y-5 [@media(max-height:560px)]:hidden xl:mt-10 xl:space-y-6">
            {TRUST_POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-cyan-200 ring-1 ring-white/15">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/55">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">
          AES-256-GCM &middot; RSA-OAEP &middot; Zero-knowledge storage
        </p>
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
