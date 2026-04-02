import { parseArgs } from 'node:util';
import { type WikiClient } from '../wiki-client.js';
import { UsageError, WaiError } from '../errors.js';
import { type GlobalFlags, outputJson, outputTable, outputPage } from '../output.js';

// ── Types ──────────────────────────────────────────────────────────────

type DocType = 'rfi' | 'submittal' | 'field-directive' | 'serial-letter';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  'rfi': 'RFI',
  'submittal': 'Submittal',
  'field-directive': 'Field Directive',
  'serial-letter': 'Serial Letter',
};

// ── Dispatcher ─────────────────────────────────────────────────────────

export async function constructionCommand(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const sub = args[0];
  const subArgs = args.slice(1);

  switch (sub) {
    case 'list':
      return constructionList(subArgs, globals, client);
    case 'read':
      return constructionRead(subArgs, globals, client);
    case 'add':
      return constructionAdd(subArgs, globals, client);
    case 'update':
      return constructionUpdate(subArgs, globals, client);
    default:
      throw new UsageError(
        'Usage: wai construction <list|read|add|update>\n\n' +
        '  list [--type X] [--status X]       List construction documents\n' +
        '  read <number>                      Read a construction document\n' +
        '  add <type> --number N --subject S   Create a new document\n' +
        '  update <number> --status X          Update document status',
      );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

async function resolveConstructionNamespace(client: WikiClient): Promise<number> {
  const namespaces = await client.getNamespaces();
  const ns = namespaces.find((n) => n.name === 'Construction');
  if (!ns) {
    throw new WaiError('No "Construction" namespace found. Add NS_CONSTRUCTION to LocalSettings.php.', 1);
  }
  return ns.id;
}

function buildConstructionPage(opts: {
  type: string;
  number: string;
  subject: string;
  status: string;
  date_issued?: string;
  issued_by?: string;
  areas?: string;
  drawings?: string;
  specs?: string;
}): string {
  const lines: string[] = ['{{Infobox construction'];
  lines.push(`| type           = ${opts.type}`);
  lines.push(`| number         = ${opts.number}`);
  lines.push(`| subject        = ${opts.subject}`);
  lines.push(`| status         = ${opts.status}`);
  if (opts.date_issued) lines.push(`| date_issued    = ${opts.date_issued}`);
  if (opts.issued_by) lines.push(`| issued_by      = ${opts.issued_by}`);
  if (opts.areas) lines.push(`| areas          = ${opts.areas}`);
  if (opts.drawings) lines.push(`| drawings       = ${opts.drawings}`);
  if (opts.specs) lines.push(`| specs          = ${opts.specs}`);
  lines.push('}}');
  lines.push('');

  // Type-specific sections
  const typeLower = opts.type.toLowerCase();
  if (typeLower === 'rfi') {
    lines.push('== Question ==', '', '', '== Response ==', '', '', '== Pages Updated ==', '');
  } else if (typeLower === 'submittal') {
    lines.push('== Submittal Contents ==', '', '', '== Review Comments ==', '', '', '== Pages Updated ==', '');
  } else if (typeLower === 'field directive') {
    lines.push('== Directive ==', '', '', '== Basis ==', '', '', '== Pages Updated ==', '');
  } else {
    lines.push('== Content ==', '', '', '== Pages Updated ==', '');
  }

  // Categories
  lines.push(`[[Category:${opts.type}]]`);
  lines.push(`[[Category:${opts.status}]]`);

  return lines.join('\n');
}

// ── Subcommands ────────────────────────────────────────────────────────

async function constructionList(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      type: { type: 'string', short: 't' },
      status: { type: 'string', short: 's' },
      area: { type: 'string', short: 'a' },
    },
    allowPositionals: false,
    strict: false,
  });

  const type = values.type as string | undefined;
  const status = values.status as string | undefined;
  const area = values.area as string | undefined;

  let titles: string[];

  if (type) {
    const label = DOC_TYPE_LABELS[type as DocType] || type;
    titles = await client.listCategories(label);
    titles = titles.filter((t) => t.startsWith('Construction:'));
  } else if (status) {
    titles = await client.listCategories(status);
    titles = titles.filter((t) => t.startsWith('Construction:'));
  } else if (area) {
    const category = area.match(/^\d+$/) ? `Area ${area.padStart(2, '0')}` : area;
    titles = await client.listCategories(category);
    titles = titles.filter((t) => t.startsWith('Construction:'));
  } else {
    const nsId = await resolveConstructionNamespace(client);
    titles = await client.listAllPages(nsId);
  }

  if (globals.json) {
    outputJson(titles.map((t) => ({ title: t })));
  } else {
    if (titles.length === 0) {
      console.log('No construction documents found.');
      return;
    }
    outputTable(
      ['Document'],
      titles.map((t) => [t]),
    );
  }
}

