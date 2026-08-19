import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Clock } from 'lucide-react'
import { POSTS, formatPostDate } from '@/lib/blog'
import { Badge, Button } from '@/components/ui/primitives'
import { PublicHeader } from '@/components/layout/PublicHeader'

export default function Blog() {
  const navigate = useNavigate()
  const [featured, ...rest] = POSTS

  return (
    <div className="h-full overflow-y-auto bg-ink-950">
      <PublicHeader />

      <main className="mx-auto max-w-5xl px-6 pb-20">
        {/* ------------------------------------------------------------- hero */}
        <section className="border-b border-ink-700 py-14 sm:py-20">
          <Badge tone="brand">Engineering notes</Badge>
          <h1 className="mt-5 max-w-2xl text-[34px] font-semibold leading-[1.15] tracking-tight text-fg sm:text-[42px]">
            How we build encryption people actually use
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-fg-muted">
            Write-ups on the cryptography, architecture, and product decisions behind Hybrid
            Cloud Encryption — including the trade-offs we accepted and the ones we did not.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              onClick={() => navigate('/login')}
              icon={<ArrowRight className="size-4" />}
            >
              Live demo
            </Button>
            <span className="text-xs text-fg-subtle">
              Opens the sign-in screen — accounts are provisioned by an administrator.
            </span>
          </div>
        </section>

        {/* --------------------------------------------------------- featured */}
        {featured ? (
          <section className="border-b border-ink-700 py-12">
            <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
              Latest
            </p>
            <Link
              to={`/blog/${featured.slug}`}
              className="group mt-5 block rounded-xl2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="brand">{featured.tag}</Badge>
                <PostMeta date={featured.date} minutes={featured.readingMinutes} />
              </div>
              <h2 className="mt-4 max-w-3xl text-2xl font-semibold leading-snug tracking-tight text-fg transition-colors group-hover:text-brand-400 sm:text-[28px]">
                {featured.title}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">
                {featured.excerpt}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-400">
                Read post
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </section>
        ) : null}

        {/* ------------------------------------------------------ post grid */}
        <section className="py-12">
          <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
            More posts
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {rest.map((post) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group flex flex-col rounded-xl2 border border-ink-700 bg-ink-900 p-6 transition-all duration-200 hover:border-ink-600 hover:shadow-md hover:shadow-ink-600/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone="neutral">{post.tag}</Badge>
                  <PostMeta date={post.date} minutes={post.readingMinutes} />
                </div>
                <h3 className="mt-4 text-[17px] font-semibold leading-snug tracking-tight text-fg transition-colors group-hover:text-brand-400">
                  {post.title}
                </h3>
                <p className="mt-2.5 flex-1 text-[13px] leading-relaxed text-fg-muted">
                  {post.excerpt}
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-400">
                  Read post
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------- closing */}
        <section className="rounded-xl2 border border-ink-700 bg-ink-900 px-8 py-10 text-center">
          <h2 className="text-xl font-semibold tracking-tight text-fg">
            See it working end to end
          </h2>
          <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-fg-muted">
            Encrypt a file in the browser, send the ciphertext to cloud storage, and watch the
            audit trail record every step.
          </p>
          <Button
            size="lg"
            className="mt-7"
            onClick={() => navigate('/login')}
            icon={<ArrowRight className="size-4" />}
          >
            Live demo
          </Button>
        </section>
      </main>

      <footer className="border-t border-ink-700">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-7 text-[11px] text-fg-subtle">
          <span>&copy; {new Date().getFullYear()} Hybrid Cloud Encryption</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="transition-colors hover:text-fg-muted">
              Privacy policy
            </Link>
            <Link to="/login" className="transition-colors hover:text-fg-muted">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function PostMeta({ date, minutes }: { date: string; minutes: number }) {
  return (
    <span className="flex items-center gap-3 text-xs text-fg-subtle">
      <span>{formatPostDate(date)}</span>
      <span className="inline-flex items-center gap-1">
        <Clock className="size-3" />
        {minutes} min read
      </span>
    </span>
  )
}
