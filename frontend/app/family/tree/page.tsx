import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileText, Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CommandPalette } from '@/components/command-palette';
import { GroupedList } from '@/components/family/grouped-list';
import { PersonRow } from '@/components/family/person-row';
import { AncestorTile } from '@/components/family/ancestor-tile';
import { LifespanBar } from '@/components/family/lifespan-bar';
import { BirthplacesMap } from '@/components/family/birthplaces-map';
import { SELF_RECORD } from '@/lib/env';
import {
  getFamilyTree,
  type BrowserPersonView,
  type BrowserRelationView,
  type BrowserDescendantView,
} from '@/lib/family';
import { roman } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ person?: string; from?: string }>;
}

const GENERATION_HEADING: Record<number, string> = {
  1: 'Parents',
  2: 'Grandparents',
  3: 'Great-grandparents',
  4: '2× Great-grandparents',
  5: '3× Great-grandparents',
  6: '4× Great-grandparents',
  7: '5× Great-grandparents',
  8: '6× Great-grandparents',
};

function familyTreeHref(person: string): string {
  return `/family/tree?person=${encodeURIComponent(person)}`;
}

function formatDates(person: BrowserPersonView): string | null {
  const birth = person.birth?.date ?? null;
  const death = person.death?.date ?? null;
  if (birth && death) return `${birth} – ${death}`;
  if (birth) return `b. ${birth}`;
  if (death) return `d. ${death}`;
  return null;
}

function formatTileMeta(person: BrowserPersonView): string | null {
  const dates = formatDates(person);
  const place = person.birth?.place ?? null;
  return [dates, place].filter(Boolean).join('  ·  ') || null;
}

function relationMeta(relation: BrowserRelationView): string | null {
  return relation.detail || null;
}


