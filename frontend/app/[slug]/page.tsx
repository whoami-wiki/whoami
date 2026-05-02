import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPageStore } from '@/lib/server-services';
import { renderMarkdown } from '@/lib/render';
import { buildSlugIndex } from '@/lib/wikilinks';
import { isValidSlug } from '@core/pages/index.ts';

export const dynamic = 'force-dynamic';

export default async function PageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const store = getPageStore();
  let page;
  try { page = await store.read(slug); } catch { notFound(); }

  const all = await store.list();
  const index = buildSlugIndex(all.map(p => ({ slug: p.slug, title: p.title, aliases: [] })));
  const html = await renderMarkdown(page!.body, index);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/" className="text-sm text-muted-foreground">← Index</Link>
      <h1 className="text-3xl font-bold mt-4 mb-6">{page!.meta.title}</h1>
      <article className="prose dark:prose-invert" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
