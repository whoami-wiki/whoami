import Link from 'next/link';
import { FileText } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import type { FamilyTreeView } from '@/lib/family';
import { Stat, formatDates } from './shared';

interface Props {
  view: FamilyTreeView;
  ancestorCount: number;
  generationCount: number;
}

export function PersonHeaderSection({ view, ancestorCount, generationCount }: Props) {
  const person = view.root;
  const dates = formatDates(person);
  const { parents, spouses, children } = view.selectedRelations;
  const { siblings } = view.cohort;

  return (
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

        {view.relationship ? (
          <p className="mt-1.5 font-display text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground">
            {view.relationship.label}{' '}
            <span className="text-muted-foreground/60">
              · to {view.relationship.perspective.isMe ? 'me' : view.relationship.perspective.name}
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
  );
}
