import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { FileText, LocateFixed, Search, UserRound } from 'lucide-react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { SELF_RECORD } from '@/lib/env';
import { getFamilyTree, type BrowserPersonView, type BrowserRelationView } from '@/lib/family';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ person?: string; selected?: string }>;
}

const GENERATION_HEADING: Record<number, string> = {
  1: 'Parents',
  2: 'Grandparents',
  3: 'Great-grandparents',
  4: 'Great-great-grandparents',
  5: 'Great-great-great-grandparents',
  6: 'Great-great-great-great-grandparents',
};

function familyTreeHref(person: string, selected?: string): string {
  const params = new URLSearchParams({ person });
  if (selected) params.set('selected', selected);
  return `/family/tree?${params.toString()}`;
}

function formatDates(person: BrowserPersonView): string | null {
  const birth = person.birth?.date ?? null;
  const death = person.death?.date ?? null;
  if (birth && death) return `${birth} - ${death}`;
  if (birth) return `b. ${birth}`;
  if (death) return `d. ${death}`;
  return null;
}

function lineClasses(person: BrowserPersonView): string {
  if (person.side === 'paternal') return 'border-l-[var(--family-paternal)] bg-white/85';
  if (person.side === 'maternal') return 'border-l-[var(--family-maternal)] bg-white/85';
  return 'border-l-foreground/20 bg-white/90';
}

function lineAccent(side: BrowserPersonView['side']): string {
  if (side === 'paternal') return 'text-[var(--family-paternal-strong)]';
  if (side === 'maternal') return 'text-[var(--family-maternal-strong)]';
  return 'text-muted-foreground';
}

function PersonNode({
  person,
  rootRecord,
  selectedRecord,
}: {
  person: BrowserPersonView;
  rootRecord: string;
  selectedRecord: string;
}) {
  const dates = formatDates(person);
  const selected = person.record === selectedRecord;
  return (
    <Card
      size="sm"
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'group border-l-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_45px_rgba(15,23,42,0.10)] aria-current:ring-2 aria-current:ring-ring/50',
        lineClasses(person),
      )}
    >
      <CardHeader>
        <CardDescription className={cn('text-xs uppercase tracking-wide', lineAccent(person.side))}>
          {person.label}
        </CardDescription>
        <CardTitle className="truncate text-[0.95rem] tracking-normal">{person.name}</CardTitle>
        <CardAction>
          <Link
            href={familyTreeHref(rootRecord, person.record)}
            className={buttonVariants({ variant: selected ? 'secondary' : 'ghost', size: 'icon-sm' })}
            aria-label={`View ${person.name}`}
          >
            <UserRound data-icon="inline-start" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
        {dates ? <p>{dates}</p> : null}
        {person.birth?.place ? <p className="truncate">{person.birth.place}</p> : null}
        <p className="font-mono text-[0.68rem]">{person.record}</p>
      </CardContent>
    </Card>
  );
}

