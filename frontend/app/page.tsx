import Link from 'next/link';
import { getCachedList } from '@/lib/server-services';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { list: pages } = await getCachedList();
  const main = pages.filter(p => !p.isTalk && !p.isArchived);
  const talk = pages.filter(p => p.isTalk && !p.isArchived);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Whoami Wiki</h1>
          <p className="text-muted-foreground">{pages.length} pages</p>
        </div>
        <div className="flex gap-4 text-sm">
          <Link href="/family" className="text-blue-600 hover:underline">Family →</Link>
          <Link href="/search" className="text-blue-600 hover:underline">Search →</Link>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Pages ({main.length})</h2>
        <ul className="grid grid-cols-2 gap-x-6">
          {main.map(p => (
            <li key={p.slug}><Link href={`/${p.slug}`} className="text-blue-600 hover:underline">{p.title}</Link></li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Talk pages ({talk.length})</h2>
        <ul className="grid grid-cols-2 gap-x-6">
          {talk.map(p => (
            <li key={p.slug}><Link href={`/${p.slug}`} className="text-blue-600 hover:underline">{p.title} <span className="text-muted-foreground text-sm">(talk)</span></Link></li>
          ))}
        </ul>
      </section>
    </main>
  );
}
