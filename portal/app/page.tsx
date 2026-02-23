import Link from 'next/link';
import { getSource } from '@/lib/source';
import type { RepoDoc } from '@/lib/github';

export const revalidate = 300;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function RepoCard({ doc, categorySlug }: { doc: RepoDoc; categorySlug?: string }) {
  const repoSlug = slugify(doc.fullName);
  const href = categorySlug
    ? `/docs/${categorySlug}/${repoSlug}`
    : `/docs/${repoSlug}`;

  return (
    <Link
      href={href}
      className="group rounded-xl border border-fd-border bg-fd-card p-6 transition hover:border-stripe-purple/50 hover:shadow-lg hover:shadow-stripe-purple/5"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stripe-purple/10 text-stripe-purple">
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-fd-foreground group-hover:text-stripe-purple transition-colors">
              {doc.title}
            </h3>
            {doc.isPrivate && (
              <span className="inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 ring-1 ring-inset ring-amber-500/20">
                PRIVATE
              </span>
            )}
          </div>
          <p className="text-sm text-fd-muted-foreground">{doc.description}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-stripe-purple opacity-0 transition group-hover:opacity-100">
        View docs
        <span aria-hidden="true">&rarr;</span>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const { docs, categorized, config } = await getSource();
  const hasCategories = categorized.categories.length > 0;
  const totalRepos = docs.length;

  return (
    <main className="min-h-screen">
      <section className="relative overflow-hidden bg-stripe-navy px-6 py-24 text-white sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-stripe-navy via-stripe-navy to-stripe-purple/30" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-stripe-cyan">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-stripe-cyan" />
            Auto-generated from source
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            {config.site.title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-300">
            {config.site.description}
          </p>
          {totalRepos > 0 && (
            <div className="mt-10">
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-lg bg-stripe-purple px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-stripe-purple/90 hover:shadow-stripe-purple/25"
              >
                Browse Documentation
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <h2 className="text-2xl font-bold tracking-tight text-fd-foreground">
          Repositories
        </h2>
        <p className="mt-2 text-fd-muted-foreground">
          Public API documentation from {totalRepos} repositor
          {totalRepos === 1 ? 'y' : 'ies'}.
        </p>

        {totalRepos === 0 ? (
          <div className="mt-12 rounded-xl border border-fd-border bg-fd-card p-12 text-center">
            <p className="text-fd-muted-foreground">
              No repositories with documentation found yet. Install the GitHub
              App on a repository to get started.
            </p>
          </div>
        ) : hasCategories ? (
          <div className="mt-8 space-y-12">
            {categorized.categories.map((cat) => {
              const catSlug = slugify(cat.name);
              return (
                <div key={cat.name}>
                  <h3 className="mb-4 text-lg font-semibold text-fd-foreground">
                    {cat.name}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {cat.docs.map((doc) => (
                      <RepoCard
                        key={doc.fullName}
                        doc={doc}
                        categorySlug={catSlug}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {categorized.uncategorized.length > 0 && (
              <div>
                <h3 className="mb-4 text-lg font-semibold text-fd-foreground">
                  Other
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {categorized.uncategorized.map((doc) => (
                    <RepoCard
                      key={doc.fullName}
                      doc={doc}
                      categorySlug="other"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((doc) => (
              <RepoCard key={doc.fullName} doc={doc} />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-fd-border px-6 py-8">
        <p className="text-center text-sm text-fd-muted-foreground">
          Powered by{' '}
          <a
            href="https://github.com/GeoDoo/github-docs-bot"
            className="font-medium text-fd-foreground hover:text-stripe-purple transition-colors"
          >
            github-docs-bot
          </a>
        </p>
      </footer>
    </main>
  );
}
