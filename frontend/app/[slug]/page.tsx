import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPageStore, getCachedList } from '@/lib/server-services';
import { renderMarkdown } from '@/lib/render';
import { loadDerivedRecord } from '@/lib/derived';
import { isValidSlug } from '@core/pages/index.ts';
import { FutureSchemaVersionError } from '@core/pages/migrations/index.ts';
import { WHOAMI_ROOT } from '@/lib/env';
import type { Page } from '@core/pages/index.ts';

export const dynamic = 'force-dynamic';

export default async function PageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const store = getPageStore();
  const indexPromise = getCachedList();

  let page: Page;
  try {
    page = await store.read(slug);
  } catch (err) {
    if (err instanceof FutureSchemaVersionError) {
      return (
        <main className="mx-auto max-w-3xl p-6">
          <Link href="/" className="text-sm text-muted-foreground">← Index</Link>
          <h1 className="text-3xl font-bold mt-4 mb-2">Code is out of date</h1>
          <p className="text-muted-foreground">
            This page was written by a newer version of the wiki
            (schema v{err.fromVersion}; this build understands v{err.current}).
            Pull the latest code to read it.
          </p>
        </main>
      );
    }
    notFound();
  }

  const { index } = await indexPromise;

  const derived = page.meta.gedcom?.record
    ? await loadDerivedRecord(WHOAMI_ROOT, page.meta.gedcom.record)
    : null;

  const tree = await renderMarkdown(page.body, index, { derived });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/" className="text-sm text-muted-foreground">← Index</Link>
      <h1 className="text-3xl font-bold mt-4 mb-6">{page.meta.title}</h1>
      <article className="prose dark:prose-invert max-w-none">{tree}</article>
    </main>
  );
}
