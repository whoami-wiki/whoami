import { initials } from '@/lib/initials';

interface Props {
  name: string;
  side?: 'self' | 'paternal' | 'maternal' | null;
  portrait?: string | null;
  size?: 'sm' | 'md';
}

export function AvatarMonogram({ name, side, portrait, size = 'sm' }: Props) {
  const tint =
    side === 'paternal' ? 'var(--paternal)'
    : side === 'maternal' ? 'var(--maternal)'
    : 'var(--muted-foreground)';
  const px = size === 'md' ? 28 : 22;
  if (portrait) {
    return (
      <img
        src={portrait}
        alt=""
        aria-hidden
        className="shrink-0 rounded-full object-cover ring-1 ring-foreground/10"
        width={px}
        height={px}
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-medium tabular-nums text-background"
      aria-hidden
      style={{ width: px, height: px, backgroundColor: tint, opacity: 0.85, fontSize: size === 'md' ? '0.7rem' : '0.62rem' }}
    >
      {initials(name)}
    </span>
  );
}
