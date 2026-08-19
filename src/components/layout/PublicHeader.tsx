import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Button } from '../ui/primitives'

/**
 * Header for the signed-out pages (blog, privacy). The "Live demo" action sends
 * visitors into the app's sign-in screen.
 */
export function PublicHeader() {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-20 border-b border-ink-700 bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-6">
        <Link
          to="/blog"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-500 text-ink-onbrand">
            <ShieldCheck className="size-4.5" strokeWidth={2.4} />
          </span>
          <span className="leading-tight">
            <span className="block text-[13px] font-semibold text-fg">Hybrid Cloud</span>
            <span className="block text-[11px] text-fg-subtle">Encryption</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/blog"
            className="hidden rounded-lg px-3 py-2 text-sm text-fg-muted transition-colors hover:text-fg sm:block"
          >
            Blog
          </Link>
          <Link
            to="/privacy"
            className="hidden rounded-lg px-3 py-2 text-sm text-fg-muted transition-colors hover:text-fg sm:block"
          >
            Privacy
          </Link>

          <Button
            size="sm"
            className="ml-1"
            onClick={() => navigate('/login')}
            icon={<ArrowRight className="size-3.5" />}
          >
            Live demo
          </Button>
        </nav>
      </div>
    </header>
  )
}
