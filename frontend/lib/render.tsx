import type { ReactElement } from 'react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { visit } from 'unist-util-visit';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import type { DerivedRecord } from '@core/gedcom/types.ts';
import { directiveComponents } from '@/components/directives';
import { resolveWikilinks, type SlugIndex } from './wikilinks';

function directivesToHast() {
  return (tree: unknown) => {
    visit(tree as never, (node: never) => {
      const n = node as { type: string; name?: string; data?: { hName?: string; hProperties?: Record<string, unknown> }; attributes?: Record<string, string> };
      if (n.type === 'containerDirective' || n.type === 'leafDirective' || n.type === 'textDirective') {
        const data = n.data ?? (n.data = {});
        // Synthetic tag name — routed through our React components map
        data.hName = `directive-${n.name}`;
        data.hProperties = { ...(n.attributes ?? {}) };
      }
    });
  };
}

const directiveTagNames = Object.keys(directiveComponents).map(n => `directive-${n}`);

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...directiveTagNames, 'aside', 'span', 'figure', 'figcaption', 'cite'],
  attributes: {
    ...defaultSchema.attributes,
    ...Object.fromEntries(directiveTagNames.map(t => [t, ['type', 'snapshot', 'note', 'date', 'thread', 'speaker', 'by', 'cols']])),
    span: ['className'],
    table: ['className'],
    td: ['rowspan', 'colspan', 'className'],
    th: ['rowspan', 'colspan', 'className'],
  },
};

const pipeline = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(directivesToHast)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeSanitize, sanitizeSchema);

interface RenderContext {
  derived?: DerivedRecord | null;
}

/**
 * Render markdown into a React tree, mapping `:::name{…}` directives to the
 * components in `components/directives/`. The `context.derived` value, when
 * provided, is forwarded to the InfoboxPerson component so it can render
 * structured fields from `genealogy/derived/<record>.yml` instead of (or in
 * addition to) the YAML body the converter emitted.
 */
export async function renderMarkdown(
  md: string,
  index: SlugIndex,
  context: RenderContext = {},
): Promise<ReactElement> {
  const tree = pipeline.parse(resolveWikilinks(md, index));
  const hast = await pipeline.run(tree);
  // Build a wrapping component map that injects `derived` into infobox-person
  const components: Record<string, (p: Record<string, unknown>) => ReactElement> = {};
  for (const [name, Comp] of Object.entries(directiveComponents)) {
    const tag = `directive-${name}`;
    if (name === 'infobox-person') {
      components[tag] = (p) => <Comp {...p} derived={context.derived} />;
    } else {
      components[tag] = (p) => <Comp {...p} />;
    }
  }
  return toJsxRuntime(hast as never, {
    Fragment,
    jsx: jsx as never,
    jsxs: jsxs as never,
    components: components as never,
  }) as ReactElement;
}