async function constructionRead(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { positionals } = parseArgs({
    args,
    options: {},
    allowPositionals: true,
    strict: false,
  });

  const number = positionals.join(' ');
  if (!number) throw new UsageError('Usage: wai construction read <number>');

  const title = number.startsWith('Construction:') ? number : `Construction:${number}`;
  const page = await client.readPage(title);

  if (globals.json) {
    outputJson({ title: page.title, revid: page.revid, content: page.content });
  } else {
    outputPage(page);
  }
}

async function constructionAdd(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      number: { type: 'string', short: 'n' },
      subject: { type: 'string', short: 's' },
      status: { type: 'string', default: 'Open' },
      'issued-by': { type: 'string' },
      area: { type: 'string', short: 'a' },
      drawings: { type: 'string' },
      specs: { type: 'string' },
    },
    allowPositionals: true,
    strict: false,
  });

  const type = positionals[0];
  if (!type) {
    throw new UsageError(
      'Usage: wai construction add <type> --number N --subject "..."\n\n' +
      '  Types: rfi, submittal, field-directive, serial-letter',
    );
  }

  const number = values.number as string | undefined;
  const subject = values.subject as string | undefined;

  if (!number || !subject) {
    throw new UsageError('Required: --number and --subject');
  }

  const label = DOC_TYPE_LABELS[type as DocType] || type;
  const status = values.status as string;
  const today = new Date().toISOString().split('T')[0];

  const content = buildConstructionPage({
    type: label,
    number,
    subject,
    status,
    date_issued: today,
    issued_by: values['issued-by'] as string | undefined,
    areas: values.area as string | undefined,
    drawings: values.drawings as string | undefined,
    specs: values.specs as string | undefined,
  });

  const title = `Construction:${number}`;
  await client.createPage(title, content, `Create ${label} ${number}`);

  if (globals.json) {
    outputJson({ title, type: label, number, status: 'created' });
  } else {
    console.log(`Created ${title}`);
  }
}

async function constructionUpdate(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      status: { type: 'string', short: 's' },
    },
    allowPositionals: true,
    strict: false,
  });

  const number = positionals[0];
  if (!number) throw new UsageError('Usage: wai construction update <number> --status X');

  const newStatus = values.status as string | undefined;
  if (!newStatus) throw new UsageError('Required: --status');

  const title = number.startsWith('Construction:') ? number : `Construction:${number}`;
  const page = await client.readPage(title);

  // Update status in infobox
  const oldContent = page.content;
  const updatedContent = oldContent.replace(
    /\|\s*status\s*=\s*[^\n|]+/,
    `| status         = ${newStatus}`,
  );

  if (updatedContent === oldContent) {
    throw new WaiError(`Could not find status field in ${title}`, 1);
  }

  // Update category
  const finalContent = updatedContent
    .replace(/\[\[Category:(?:Open|Closed|Under Review|Approved|Approved as Noted|Revise and Resubmit|Rejected)\]\]/,
      `[[Category:${newStatus}]]`);

  await client.writePage(title, finalContent, `Update status to ${newStatus}`);

  if (globals.json) {
    outputJson({ title, status: newStatus });
  } else {
    console.log(`Updated ${title} → ${newStatus}`);
  }
}
