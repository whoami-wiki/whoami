import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { visit } from 'unist-util-visit';
import { resolveWikilinks, type SlugIndex } from './wikilinks';

function directivesToHast() {
  return (tree: unknown) => {
    visit(tree as never, (node: never) => {
      const n = node as { type: string; name?: string; data?: { hName?: string; hProperties?: Record<string, unknown> }; attributes?: Record<string, string> };
      if (n.type === 'containerDirective' || n.type === 'leafDirective' || n.type === 'textDirective') {
        const data = n.data ?? (n.data = {});
        data.hName = 'aside';
        data.hProperties = {
          className: ['directive', `directive-${n.name}`],
          ...(n.attributes ?? {}),
        };
      }
    });
  };
}

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'aside', 'span'],
  attributes: {
    ...defaultSchema.attributes,
    aside: ['className', 'type', 'snapshot', 'note', 'date', 'thread', 'speaker', 'by', 'cols'],
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
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeStringify);

export async function renderMarkdown(md: string, index: SlugIndex): Promise<string> {
  const file = await pipeline.process(resolveWikilinks(md, index));
  return String(file);
}
