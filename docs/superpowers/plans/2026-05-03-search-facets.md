# Search: Type Facets Implementation Plan

**Goal:** Add type-faceting to the search page — counts by type at the top, click-to-filter, results grouped under type headings — so users can quickly narrow "150 results" to "12 people" or "3 families."

**Scope cut:** Surname / decade / place facets need data joins that don't exist yet (search index is title/body text only, doesn't carry birth year or surname structure). Defer those.

**Architecture:** Pure client-rendered grouping over the existing `SearchResult[]`. Add a `type` query param (`?q=foo&type=person`) that filters results. Keep the search itself unchanged.

**Files:**
- Modify: `frontend/app/search/page.tsx` — add type tabs and grouped rendering. No new components needed.

---

### Task 1: Type-faceted search page

- [ ] Read existing page (already done — flat list).
- [ ] Replace with: counts per type at top, tabs (links toggling `?type=`), grouped result list when no type filter, flat list when filtered.

```tsx
import Link from 'next/link';
import { searchAndJoin } from '@/lib/server-services';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ q?: string; type?: string }>;
}

const TYPE_ORDER = ['person', 'family', 'event', 'tree', 'meta'] as const;
const TYPE_LABELS: Record<string, string> = {
  person: 'People',
  family: 'Families',
  event: 'Events',
  tree: 'Trees',
  meta: 'Meta',
};

export default async function SearchPage({ searchParams }: Props) {
  const { q = '', type } = await searchParams;
  const trimmed = q.trim();
  const all = await searchAndJoin(trimmed, 200);
  const filtered = type ? all.filter(r => r.type === type) : all;

  const counts = new Map<string, number>();
  for (const r of all) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);

  function tabHref(t?: string): string {
    const params = new URLSearchParams();
    if (trimmed) params.set('q', trimmed);
    if (t) params.set('type', t);
    const s = params.toString();
    return s ? `/search?${s}` : '/search';
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/" className="text-sm text-muted-foreground">← Index</Link>
      <h1 className="text-3xl font-bold mt-4 mb-4">Search</h1>
      <form className="mb-6">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search pages, places, people…"
          autoFocus
          className="w-full rounded border border-input bg-background px-3 py-2 text-sm shadow-sm"
        />
      </form>

      {trimmed === '' ? (
        <p className="text-muted-foreground">Type a query above. Searches title, body, aliases, categories, and structured GEDCOM data (places, occupations, related names).</p>
      ) : all.length === 0 ? (
        <p className="text-muted-foreground">No results for &ldquo;{trimmed}&rdquo;.</p>
      ) : (
        <>
          <nav className="mb-4 flex flex-wrap gap-1.5 border-b rule-hair pb-2">
            <Link
              href={tabHref()}
              className={`rounded-md px-2 py-1 text-xs font-display uppercase tracking-[0.16em] transition-colors ${
                !type ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:bg-accent/45'
              }`}
            >
              All <span className="ml-1 font-mono tabular-nums text-muted-foreground/80">{all.length}</span>
            </Link>
            {TYPE_ORDER.map(t => {
              const n = counts.get(t) ?? 0;
              if (n === 0) return null;
              const active = type === t;
              return (
                <Link
                  key={t}
                  href={tabHref(t)}
                  className={`rounded-md px-2 py-1 text-xs font-display uppercase tracking-[0.16em] transition-colors ${
                    active ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:bg-accent/45'
                  }`}
                >
                  {TYPE_LABELS[t] ?? t} <span className="ml-1 font-mono tabular-nums text-muted-foreground/80">{n}</span>
                </Link>
              );
            })}
          </nav>

          {type ? (
            <ul className="space-y-2">
              {filtered.map(r => (
                <li key={r.slug}>
                  <Link href={`/${r.slug}`} className="text-blue-600 hover:underline font-medium">{r.title}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-6">
              {TYPE_ORDER.map(t => {
                const items = all.filter(r => r.type === t);
                if (items.length === 0) return null;
                return (
                  <section key={t}>
                    <h2 className="mb-1.5 font-display text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
                      {TYPE_LABELS[t] ?? t}
                      <span className="ml-2 font-mono tabular-nums text-muted-foreground/70">{items.length}</span>
                    </h2>
                    <ul className="space-y-1">
                      {items.map(r => (
                        <li key={r.slug}>
                          <Link href={`/${r.slug}`} className="text-blue-600 hover:underline font-medium">{r.title}</Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
```

- [ ] Type-check + curl with `?q=` to verify rendering.
- [ ] Commit `feat: add type facets to search page`.

---

### Task 2: Roadmap

- [ ] Mark feature #7 shipped (note: type-only; surname/decade/place deferred).
