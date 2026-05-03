import type { ReactNode } from 'react';
import type { BrowserPersonView, BrowserRelationView } from '@/lib/family';

export const GENERATION_HEADING: Record<number, string> = {
  1: 'Parents',
  2: 'Grandparents',
  3: 'Great-grandparents',
  4: '2× Great-grandparents',
  5: '3× Great-grandparents',
  6: '4× Great-grandparents',
  7: '5× Great-grandparents',
  8: '6× Great-grandparents',
};

export const DESCENDANT_HEADING: Record<number, string> = {
  1: 'Children',
  2: 'Grandchildren',
  3: 'Great-grandchildren',
  4: '2× Great-grandchildren',
  5: '3× Great-grandchildren',
};

export function familyTreeHref(person: string): string {
  return `/family/tree?person=${encodeURIComponent(person)}`;
}

export function formatDates(person: BrowserPersonView): string | null {
  const birth = person.birth?.date ?? null;
  const death = person.death?.date ?? null;
  if (birth && death) return `${birth} – ${death}`;
  if (birth) return `b. ${birth}`;
  if (death) return `d. ${death}`;
  return null;
}

export function formatTileMeta(person: BrowserPersonView): string | null {
  const dates = formatDates(person);
  const place = person.birth?.place ?? null;
  return [dates, place].filter(Boolean).join('  ·  ') || null;
}

export function relationMeta(relation: BrowserRelationView): string | null {
  return relation.detail || null;
}

export function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
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

export function SectionHeader({
  title,
  count,
  after,
}: {
  title: string;
  count?: number;
  after?: ReactNode;
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

export function RelationLabel({ children }: { children: string }) {
  return (
    <span className="font-display text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </span>
  );
}
