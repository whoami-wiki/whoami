import express from 'express';
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';

const PAGES_DIR = process.env.PAGES_DIR ?? `${process.env.HOME}/whoami/pages`;
const PORT = Number(process.env.PORT ?? 3000);

interface PageMeta {
  slug: string;       // includes `.talk` suffix for talk pages
  title: string;
  type: string;
  categories: string[];
  aliases: string[];
  isTalk: boolean;
}

const pages: PageMeta[] = [];
const slugByCanonicalTitle = new Map<string, string>();   // canonical title → main slug (no .talk)

function canonical(s: string): string {
  return s.toLowerCase().replace(/[\s_]+/g, ' ').trim();
}

for (const f of readdirSync(PAGES_DIR)) {
  if (!f.endsWith('.md') || f.startsWith('.')) continue;
  const isTalk = f.endsWith('.talk.md');
  const baseSlug = basename(f, isTalk ? '.talk.md' : '.md');
  const slug = isTalk ? `${baseSlug}.talk` : baseSlug;
  const fm = matter(readFileSync(join(PAGES_DIR, f), 'utf-8'));
  const title: string = fm.data.title ?? baseSlug;
  pages.push({
    slug,
    title,
    type: fm.data.type ?? 'page',
    categories: fm.data.categories ?? [],
    aliases: fm.data.aliases ?? [],
    isTalk,
  });
  if (!isTalk) {
    slugByCanonicalTitle.set(canonical(title), baseSlug);
    for (const alias of fm.data.aliases ?? []) {
      slugByCanonicalTitle.set(canonical(alias), baseSlug);
    }
  }
}

console.log(`Indexed ${pages.length} pages from ${PAGES_DIR}`);

// Wikilink preprocessor: [[A]] / [[A|B]] / [[A#S]] / [[A#S|B]] → markdown link or red span
function preprocessWikilinks(md: string): string {
  return md.replace(/\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g,
    (_whole, target: string, anchor: string | undefined, label: string | undefined) => {
      const slug = slugByCanonicalTitle.get(canonical(target));
      const text = label ?? (anchor ? `${target}#${anchor}` : target);
      if (!slug) {
        return `<span class="redlink">${escapeHtml(text)}</span>`;
      }
      const href = anchor
        ? `/wiki/${slug}#${anchor.toLowerCase().replace(/\s+/g, '-')}`
        : `/wiki/${slug}`;
      return `[${text}](${href})`;
    });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Map remark-directive nodes to HAST elements
function remarkDirectivesToHast() {
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

const pipeline = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(remarkDirectivesToHast)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeStringify, { allowDangerousHtml: true });

async function renderMarkdown(md: string): Promise<string> {
  const file = await pipeline.process(preprocessWikilinks(md));
  return String(file);
}

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header><a href="/" class="home">← Index</a></header>
<main>${body}</main>
</body>
</html>`;
}

function indexHtml(): string {
  const grouped: Record<string, PageMeta[]> = {};
  for (const p of pages) {
    const k = p.isTalk ? 'talk' : p.type;
    (grouped[k] ??= []).push(p);
  }
  const sectionsHtml = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, ps]) => {
      const items = ps
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(p => `<li><a href="/wiki/${p.slug}">${escapeHtml(p.title)}${p.isTalk ? ' <small>(talk)</small>' : ''}</a></li>`)
        .join('');
      return `<section><h2>${type} (${ps.length})</h2><ul>${items}</ul></section>`;
    }).join('');
  return htmlPage(
    'Whoami Wiki — Preview',
    `<h1>Whoami Wiki — Preview</h1><p>${pages.length} migrated pages.</p>${sectionsHtml}`
  );
}

const CSS = `
body { font-family: -apple-system, system-ui, "Segoe UI", sans-serif; max-width: 760px; margin: 2em auto; padding: 0 1em; line-height: 1.6; color: #222; }
header { padding-bottom: 0.8em; border-bottom: 1px solid #ddd; margin-bottom: 1em; }
header .home { color: #555; text-decoration: none; }
h1 { font-size: 2em; margin-bottom: 0.2em; }
h2 { font-size: 1.4em; margin-top: 1.5em; }
h3 { font-size: 1.15em; }
a { color: #0366d6; text-decoration: none; }
a:hover { text-decoration: underline; }
.redlink { color: #b22222; text-decoration: underline dashed; }
.directive { margin: 1em 0; padding: 0.8em 1em; background: #f6f8fa; border-left: 4px solid #0366d6; border-radius: 4px; }
.directive-infobox-person, .directive-infobox-company { background: #fff; border: 1px solid #ddd; border-left: 4px solid #888; max-width: 320px; float: right; margin-left: 1em; font-size: 0.9em; }
.directive-cite-vault, .directive-cite-message, .directive-cite-photo, .directive-cite-voice-note { font-size: 0.8em; color: #555; padding: 0.4em 0.8em; background: #fafafa; border-left-color: #999; }
.directive-open { background: #fff8c5; border-left-color: #d4a017; }
.directive-closed { background: #f0fff4; border-left-color: #28a745; }
.directive-superseded { background: #ffeaea; border-left-color: #b22222; }
.directive-blockquote { font-style: italic; border-left-color: #6f42c1; }
.directive-dialogue { border-left-color: #6f42c1; }
.directive-gap { background: #fff8c5; border-left-color: #d4a017; }
.directive-columns-list { columns: 2; }
ul, ol { padding-left: 1.5em; }
table { border-collapse: collapse; margin: 1em 0; }
th, td { border: 1px solid #ddd; padding: 6px 12px; }
code { background: #f6f8fa; padding: 0.1em 0.4em; border-radius: 3px; font-size: 0.9em; }
section ul { columns: 2; column-gap: 2em; }
section li { break-inside: avoid; }
`;

const app = express();

app.get('/style.css', (_req, res) => {
  res.type('text/css').send(CSS);
});

app.get('/', (_req, res) => {
  res.type('html').send(indexHtml());
});

app.get('/wiki/:slug', async (req, res) => {
  const slug = req.params.slug;
  const fileName = slug.endsWith('.talk') ? `${slug}.md` : `${slug}.md`;
  let raw: string;
  try {
    raw = readFileSync(join(PAGES_DIR, fileName), 'utf-8');
  } catch {
    res.status(404).type('html').send(htmlPage('Not Found', `<h1>Not Found</h1><p>No page <code>${escapeHtml(slug)}</code>.</p>`));
    return;
  }
  const fm = matter(raw);
  const html = await renderMarkdown(fm.content);
  const title: string = fm.data.title ?? slug;
  const body = `<h1>${escapeHtml(title)}</h1>${html}`;
  res.type('html').send(htmlPage(title, body));
});

app.listen(PORT, () => {
  console.log(`Wiki preview at http://localhost:${PORT}`);
});