function RelationList({
  title,
  items,
  rootRecord,
}: {
  title: string;
  items: BrowserRelationView[];
  rootRecord: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Unknown</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(item => (
            <Link
              key={item.record}
              href={familyTreeHref(rootRecord, item.record)}
              className="group rounded-xl border bg-white/80 px-3 py-2 text-sm shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
            >
              <span className="font-medium">{item.name}</span>
              {item.detail ? <span className="ml-2 text-muted-foreground">{item.detail}</span> : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function SelectedPanel({
  selected,
  rootRecord,
  relations,
}: {
  selected: BrowserPersonView;
  rootRecord: string;
  relations: {
    parents: BrowserRelationView[];
    spouses: BrowserRelationView[];
    children: BrowserRelationView[];
  };
}) {
  const dates = formatDates(selected);
  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader>
        <div className="mb-2 flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--family-paternal-soft),var(--family-maternal-soft))] text-foreground shadow-inner">
          <UserRound />
        </div>
        <CardDescription className="text-xs uppercase tracking-wide">
          Selected person
        </CardDescription>
        <CardTitle className="text-2xl tracking-normal">{selected.name}</CardTitle>
        <CardDescription>{selected.label}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3 text-sm">
          {dates ? (
            <p><span className="font-medium">Dates:</span> <span className="text-muted-foreground">{dates}</span></p>
          ) : null}
          {selected.birth?.place ? (
            <p><span className="font-medium">Birthplace:</span> <span className="text-muted-foreground">{selected.birth.place}</span></p>
          ) : null}
          <p><span className="font-medium">Record:</span> <span className="text-muted-foreground">{selected.record}</span></p>
        </div>

        <div className="flex flex-wrap gap-2">
          {selected.slug ? (
            <Link href={`/${selected.slug}`} className={buttonVariants({ variant: 'default', size: 'sm' })}>
              <FileText data-icon="inline-start" />
              Open page
            </Link>
          ) : null}
          <Link href={familyTreeHref(selected.record, selected.record)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <LocateFixed data-icon="inline-start" />
            Center here
          </Link>
        </div>

        <div className="flex flex-col gap-4">
          <RelationList title="Parents" items={relations.parents} rootRecord={rootRecord} />
          <RelationList title="Spouses" items={relations.spouses} rootRecord={rootRecord} />
          <RelationList title="Children" items={relations.children} rootRecord={rootRecord} />
        </div>
      </CardContent>
    </Card>
  );
}

export default async function FamilyTreePage({ searchParams }: Props) {
  const params = await searchParams;
  const rootRecord = params.person ?? SELF_RECORD;
  const selectedRecord = params.selected ?? rootRecord;
  const view = await getFamilyTree(rootRecord, selectedRecord);
  if (!view) notFound();

  return (
    <main
      className="family-tree-surface mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-6 p-4 sm:p-6"
      style={{
        '--family-paternal': 'oklch(0.60 0.16 247)',
        '--family-paternal-strong': 'oklch(0.42 0.16 247)',
        '--family-paternal-soft': 'oklch(0.92 0.05 247)',
        '--family-maternal': 'oklch(0.65 0.18 18)',
        '--family-maternal-strong': 'oklch(0.45 0.17 18)',
        '--family-maternal-soft': 'oklch(0.93 0.05 18)',
      } as CSSProperties}
    >
      <div className="flex flex-col gap-5 rounded-3xl border bg-white/70 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Link href="/family" className="text-sm text-muted-foreground hover:text-foreground">Family lines</Link>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Perspective</p>
            <h1 className="text-4xl font-semibold tracking-normal text-balance">{view.root.name}</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Browse the tree by family line. Select any person for context, or center the tree around them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={familyTreeHref(SELF_RECORD, SELF_RECORD)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Steven
          </Link>
          <Link href="/search" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <Search data-icon="inline-start" />
            Search
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="overflow-hidden rounded-3xl border bg-white/55 p-3 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-5">
          <div className="mb-5 flex justify-center">
            <div className="w-full max-w-md">
              <PersonNode person={view.root} rootRecord={view.root.record} selectedRecord={view.selected.record} />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-[var(--family-paternal)]/20 bg-[linear-gradient(180deg,var(--family-paternal-soft),rgba(255,255,255,0.72))] p-3 shadow-inner sm:p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--family-paternal-strong)]">Paternal line</h2>
                <span className="rounded-full bg-white/70 px-2 py-1 text-xs text-[var(--family-paternal-strong)] shadow-sm">father side</span>
              </div>
              <div className="flex flex-col gap-5">
                {view.byGeneration.map(group => (
                  <section key={`p-${group.generation}`} className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium text-foreground/80">{GENERATION_HEADING[group.generation] ?? `Generation ${group.generation}`}</h3>
                    <div className="grid gap-2 md:grid-cols-2">
                      {group.paternal.length === 0
                        ? <p className="text-sm text-muted-foreground">Unknown</p>
                        : group.paternal.map(person => (
                          <PersonNode
                            key={`${person.record}-${person.pathFromRoot.join('-')}-p`}
                            person={person}
                            rootRecord={view.root.record}
                            selectedRecord={view.selected.record}
                          />
                        ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--family-maternal)]/20 bg-[linear-gradient(180deg,var(--family-maternal-soft),rgba(255,255,255,0.72))] p-3 shadow-inner sm:p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--family-maternal-strong)]">Maternal line</h2>
                <span className="rounded-full bg-white/70 px-2 py-1 text-xs text-[var(--family-maternal-strong)] shadow-sm">mother side</span>
              </div>
              <div className="flex flex-col gap-5">
                {view.byGeneration.map(group => (
                  <section key={`m-${group.generation}`} className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium">{GENERATION_HEADING[group.generation] ?? `Generation ${group.generation}`}</h3>
                    <div className="grid gap-2 md:grid-cols-2">
                      {group.maternal.length === 0
                        ? <p className="text-sm text-muted-foreground">Unknown</p>
                        : group.maternal.map(person => (
                          <PersonNode
                            key={`${person.record}-${person.pathFromRoot.join('-')}-m`}
                            person={person}
                            rootRecord={view.root.record}
                            selectedRecord={view.selected.record}
                          />
                        ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </section>

        <SelectedPanel
          selected={view.selected}
          rootRecord={view.root.record}
          relations={view.selectedRelations}
        />
      </div>
    </main>
  );
}
