import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';

export interface DirectiveNode {
  name: string;
  type: 'container' | 'leaf' | 'text';
  attrs: Record<string, string>;
  /** Inner text for container directives; undefined for leaf/text. */
  body?: string;
}

export interface HeadingEntry {
  depth: number;
  text: string;
}

export interface WikilinkEntry {
  target: string;
  anchor?: string;
  alt?: string;
}

export interface ParsedPage {
  directives: DirectiveNode[];
  headings: HeadingEntry[];
  wikilinks: WikilinkEntry[];
}

// Matches [[Target]], [[Target#anchor]], [[Target|alt]], [[Target#anchor|alt]].
// Mirrors frontend/lib/wikilinks.ts.
const WIKILINK_RE = /\[\[([^\]|#]+?)(?:#([^\]|]+?))?(?:\|([^\]]+?))?\]\]/g;

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

export function parsePageContent(md: string): ParsedPage {
  const directives: DirectiveNode[] = [];
  const headings: HeadingEntry[] = [];
  const wikilinks: WikilinkEntry[] = [];

  if (md.trim() === '') return { directives, headings, wikilinks };

  const tree = processor.parse(md);
  visit(tree as never, (node: never) => {
    const n = node as { type: string; depth?: number; name?: string; attributes?: Record<string, string>; children?: unknown[] };
    if (n.type === 'heading' && typeof n.depth === 'number') {
      headings.push({ depth: n.depth, text: textOf(n.children) });
      return;
    }
    if (n.type === 'containerDirective' || n.type === 'leafDirective' || n.type === 'textDirective') {
      const dirType =
        n.type === 'containerDirective' ? 'container' :
        n.type === 'leafDirective' ? 'leaf' : 'text';
      directives.push({
        name: n.name ?? '',
        type: dirType,
        attrs: { ...(n.attributes ?? {}) },
        body: dirType === 'container' ? textOf(n.children) : undefined,
      });
      return;
    }
  });

  for (const m of md.matchAll(WIKILINK_RE)) {
    const entry: WikilinkEntry = { target: m[1]!.trim() };
    const anchor = m[2]?.trim();
    const alt = m[3]?.trim();
    if (anchor) entry.anchor = anchor;
    if (alt) entry.alt = alt;
    wikilinks.push(entry);
  }

  return { directives, headings, wikilinks };
}

function textOf(children: unknown): string {
  if (!Array.isArray(children)) return '';
  const parts: string[] = [];
  for (const c of children) {
    const node = c as { type: string; value?: string; children?: unknown[] };
    if (node.type === 'text' && typeof node.value === 'string') {
      parts.push(node.value);
    } else if (Array.isArray(node.children)) {
      parts.push(textOf(node.children));
    } else if (typeof node.value === 'string') {
      parts.push(node.value);
    }
  }
  return parts.join('').trim();
}
