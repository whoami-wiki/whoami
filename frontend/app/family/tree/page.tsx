import Link from 'next/link';
import { notFound } from 'next/navigation';
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
  if (person.side === 'paternal') return 'border-l-primary bg-card';
  if (person.side === 'maternal') return 'border-l-destructive bg-card';
  return 'border-l-muted bg-card';
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
        'border-l-4 transition hover:ring-foreground/20 aria-current:ring-2 aria-current:ring-ring/60',
        lineClasses(person),
      )}
    >
      <CardHeader>
        <CardDescription className="text-xs uppercase tracking-wide">
          {person.label}
        </CardDescription>
        <CardTitle className="truncate">{person.name}</CardTitle>
        <CardAction>
          <Link
            href={familyTreeHref(rootRecord, person.record)}
            className={buttonVariants({ variant: selected ? 'secondary' : 'ghost', size: 'sm' })}
          >
            View
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
        {dates ? <p>{dates}</p> : null}
        {person.birth?.place ? <p className="truncate">{person.birth.place}</p> : null}
        <p>{person.record}</p>
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
              className="rounded-lg border bg-background px-3 py-2 text-sm transition hover:bg-muted"
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
        <CardDescription className="text-xs uppercase tracking-wide">
          Selected person
        </CardDescription>
        <CardTitle className="text-xl">{selected.name}</CardTitle>
        <CardDescription>{selected.label}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 text-sm">
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
              Open page
            </Link>
          ) : null}
          <Link href={familyTreeHref(selected.record, selected.record)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Link href="/family" className="text-sm text-muted-foreground hover:text-foreground">Family lines</Link>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Perspective</p>
            <h1 className="text-3xl font-semibold tracking-normal">{view.root.name}</h1>
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
            Search
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-3xl border bg-muted/30 p-3 sm:p-5">
          <div className="mb-5 flex justify-center">
            <div className="w-full max-w-md">
              <PersonNode person={view.root} rootRecord={view.root.record} selectedRecord={view.selected.record} />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border bg-background/70 p-3 sm:p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Paternal line</h2>
                <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">father side</span>
              </div>
              <div className="flex flex-col gap-5">
                {view.byGeneration.map(group => (
                  <section key={`p-${group.generation}`} className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium">{GENERATION_HEADING[group.generation] ?? `Generation ${group.generation}`}</h3>
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

            <div className="rounded-2xl border bg-background/70 p-3 sm:p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Maternal line</h2>
                <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">mother side</span>
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
