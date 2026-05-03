import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AvatarMonogram } from './avatar-monogram';

interface Props {
  href: string;
  name: string;
  meta?: string | null;
  ordinal?: string;
  trailing?: ReactNode;
  side?: 'self' | 'paternal' | 'maternal' | null;
  portrait?: string | null;
}

export function PersonRow({ href, name, meta, ordinal, trailing, side, portrait }: Props) {
  return (
    <Link
      href={href}
      className={cn(
        'group/row flex items-center gap-3 px-4 py-2.5 transition-colors',
        'hover:bg-accent/45 active:bg-accent/65',
        'focus-visible:bg-accent/45 focus-visible:outline-none',
      )}
    >
      {ordinal ? (
        <span className="w-5 shrink-0 self-center font-display text-xs text-muted-foreground/70 tabular-nums">
          {ordinal}.
        </span>
      ) : null}
      <AvatarMonogram name={name} side={side} portrait={portrait} size="md" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[1.05rem] leading-tight tracking-tight text-foreground">
          {name}
        </div>
        {meta ? (
          <div className="mt-0.5 truncate font-mono text-[0.7rem] tracking-tight text-muted-foreground/90">
            {meta}
          </div>
        ) : null}
      </div>
      {trailing}
    </Link>
  );
}
