import type { ComponentType, ReactNode } from 'react';
import { Admonition } from './admonition';
import { DirectiveBlockquote } from './blockquote';
import { CiteVault } from './cite-vault';
import { CiteMessage } from './cite-message';
import { Dialogue } from './dialogue';
import { ColumnsList } from './columns-list';

export const directiveComponents: Record<string, ComponentType<{ children?: ReactNode; [k: string]: unknown }>> = {
  open:           (p) => <Admonition kind="open">{p.children}</Admonition>,
  closed:         (p) => <Admonition kind="closed">{p.children}</Admonition>,
  superseded:     (p) => <Admonition kind="superseded">{p.children}</Admonition>,
  gap:            (p) => <Admonition kind="gap">{p.children}</Admonition>,
  blockquote:     (p) => <DirectiveBlockquote by={typeof p.by === 'string' ? p.by : undefined}>{p.children}</DirectiveBlockquote>,
  'cite-vault':   (p) => <CiteVault type={p.type as string | undefined} snapshot={p.snapshot as string | undefined} note={p.note as string | undefined} />,
  'cite-message': (p) => <CiteMessage snapshot={p.snapshot as string | undefined} date={p.date as string | undefined} thread={p.thread as string | undefined} note={p.note as string | undefined} />,
  dialogue:       (p) => <Dialogue speaker={p.speaker as string | undefined}>{p.children}</Dialogue>,
  'columns-list': (p) => <ColumnsList cols={p.cols as string | undefined}>{p.children}</ColumnsList>,
};
