import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Home } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { CommandPalette } from '@/components/command-palette';
import { SELF_RECORD } from '@/lib/env';
import { getFamilyTree } from '@/lib/family';
import { CoverageSection } from '@/components/family/sections/coverage-section';
import { DescendantsSection } from '@/components/family/sections/descendants-section';
import { FamilySection } from '@/components/family/sections/family-section';
import { LifespansSection } from '@/components/family/sections/lifespans-section';
import { LineageSection } from '@/components/family/sections/lineage-section';
import { PersonHeaderSection } from '@/components/family/sections/person-header-section';
import { PlacesSection } from '@/components/family/sections/places-section';
import { familyTreeHref } from '@/components/family/sections/shared';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ person?: string; from?: string }>;
}

export default async function FamilyTreePage({ searchParams }: Props) {
  const params = await searchParams;
  const rootRecord = params.person ?? SELF_RECORD;
  const view = await getFamilyTree(rootRecord, params.from ?? null);
  if (!view) notFound();

  const isMe = view.root.record === SELF_RECORD;
  let ancestorCount = 0;
  let generationCount = 0;
  for (const g of view.byGeneration) {
    const n = g.paternal.length + g.maternal.length;
    ancestorCount += n;
    if (n > 0) generationCount += 1;
  }

  const familyCount = view.selectedRelations.parents.length
    + view.selectedRelations.spouses.length
    + view.selectedRelations.children.length
    + view.cohort.siblings.length
    + view.cohort.cousins.length;
  const isEmpty = familyCount === 0
    && ancestorCount === 0
    && view.descendants.total === 0;

  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b rule-hair bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <Link
            href="/family"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span className="font-display tracking-tight">Family</span>
          </Link>
          <div className="font-display text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground/80">
            The Registry
          </div>
          <div className="flex items-center gap-2">
            {!isMe ? (
              <Link
                href={familyTreeHref(SELF_RECORD)}
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                <Home data-icon="inline-start" />
                Me
              </Link>
            ) : null}
            <CommandPalette />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
        <PersonHeaderSection view={view} ancestorCount={ancestorCount} generationCount={generationCount} />
        <FamilySection view={view} />
        <CoverageSection view={view} />
        <PlacesSection view={view} />
        <LifespansSection view={view} />
        <DescendantsSection view={view} />
        <LineageSection view={view} />

        {isEmpty ? (
          <p className="font-display text-center text-sm text-muted-foreground">
            No related records yet.
          </p>
        ) : null}
      </div>
    </main>
  );
}
