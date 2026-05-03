import { Card } from '@/components/ui/card';
import { AncestorTile } from '@/components/family/ancestor-tile';
import { roman } from '@/lib/utils';
import type { BrowserDescendantView, FamilyTreeView } from '@/lib/family';
import { DESCENDANT_HEADING, SectionHeader, familyTreeHref } from './shared';

interface Props {
  view: FamilyTreeView;
}

export function DescendantsSection({ view }: Props) {
  if (view.descendants.total === 0) return null;

  return (
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
  );
}

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
