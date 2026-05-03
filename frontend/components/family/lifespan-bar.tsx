import Link from 'next/link';
import { AvatarMonogram } from './avatar-monogram';

interface Props {
  href: string;
  name: string;
  birthYear: number;
  deathYear: number | null;
  side: 'self' | 'paternal' | 'maternal';
  rangeMin: number;
  rangeMax: number;
  endYear: number;
  birthQualified: boolean;
  deathQualified: boolean;
  portrait?: string | null;
}

function pct(year: number, min: number, max: number): number {
  if (max === min) return 0;
  return ((year - min) / (max - min)) * 100;
}

export function LifespanBar({
  href, name, birthYear, deathYear, side, rangeMin, rangeMax, endYear,
  birthQualified, deathQualified, portrait,
}: Props) {
  const left = pct(birthYear, rangeMin, rangeMax);
  const right = pct(endYear, rangeMin, rangeMax);
  const width = Math.max(0.5, right - left);
  const accent =
    side === 'paternal' ? 'var(--paternal)'
    : side === 'maternal' ? 'var(--maternal)'
    : 'var(--foreground)';
  const dates = deathYear
    ? `${birthQualified ? 'c. ' : ''}${birthYear} – ${deathQualified ? 'c. ' : ''}${deathYear}`
    : `${birthQualified ? 'c. ' : ''}${birthYear} –`;

  return (
    <Link
      href={href}
      className="grid grid-cols-[1.5rem_10rem_1fr_5rem] items-center gap-3 px-3 py-1.5 text-sm hover:bg-accent/45 transition-colors"
    >
      <AvatarMonogram name={name} side={side} portrait={portrait} size="sm" />
      <span className="truncate font-display tracking-tight text-foreground">{name}</span>
      <span className="relative h-2.5 rounded-sm bg-muted/40">
        <span
          className="absolute top-0 h-2.5 rounded-sm"
          style={{ left: `${left}%`, width: `${width}%`, backgroundColor: accent, opacity: deathYear ? 0.85 : 0.55 }}
          aria-hidden
        />
      </span>
      <span className="text-right font-mono text-[0.7rem] tabular-nums text-muted-foreground/85">
        {dates}
      </span>
    </Link>
  );
}