export default async function FamilyTreePage({ searchParams }: Props) {
  const params = await searchParams;
  const rootRecord = params.person ?? SELF_RECORD;
  const view = await getFamilyTree(rootRecord, rootRecord, params.from ?? null);
  if (!view) notFound();

  const person = view.root;
  const dates = formatDates(person);
  const isMe = person.record === SELF_RECORD;
  const { parents, spouses, children } = view.selectedRelations;
  const { siblings, cousins } = view.cohort;
  const immediateCount = parents.length + spouses.length + children.length;
  const cohortCount = siblings.length + cousins.length;
  const familyCount = immediateCount + cohortCount;

  const paternalGroups = view.byGeneration.map(g => ({ generation: g.generation, people: g.paternal }));
  const maternalGroups = view.byGeneration.map(g => ({ generation: g.generation, people: g.maternal }));
  let ancestorCount = 0;
  let generationCount = 0;
  for (const g of view.byGeneration) {
    const n = g.paternal.length + g.maternal.length;
    ancestorCount += n;
    if (n > 0) generationCount += 1;
  }
  const hasLineage = ancestorCount > 0;

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
        <section
          className="registry-rise mb-10 grid gap-6 border-b rule-hair pb-7 sm:grid-cols-[1fr_auto] sm:items-start"
          style={{ animationDelay: '0ms' }}
        >
          <div className="min-w-0">
            <p className="font-display text-[0.66rem] uppercase tracking-[0.32em] text-muted-foreground">
              Folio · {person.record}
            </p>
            <h1 className="mt-2 font-display text-[2.4rem] font-medium leading-[1.05] tracking-[-0.01em] text-balance text-foreground sm:text-[3rem]">
              {person.name}
            </h1>
            {(dates || person.birth?.place) ? (
              <p className="mt-2 font-mono text-sm tracking-tight text-muted-foreground">
                {dates ?? ''}
                {dates && person.birth?.place ? '  ·  ' : ''}
                {person.birth?.place ?? ''}
              </p>
            ) : null}

            {view.relationshipToSelf ? (
              <p className="mt-1.5 font-display text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground">
                {view.relationshipToSelf.label}{' '}
                <span className="text-muted-foreground/60">
                  · to {view.relationshipToSelf.perspective.isMe ? 'me' : view.relationshipToSelf.perspective.name}
                </span>
              </p>
            ) : null}

            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 border-t rule-hair pt-4 sm:max-w-lg sm:grid-cols-5">
              <Stat label="Parents" value={parents.length} />
              <Stat label="Siblings" value={siblings.length} />
              <Stat label="Spouses" value={spouses.length} />
              <Stat label="Children" value={children.length} />
              <Stat label="Ancestors" value={ancestorCount} sub={`${generationCount} gens`} />
            </dl>
          </div>

          {person.slug ? (
            <div className="flex items-start sm:pt-1">
              <Link
                href={`/${person.slug}`}
                className={buttonVariants({ variant: 'default', size: 'sm' })}
              >
                <FileText data-icon="inline-start" />
                Article
              </Link>
            </div>
          ) : null}
        </section>

        {familyCount > 0 ? (
          <section className="registry-rise mb-12" style={{ animationDelay: '80ms' }}>
            <SectionHeader title="Family" count={familyCount} />
            <div className="flex flex-col gap-6">
              {immediateCount > 0 ? (
                <GroupedList title="Immediate">
                  {[
                    ...parents.map(p => ({ kind: 'parent' as const, person: p })),
                    ...spouses.map(p => ({ kind: 'spouse' as const, person: p })),
                    ...children.map(p => ({ kind: 'child' as const, person: p })),
                  ].map(({ kind, person: p }, i) => (
                    <PersonRow
                      key={`${kind}-${p.record}`}
                      href={familyTreeHref(p.record)}
                      name={p.name}
                      ordinal={roman(i + 1).toLowerCase()}
                      meta={relationMeta(p)}
                      portrait={p.portrait}
                      trailing={<RelationLabel>{kind}</RelationLabel>}
                    />
                  ))}
                </GroupedList>
              ) : null}

              {siblings.length > 0 ? (
                <GroupedList title={`Siblings (${siblings.length})`}>
                  {siblings.map((s, i) => (
                    <PersonRow
                      key={`sibling-${s.record}`}
                      href={familyTreeHref(s.record)}
                      name={s.name}
                      ordinal={roman(i + 1).toLowerCase()}
                      meta={s.detail}
                      portrait={s.portrait}
                      trailing={
                        <RelationLabel>
                          {s.kind === 'half' ? 'half-sibling' : 'sibling'}
                        </RelationLabel>
                      }
                    />
                  ))}
                </GroupedList>
              ) : null}

              {cousins.length > 0 ? (
                <GroupedList title={`First cousins (${cousins.length})`}>
                  {cousins.map((c, i) => (
                    <PersonRow
                      key={`cousin-${c.record}`}
                      href={familyTreeHref(c.record)}
                      name={c.name}
                      ordinal={roman(i + 1).toLowerCase()}
                      meta={[c.detail, `via ${c.via}`].filter(Boolean).join('  ·  ')}
                      portrait={c.portrait}
                      trailing={<RelationLabel>cousin</RelationLabel>}
                    />
                  ))}
                </GroupedList>
              ) : null}
            </div>
          </section>
        ) : null}

        {view.coverage.knownTotal > 0 ? (
          <section className="registry-rise mb-12" style={{ animationDelay: '100ms' }}>
            <SectionHeader
              title="Coverage"
              count={view.coverage.knownTotal}
              after={
                <p className="font-mono text-[0.7rem] tabular-nums text-muted-foreground/80">
                  {view.coverage.knownTotal} / {view.coverage.possibleTotal} known
                </p>
              }
            />
            <div className="grid gap-4 md:grid-cols-[auto_1fr]">
              <Card className="gap-0 overflow-hidden p-0 py-0 shadow-none ring-foreground/12">
                <header className="border-b rule-hair bg-muted/40 px-3 py-2">
                  <h3 className="font-display text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
                    Per generation
                  </h3>
                </header>
                <ul className="divide-y rule-hair">
                  {view.coverage.byGeneration.map(g => (
                    <li
                      key={`cov-${g.generation}`}
                      className="flex items-baseline justify-between gap-4 px-3 py-1.5 font-mono text-[0.72rem] tabular-nums"
                    >
                      <span className="text-muted-foreground/70 w-5">
                        {roman(g.generation)}
                      </span>
                      <span className="flex-1 truncate font-display tracking-tight text-foreground">
                        {GENERATION_HEADING[g.generation] ?? `Generation ${g.generation}`}
                      </span>
                      <span className={g.known === g.possible ? 'text-foreground' : 'text-muted-foreground'}>
                        {String(g.known).padStart(2, '0')} / {String(g.possible).padStart(2, '0')}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>

              {view.coverage.frontier.length > 0 ? (
                <Card className="gap-0 overflow-hidden p-0 py-0 shadow-none ring-foreground/12">
                  <header className="border-b rule-hair bg-muted/40 px-3 py-2 flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
                      Research frontier
                    </h3>
                    <span className="font-mono text-[0.62rem] tabular-nums text-muted-foreground/70">
                      {String(view.coverage.frontier.length).padStart(2, '0')}
                    </span>
                  </header>
                  <ul className="divide-y rule-hair">
                    {view.coverage.frontier.map(f => (
                      <li key={`fr-${f.record}`}>
                        <Link
                          href={familyTreeHref(f.record)}
                          className="flex items-baseline gap-3 px-3 py-1.5 transition-colors hover:bg-accent/45"
                        >
                          <span className="font-mono text-[0.62rem] tabular-nums text-muted-foreground/70 w-5 shrink-0">
                            {roman(f.generation)}
                          </span>
                          <span className="flex-1 truncate font-display tracking-tight text-foreground">
                            {f.name}
                          </span>
                          <span className="font-display text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
                            missing {f.missing === 'both' ? 'parents' : f.missing}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : (
                <Card className="flex items-center justify-center p-6 shadow-none ring-foreground/12">
                  <p className="font-display text-sm text-muted-foreground">
                    Lineage is complete to the configured depth.
                  </p>
                </Card>
              )}
            </div>
          </section>
        ) : null}

        {view.places.regions.length > 0 ? (
          <section className="registry-rise mb-12" style={{ animationDelay: '105ms' }}>
            <SectionHeader
              title="Places of birth"
              count={view.places.regions.reduce((s, r) => s + r.people.length, 0)}
              after={
                <p className="font-mono text-[0.7rem] tabular-nums text-muted-foreground/80">
                  {view.placesMap.mapped.length} located
                  {view.placesMap.unmapped.length > 0
                    ? ` · ${view.placesMap.unmapped.length} unlocated`
                    : ''}
                </p>
              }
            />

            {view.placesMap.mapped.length > 0 ? (
              <div className="mb-4">
                <BirthplacesMap
                  places={view.placesMap.mapped.map(m => ({
                    name: m.coord.name,
                    lat: m.coord.lat,
                    lon: m.coord.lon,
                    note: m.coord.note,
                    people: m.people.map(p => ({
                      record: p.record,
                      name: p.name,
                      place: p.place,
                      href: familyTreeHref(p.record),
                    })),
                  }))}
                />
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {view.places.regions.map(region => (
                <Card
                  key={`region-${region.region}`}
                  className="gap-0 overflow-hidden p-0 py-0 shadow-none ring-foreground/12"
                >
                  <header className="flex items-baseline justify-between gap-3 border-b rule-hair bg-muted/40 px-3 py-2">
                    <h3 className="truncate font-display text-[0.95rem] tracking-tight text-foreground">
                      {region.region}
                    </h3>
                    <span className="font-mono text-[0.65rem] tabular-nums text-muted-foreground/80">
                      {String(region.people.length).padStart(2, '0')}
                    </span>
                  </header>
                  <ul className="divide-y rule-hair">
                    {region.people.map(p => (
                      <li key={`region-${region.region}-${p.record}`}>
                        <Link
                          href={familyTreeHref(p.record)}
                          className="flex flex-col gap-0.5 px-3 py-1.5 transition-colors hover:bg-accent/45"
                        >
                          <span className="truncate font-display text-[0.85rem] tracking-tight text-foreground">
                            {p.name}
                          </span>
                          <span className="truncate font-mono text-[0.62rem] tracking-tight text-muted-foreground/80">
                            {p.place}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>

            {view.placesMap.unmapped.length > 0 ? (
              <div className="mt-6">
                <h3 className="mb-2 font-display text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
                  Unmapped places
                  <span className="ml-2 font-mono tabular-nums text-muted-foreground/70">
                    {view.placesMap.unmapped.length}
                  </span>
                </h3>
                <p className="mb-3 max-w-2xl font-display text-[0.78rem] leading-relaxed text-muted-foreground">
                  These places aren&rsquo;t yet in <code className="font-mono text-[0.72rem]">genealogy/places-coords.yml</code>.
                  Add an entry there to bring them onto the map. See{' '}
                  <code className="font-mono text-[0.72rem]">research-plans/places-research.md</code>{' '}
                  for current research notes.
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {view.placesMap.unmapped.map(u => (
                    <li
                      key={`unmapped-${u.place}`}
                      className="flex items-baseline justify-between gap-3 rounded border border-dashed rule-hair px-3 py-1.5 text-[0.78rem]"
                    >
                      <span className="truncate font-mono text-muted-foreground">{u.place}</span>
                      <span className="font-mono text-[0.65rem] tabular-nums text-muted-foreground/70">
                        {u.people.length}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {view.timeline.entries.length > 0 && view.timeline.range ? (
          <section className="registry-rise mb-12" style={{ animationDelay: '110ms' }}>
            <SectionHeader
              title="Lifespans"
              count={view.timeline.entries.length}
              after={
                <p className="font-mono text-[0.7rem] tabular-nums text-muted-foreground/80">
                  {view.timeline.range.minYear} – {view.timeline.range.maxYear}
                </p>
              }
            />
            <Card className="gap-0 overflow-hidden p-0 py-0 shadow-none ring-foreground/12">
              <div className="divide-y rule-hair">
                {view.timeline.entries.map(e => (
                  <LifespanBar
                    key={`life-${e.record}`}
                    href={familyTreeHref(e.record)}
                    name={e.name}
                    birthYear={e.birthYear}
                    deathYear={e.deathYear}
                    side={e.side}
                    rangeMin={view.timeline.range!.minYear}
                    rangeMax={view.timeline.range!.maxYear}
                    endYear={e.deathYear ?? Math.min(new Date().getUTCFullYear(), e.birthYear + 70)}
                    birthQualified={e.birthQualified}
                    deathQualified={e.deathQualified}
                    portrait={e.portrait}
                  />
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {view.descendants.total > 0 ? (
          <section className="registry-rise mb-12" style={{ animationDelay: '120ms' }}>
            <SectionHeader title="Descendants" count={view.descendants.total} />
            <Card className="gap-0 overflow-hidden p-0 py-0 shadow-none ring-foreground/12">
              {view.descendants.byGeneration.map(group => (
                <DescendantsBlock
                  key={`desc-${group.generation}`}
                  generation={group.generation}
                  people={group.people}
                />
              ))}
            </Card>
          </section>
        ) : null}

        {hasLineage ? (
          <section className="registry-rise" style={{ animationDelay: '160ms' }}>
            <SectionHeader
              title="Lineage"
              count={ancestorCount}
              after={
                <p className="font-display text-[0.7rem] tracking-tight text-muted-foreground">
                  <span className="inline-block size-1.5 -translate-y-px rounded-full bg-paternal mr-1.5 align-baseline" aria-hidden />
                  Paternal
                  <span className="mx-2 text-border">|</span>
                  <span className="inline-block size-1.5 -translate-y-px rounded-full bg-maternal mr-1.5 align-baseline" aria-hidden />
                  Maternal
                </p>
              }
            />
            <div className="grid gap-4 md:grid-cols-2">
              <LineageColumn title="Paternal" groups={paternalGroups} side="paternal" />
              <LineageColumn title="Maternal" groups={maternalGroups} side="maternal" />
            </div>
          </section>
        ) : null}

        {familyCount === 0 && !hasLineage && view.descendants.total === 0 ? (
          <p className="font-display text-center text-sm text-muted-foreground">
            No related records yet.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div>
      <dt className="font-display text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-medium tabular-nums leading-none text-foreground">
          {value}
        </span>
        {sub ? (
          <span className="font-mono text-[0.6rem] tracking-tight text-muted-foreground">
            {sub}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  after,
}: {
  title: string;
  count?: number;
  after?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 border-b rule-hair pb-2">
      <h2 className="flex items-baseline gap-2.5">
        <span className="font-display text-xs uppercase tracking-[0.32em] text-muted-foreground">
          {title}
        </span>
        {typeof count === 'number' ? (
          <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground/70">
            {String(count).padStart(2, '0')}
          </span>
        ) : null}
      </h2>
      {after}
    </div>
  );
}

function LineageColumn({
  title,
  groups,
  side,
}: {
  title: string;
  groups: { generation: number; people: BrowserPersonView[] }[];
  side: 'paternal' | 'maternal';
}) {
  const accentVar = side === 'paternal' ? 'var(--paternal)' : 'var(--maternal)';
  const total = groups.reduce((sum, g) => sum + g.people.length, 0);

  return (
    <Card
      className="gap-0 overflow-hidden p-0 py-0 shadow-none ring-foreground/12"
      style={{ borderLeft: `2px solid ${accentVar}` }}
    >
      <header className="flex items-center justify-between border-b rule-hair bg-muted/40 px-4 py-2.5">
        <div className="flex items-baseline gap-2.5">
          <h3 className="font-display text-lg font-medium tracking-tight text-foreground">
            {title}
          </h3>
          <span
            className="font-display text-[0.62rem] uppercase tracking-[0.22em]"
            style={{ color: accentVar }}
          >
            line
          </span>
        </div>
        <Badge
          variant="outline"
          className="border-foreground/15 bg-transparent font-mono text-[0.65rem] tabular-nums text-foreground/80"
        >
          {String(total).padStart(2, '0')}
        </Badge>
      </header>
      <div className="flex flex-col">
        {groups.map(group => (
          <GenerationBlock
            key={`${side}-${group.generation}`}
            generation={group.generation}
            people={group.people}
          />
        ))}
      </div>
    </Card>
  );
}

function GenerationBlock({
  generation,
  people,
}: {
  generation: number;
  people: BrowserPersonView[];
}) {
  const sidePossible = generation > 0 && generation <= 10 ? 2 ** (generation - 1) : null;
  const heading = GENERATION_HEADING[generation] ?? `Generation ${generation}`;
  const isEmpty = people.length === 0;

  return (
    <section className="border-b rule-hair last:border-b-0">
      <header className="flex items-baseline gap-3 px-3 py-1.5">
        <span className="font-display text-[0.7rem] font-medium tabular-nums tracking-tight text-muted-foreground/70">
          {roman(generation)}
        </span>
        <h4 className="flex-1 truncate font-display text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground">
          {heading}
        </h4>
        {sidePossible ? (
          <span className="font-mono text-[0.62rem] tabular-nums text-muted-foreground/70">
            {String(people.length).padStart(2, '0')} / {String(sidePossible).padStart(2, '0')}
          </span>
        ) : null}
      </header>
      {isEmpty ? (
        <p className="px-3 pb-2 font-mono text-[0.65rem] text-muted-foreground/55">— absentia —</p>
      ) : (
        <div className="grid gap-x-2 px-2 pb-1.5 sm:grid-cols-2">
          {people.map((p, i) => (
            <AncestorTile
              key={`${p.record}-${p.pathFromRoot.join('-')}`}
              href={familyTreeHref(p.record)}
              name={p.name}
              meta={formatTileMeta(p)}
              ordinal={roman(i + 1).toLowerCase()}
              side={p.side === 'self' ? null : p.side}
              portrait={p.portrait}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RelationLabel({ children }: { children: string }) {
  return (
    <span className="font-display text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </span>
  );
}

const DESCENDANT_HEADING: Record<number, string> = {
  1: 'Children',
  2: 'Grandchildren',
  3: 'Great-grandchildren',
  4: '2× Great-grandchildren',
  5: '3× Great-grandchildren',
};

function DescendantsBlock({
  generation,
  people,
}: {
  generation: number;
  people: BrowserDescendantView[];
}) {
  const heading = DESCENDANT_HEADING[generation] ?? `Generation +${generation}`;
  return (
    <section className="border-b rule-hair last:border-b-0">
      <header className="flex items-baseline gap-3 px-3 py-1.5">
        <span className="font-display text-[0.7rem] font-medium tabular-nums tracking-tight text-muted-foreground/70">
          +{roman(generation)}
        </span>
        <h4 className="flex-1 truncate font-display text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground">
          {heading}
        </h4>
        <span className="font-mono text-[0.62rem] tabular-nums text-muted-foreground/70">
          {String(people.length).padStart(2, '0')}
        </span>
      </header>
      <div className="grid gap-x-2 px-2 pb-1.5 sm:grid-cols-2">
        {people.map((p, i) => (
          <AncestorTile
            key={`desc-${p.record}-${i}`}
            href={familyTreeHref(p.record)}
            name={p.name}
            meta={[p.detail, `via ${p.via}`].filter(Boolean).join('  ·  ')}
            ordinal={roman(i + 1).toLowerCase()}
            portrait={p.portrait}
          />
        ))}
      </div>
    </section>
  );
}
