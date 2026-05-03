import { Card } from '@/components/ui/card';
import { LifespanBar } from '@/components/family/lifespan-bar';
import type { FamilyTreeView } from '@/lib/family';
import { SectionHeader, familyTreeHref } from './shared';

interface Props {
  view: FamilyTreeView;
}

export function LifespansSection({ view }: Props) {
  const { timeline } = view;
  if (timeline.entries.length === 0 || !timeline.range) return null;

  return (
    <section className="registry-rise mb-12" style={{ animationDelay: '110ms' }}>
      <SectionHeader
        title="Lifespans"
        count={timeline.entries.length}
        after={
          <p className="font-mono text-[0.7rem] tabular-nums text-muted-foreground/80">
            {timeline.range.minYear} – {timeline.range.maxYear}
          </p>
        }
      />
      <Card className="gap-0 overflow-hidden p-0 py-0 shadow-none ring-foreground/12">
        <div className="divide-y rule-hair">
          {timeline.entries.map(e => (
            <LifespanBar
              key={`life-${e.record}`}
              href={familyTreeHref(e.record)}
              name={e.name}
              birthYear={e.birthYear}
              deathYear={e.deathYear}
              side={e.side}
              rangeMin={timeline.range!.minYear}
              rangeMax={timeline.range!.maxYear}
              endYear={e.endYear}
              birthQualified={e.birthQualified}
              deathQualified={e.deathQualified}
              portrait={e.portrait}
            />
          ))}
        </div>
      </Card>
    </section>
  );
}
