import { GroupedList } from '@/components/family/grouped-list';
import { PersonRow } from '@/components/family/person-row';
import { roman } from '@/lib/utils';
import type { FamilyTreeView } from '@/lib/family';
import { RelationLabel, SectionHeader, familyTreeHref, relationMeta } from './shared';

interface Props {
  view: FamilyTreeView;
}

export function FamilySection({ view }: Props) {
  const { parents, spouses, children } = view.selectedRelations;
  const { siblings, cousins } = view.cohort;
  const immediateCount = parents.length + spouses.length + children.length;
  const cohortCount = siblings.length + cousins.length;
  const familyCount = immediateCount + cohortCount;

  if (familyCount === 0) return null;

  return (
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
  );
}
