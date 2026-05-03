import Link from 'next/link';
import { AvatarMonogram } from './avatar-monogram';

interface Props {
  href: string;
  name: string;
  meta?: string | null;
  ordinal?: string;
  side?: 'self' | 'paternal' | 'maternal' | null;
  portrait?: string | null;
}

export function AncestorTile({ href, name, meta, ordinal, side, portrait }: Props) {
  return (
    <Link
      href={href}
      className="group/tile grid grid-cols-[1.5rem_1.5rem_1fr] items-center gap-x-2 rounded-sm px-2 py-1 transition-colors hover:bg-accent/45 active:bg-accent/65 focus-visible:bg-accent/45 focus-visible:outline-none"
    >
      <span className="self-center font-display text-[0.7rem] text-muted-foreground/65 tabular-nums">
        {ordinal ?? '·'}
      </span>
      <AvatarMonogram name={name} side={side} portrait={portrait} size="sm" />
      <div className="min-w-0">
        <div className="truncate font-display text-[0.95rem] leading-snug tracking-tight text-foreground">
          {name}
        </div>
        {meta ? (
          <div className="truncate font-mono text-[0.65rem] tracking-tight text-muted-foreground/85">
            {meta}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
