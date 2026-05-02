import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { DerivedRecord } from '@core/gedcom/types.ts';
import yaml from 'js-yaml';
import { toSlug } from '@/lib/slug';

interface Props {
  derived?: DerivedRecord | null;
  children?: ReactNode;
}

export function InfoboxPerson({ derived, children }: Props) {
  const fields = extractFieldsFromChildren(children);
  const name = derived?.name ?? fields.name ?? 'Person';

  return (
    <Card className="float-right ml-4 max-w-xs my-2 text-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {derived ? <DerivedRows d={derived} /> : <FallbackRows fields={fields} />}
      </CardContent>
    </Card>
  );
}

function DerivedRows({ d }: { d: DerivedRecord }) {
  return (
    <>
      {d.birth ? <Row label="born">{[d.birth.date, d.birth.place].filter(Boolean).join(', ') || '—'}</Row> : null}
      {d.death ? <Row label="died">{[d.death.date, d.death.place].filter(Boolean).join(', ') || '—'}</Row> : null}
      {d.parents.length > 0 ? <Row label="parents"><PersonList items={d.parents} /></Row> : null}
      {d.spouses.length > 0 ? <Row label="spouses"><PersonList items={d.spouses} /></Row> : null}
      {d.children.length > 0 ? <Row label="children"><PersonList items={d.children} /></Row> : null}
      {d.residences.length > 0 ? (
        <Row label="residences">
          <ul className="list-none space-y-0.5">
            {d.residences.map((r, i) => (
              <li key={i}>{[r.date, r.place].filter(Boolean).join(', ')}</li>
            ))}
          </ul>
        </Row>
      ) : null}
      {d.occupations.length > 0 ? (
        <Row label="occupations">
          <ul className="list-none space-y-0.5">
            {d.occupations.map((o, i) => (
              <li key={i}>{o.title}{o.date ? ` (${o.date})` : ''}</li>
            ))}
          </ul>
        </Row>
      ) : null}
    </>
  );
}

function FallbackRows({ fields }: { fields: Record<string, string> }) {
  return (
    <>
      {Object.entries(fields)
        .filter(([k]) => k !== 'name')
        .map(([k, v]) => <Row key={k} label={k}>{v}</Row>)}
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span> {children}
    </div>
  );
}

function PersonList({ items }: { items: { record: string; name: string }[] }) {
  return (
    <span>
      {items.map((p, i) => (
        <span key={p.record}>
          {i > 0 ? ', ' : ''}
          <Link href={`/${toSlug(p.name)}`} className="text-blue-600 hover:underline">{p.name}</Link>
        </span>
      ))}
    </span>
  );
}

function extractFieldsFromChildren(children: ReactNode): Record<string, string> {
  const text = childrenToText(children).trim();
  try {
    const parsed = yaml.load(text);
    if (parsed && typeof parsed === 'object') {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]),
      );
    }
  } catch { /* ignore */ }
  return {};
}

function childrenToText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(childrenToText).join('\n');
  if (isValidElement(node)) {
    const props = (node as ReactElement<{ children?: ReactNode }>).props;
    return childrenToText(props.children ?? null);
  }
  return '';
}
