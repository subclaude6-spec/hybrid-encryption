import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react'
import { POSTS, formatPostDate, getPost } from '@/lib/blog'
import { Badge, Button } from '@/components/ui/primitives'
import { PublicHeader } from '@/components/layout/PublicHeader'

export default function BlogPost() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const post = getPost(slug)

  // An unknown slug goes back to the index rather than rendering an empty shell.
  if (!post) return <Navigate to="/blog" replace />

  const others = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2)

  return (
    <div className="h-full overflow-y-auto bg-ink-950">
      <PublicHeader />

      <main className="mx-auto max-w-2xl px-6 pb-20">
        <article className="py-12 sm:py-16">
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="size-4" />
            All posts
          </Link>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Badge tone="brand">{post.tag}</Badge>
            <span className="flex items-center gap-3 text-xs text-fg-subtle">
              <span>{formatPostDate(post.date)}</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {post.readingMinutes} min read
              </span>
            </span>
          </div>

          <h1 className="mt-5 text-[30px] font-semibold leading-[1.2] tracking-tight text-fg sm:text-[36px]">
            {post.title}
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-fg-muted">{post.lede}</p>

          <div className="mt-10 space-y-10 border-t border-ink-700 pt-10">
            {post.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-lg font-semibold tracking-tight text-fg">
                  {section.heading}
                </h2>
                <div className="mt-3 space-y-4 text-[15px] leading-[1.75] text-fg-muted">
                  {section.paragraphs.map((p) => (
                    <p key={p.slice(0, 40)}>{p}</p>
                  ))}
                </div>
                {section.bullets ? (
                  <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-fg-muted">
                    {section.bullets.map((b) => (
                      <li key={b} className="flex gap-3">
                        <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-brand-500" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </article>

        {/* ------------------------------------------------------------ demo CTA */}
        <section className="rounded-xl2 border border-ink-700 bg-ink-900 px-8 py-9 text-center">
          <h2 className="text-lg font-semibold tracking-tight text-fg">
            Try it for yourself
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
            The demo runs the same client-side encryption described in this post.
          </p>
          <Button
            size="lg"
            className="mt-6"
            onClick={() => navigate('/login')}
            icon={<ArrowRight className="size-4" />}
          >
            Live demo
          </Button>
        </section>

        {/* --------------------------------------------------------- keep reading */}
        {others.length ? (
          <section className="mt-14">
            <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
              Keep reading
            </p>
            <div className="mt-5 space-y-3">
              {others.map((other) => (
                <Link
                  key={other.slug}
                  to={`/blog/${other.slug}`}
                  className="group flex items-center justify-between gap-4 rounded-xl2 border border-ink-700 bg-ink-900 px-5 py-4 transition-colors hover:border-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg transition-colors group-hover:text-brand-400">
                      {other.title}
                    </p>
                    <p className="mt-1 text-xs text-fg-subtle">
                      {other.tag} &middot; {other.readingMinutes} min read
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand-400" />
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <footer className="border-t border-ink-700">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-6 py-7 text-[11px] text-fg-subtle">
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
