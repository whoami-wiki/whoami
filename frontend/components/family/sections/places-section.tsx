import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { BirthplacesMap } from '@/components/family/birthplaces-map';
import type { FamilyTreeView } from '@/lib/family';
import { SectionHeader, familyTreeHref } from './shared';

interface Props {
  view: FamilyTreeView;
}

export function PlacesSection({ view }: Props) {
  const { places, placesMap } = view;
  if (places.regions.length === 0) return null;

  const total = places.regions.reduce((s, r) => s + r.people.length, 0);

  return (
    <section className="registry-rise mb-12" style={{ animationDelay: '105ms' }}>
      <SectionHeader
        title="Places of birth"
        count={total}
        after={
          <p className="font-mono text-[0.7rem] tabular-nums text-muted-foreground/80">
            {placesMap.mapped.length} located
            {placesMap.unmapped.length > 0
              ? ` · ${placesMap.unmapped.length} unlocated`
              : ''}
          </p>
        }
      />

      {placesMap.mapped.length > 0 ? (
        <div className="mb-4">
          <BirthplacesMap
            places={placesMap.mapped.map(m => ({
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
        {places.regions.map(region => (
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

      {placesMap.unmapped.length > 0 ? (
        <div className="mt-6">
          <h3 className="mb-2 font-display text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
            Unmapped places
            <span className="ml-2 font-mono tabular-nums text-muted-foreground/70">
              {placesMap.unmapped.length}
            </span>
          </h3>
          <p className="mb-3 max-w-2xl font-display text-[0.78rem] leading-relaxed text-muted-foreground">
            These places aren&rsquo;t yet in <code className="font-mono text-[0.72rem]">genealogy/places-coords.yml</code>.
            Add an entry there to bring them onto the map. See{' '}
            <code className="font-mono text-[0.72rem]">research-plans/places-research.md</code>{' '}
            for current research notes.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {placesMap.unmapped.map(u => (
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
  );
}
