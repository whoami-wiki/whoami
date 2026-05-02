import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPageStore, getCachedList } from '@/lib/server-services';
import { renderMarkdown } from '@/lib/render';
import { isValidSlug } from '@core/pages/index.ts';

export const dynamic = 'force-dynamic';

export default async function PageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const store = getPageStore();
  const [page, { index }] = await Promise.all([
    store.read(slug).catch(() => null),
    getCachedList(),
  ]);
  if (!page) notFound();

  const html = await renderMarkdown(page.body, index);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/" className="text-sm text-muted-foreground">← Index</Link>
      <h1 className="text-3xl font-bold mt-4 mb-6">{page.meta.title}</h1>
      <article className="prose dark:prose-invert" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
