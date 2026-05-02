import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFamily, type AncestorView } from '@/lib/family';

export const dynamic = 'force-dynamic';

const GENERATION_HEADING: Record<number, string> = {
  1: 'Parents',
  2: 'Grandparents',
  3: 'Great-grandparents',
  4: 'Great-great-grandparents',
  5: 'Great-great-great-grandparents',
  6: 'Great-great-great-great-grandparents',
};

function formatDates(a: AncestorView): string {
  const b = a.birth?.date ?? null;
  const d = a.death?.date ?? null;
  if (b && d) return `${b} - ${d}`;
  if (b) return `b. ${b}`;
  if (d) return `d. ${d}`;
  return '';
}

function lineTone(side: AncestorView['side']): string {
  if (side === 'paternal') return 'border-l-sky-500';
  if (side === 'maternal') return 'border-l-rose-500';
  return 'border-l-muted';
}

function PersonCard({ a }: { a: AncestorView }) {
  const dates = formatDates(a);
  const place = a.birth?.place ?? null;
  const line = a.side === 'paternal' ? 'Paternal line' : a.side === 'maternal' ? 'Maternal line' : 'Perspective';
  const titleNode = a.slug
    ? <Link href={`/${a.slug}`} className="text-primary underline-offset-4 hover:underline">{a.name}</Link>
    : a.name;
  return (
    <Card size="sm" className={`border-l-4 ${lineTone(a.side)}`}>
      <CardHeader>
        <CardDescription className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide">
          <span>{a.label}</span>
          <span aria-hidden="true">/</span>
          <span>{line}</span>
        </CardDescription>
        <CardTitle>{titleNode}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm">
        {dates ? <p className="text-sm">{dates}</p> : null}
        {place ? <p className="text-xs text-muted-foreground">{place}</p> : null}
        <p className="text-xs text-muted-foreground">{a.record}</p>
      </CardContent>
    </Card>
  );
}

export default async function FamilyPage() {
  const view = await getFamily();
  if (!view) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <Link href="/" className="text-sm text-muted-foreground">Index</Link>
        <h1 className="text-3xl font-bold mt-4 mb-4">Family</h1>
        <p className="text-muted-foreground">
          No derived data found for the configured perspective record. Run <code>POST /api/gedcom/sync</code> to populate <code>genealogy/derived/</code>.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <Link href="/" className="text-sm text-muted-foreground">Index</Link>
      <h1 className="text-3xl font-bold mt-4 mb-1">Family lines</h1>
      <p className="text-muted-foreground mb-6">
        Direct ancestors of <span className="font-semibold">{view.self.name}</span>, traced through paternal and maternal lines.
      </p>
      <p className="mb-6">
        <Link href="/family/tree" className="text-primary underline-offset-4 hover:underline">Browse the family tree</Link>
      </p>
      <div className="mb-8">
        <PersonCard a={view.self} />
      </div>

      {view.byGeneration.map(({ generation, ancestors }) => {
        const paternal = ancestors.filter(a => a.side === 'paternal');
        const maternal = ancestors.filter(a => a.side === 'maternal');
        return (
          <section key={generation} className="mb-10">
            <h2 className="text-xl font-semibold mb-4">{GENERATION_HEADING[generation] ?? `Generation ${generation}`}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Paternal line</h3>
                <div className="flex flex-col gap-3">
                  {paternal.length === 0
                    ? <p className="text-sm text-muted-foreground italic">unknown</p>
                    : paternal.map(a => <PersonCard key={a.record} a={a} />)}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Maternal line</h3>
                <div className="flex flex-col gap-3">
                  {maternal.length === 0
                    ? <p className="text-sm text-muted-foreground italic">unknown</p>
                    : maternal.map(a => <PersonCard key={a.record} a={a} />)}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
