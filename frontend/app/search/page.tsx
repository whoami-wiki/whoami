import Link from 'next/link';
import { searchAndJoin } from '@/lib/server-services';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const { q = '' } = await searchParams;
  const trimmed = q.trim();
  const results = await searchAndJoin(trimmed, 50);

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
      ) : results.length === 0 ? (
        <p className="text-muted-foreground">No results for &ldquo;{trimmed}&rdquo;.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-3">{results.length} result{results.length === 1 ? '' : 's'}</p>
          <ul className="space-y-2">
            {results.map(r => (
              <li key={r.slug}>
                <Link href={`/${r.slug}`} className="text-blue-600 hover:underline font-medium">{r.title}</Link>
                <span className="text-muted-foreground text-sm ml-2">({r.type})</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
