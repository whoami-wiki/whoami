import type { ComponentType, ReactNode } from 'react';
import { Admonition } from './admonition';
import { DirectiveBlockquote } from './blockquote';

/**
 * Map keyed by directive name (the part after `:::` in markdown). Used by
 * `lib/render.tsx` to swap `directive-NAME` HAST elements for real React
 * components.
 */
export const directiveComponents: Record<string, ComponentType<{ children?: ReactNode; [k: string]: unknown }>> = {
  open:       (p) => <Admonition kind="open">{p.children}</Admonition>,
  closed:     (p) => <Admonition kind="closed">{p.children}</Admonition>,
  superseded: (p) => <Admonition kind="superseded">{p.children}</Admonition>,
  gap:        (p) => <Admonition kind="gap">{p.children}</Admonition>,
  blockquote: (p) => <DirectiveBlockquote by={typeof p.by === 'string' ? p.by : undefined}>{p.children}</DirectiveBlockquote>,
};
