import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { roman } from '@/lib/utils';
import type { FamilyTreeView } from '@/lib/family';
import { GENERATION_HEADING, SectionHeader, familyTreeHref } from './shared';

interface Props {
  view: FamilyTreeView;
}

export function CoverageSection({ view }: Props) {
  const { coverage } = view;
  if (coverage.knownTotal === 0) return null;

  return (
    <section className="registry-rise mb-12" style={{ animationDelay: '100ms' }}>
      <SectionHeader
        title="Coverage"
        count={coverage.knownTotal}
        after={
          <p className="font-mono text-[0.7rem] tabular-nums text-muted-foreground/80">
            {coverage.knownTotal} / {coverage.possibleTotal} known
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
            {coverage.byGeneration.map(g => (
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

        {coverage.frontier.length > 0 ? (
          <Card className="gap-0 overflow-hidden p-0 py-0 shadow-none ring-foreground/12">
            <header className="border-b rule-hair bg-muted/40 px-3 py-2 flex items-baseline justify-between gap-3">
              <h3 className="font-display text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
                Research frontier
              </h3>
              <span className="font-mono text-[0.62rem] tabular-nums text-muted-foreground/70">
                {String(coverage.frontier.length).padStart(2, '0')}
              </span>
            </header>
            <ul className="divide-y rule-hair">
              {coverage.frontier.map(f => (
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
  );
}
