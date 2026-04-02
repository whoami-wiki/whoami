import { parseArgs } from 'node:util';
import { type WikiClient } from '../wiki-client.js';
import { UsageError, WaiError } from '../errors.js';
import { type GlobalFlags, outputJson, outputTable, outputPage } from '../output.js';

// ── Dispatcher ─────────────────────────────────────────────────────────

export async function issueCommand(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const sub = args[0];
  const subArgs = args.slice(1);

  switch (sub) {
    case 'list':
      return issueList(subArgs, globals, client);
    case 'read':
      return issueRead(subArgs, globals, client);
    case 'add':
      return issueAdd(subArgs, globals, client);
    case 'resolve':
      return issueResolve(subArgs, globals, client);
    default:
      throw new UsageError(
        'Usage: wai issue <list|read|add|resolve>\n\n' +
        '  list [--status X] [--severity X]   List issues\n' +
        '  read <id>                          Read an issue\n' +
        '  add --type X --subject "..."        Create a new issue\n' +
        '  resolve <id> --resolution "..."     Resolve an issue',
      );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

async function resolveIssueNamespace(client: WikiClient): Promise<number> {
  const namespaces = await client.getNamespaces();
  const ns = namespaces.find((n) => n.name === 'Issue');
  if (!ns) {
    throw new WaiError('No "Issue" namespace found. Add NS_ISSUE to LocalSettings.php.', 1);
  }
  return ns.id;
}

async function nextIssueId(client: WikiClient, nsId: number): Promise<string> {
  const titles = await client.listAllPages(nsId);
  let maxId = 0;
  for (const t of titles) {
    const num = parseInt(t.replace(/^Issue:/, ''), 10);
    if (!isNaN(num) && num > maxId) maxId = num;
  }
  return String(maxId + 1).padStart(3, '0');
}

function buildIssuePage(opts: {
  id: string;
  type: string;
  severity: string;
  status: string;
  areas?: string;
  disciplines?: string;
  discovered: string;
  discovered_by?: string;
  drawings?: string;
  specs?: string;
  description: string;
}): string {
  const lines: string[] = ['{{Infobox issue'];
  lines.push(`| id            = ${opts.id}`);
  lines.push(`| type          = ${opts.type}`);
  lines.push(`| severity      = ${opts.severity}`);
  lines.push(`| status        = ${opts.status}`);
  if (opts.areas) lines.push(`| areas         = ${opts.areas}`);
  if (opts.disciplines) lines.push(`| disciplines   = ${opts.disciplines}`);
  lines.push(`| discovered    = ${opts.discovered}`);
  if (opts.discovered_by) lines.push(`| discovered_by = ${opts.discovered_by}`);
  if (opts.drawings) lines.push(`| drawings      = ${opts.drawings}`);
  if (opts.specs) lines.push(`| specs         = ${opts.specs}`);
  lines.push('}}');
  lines.push('');
  lines.push('== Description ==');
  lines.push(opts.description);
  lines.push('');
  lines.push('== Impact ==');
  lines.push('');
  lines.push('== Recommended Action ==');
  lines.push('');
  lines.push('== Resolution ==');
  lines.push("''Pending''");
  lines.push('');
  lines.push(`[[Category:${opts.type}]]`);
  lines.push(`[[Category:${opts.severity}]]`);
  lines.push(`[[Category:${opts.status}]]`);

  return lines.join('\n');
}

// ── Subcommands ────────────────────────────────────────────────────────

async function issueList(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      status: { type: 'string', short: 's' },
      severity: { type: 'string' },
      type: { type: 'string', short: 't' },
    },
    allowPositionals: false,
    strict: false,
  });

  const status = values.status as string | undefined;
  const severity = values.severity as string | undefined;
  const type = values.type as string | undefined;

  let titles: string[];

  if (status) {
    titles = await client.listCategories(status);
    titles = titles.filter((t) => t.startsWith('Issue:'));
  } else if (severity) {
    titles = await client.listCategories(severity);
    titles = titles.filter((t) => t.startsWith('Issue:'));
  } else if (type) {
    titles = await client.listCategories(type);
    titles = titles.filter((t) => t.startsWith('Issue:'));
  } else {
    const nsId = await resolveIssueNamespace(client);
    titles = await client.listAllPages(nsId);
  }

  if (globals.json) {
    outputJson(titles.map((t) => ({ title: t })));
  } else {
    if (titles.length === 0) {
      console.log('No issues found.');
      return;
    }
    outputTable(
      ['Issue'],
      titles.map((t) => [t]),
    );
  }
}

async function issueRead(
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

  const id = positionals[0];
  if (!id) throw new UsageError('Usage: wai issue read <id>');

  const title = id.startsWith('Issue:') ? id : `Issue:${id}`;
  const page = await client.readPage(title);

  if (globals.json) {
    outputJson({ title: page.title, revid: page.revid, content: page.content });
  } else {
    outputPage(page);
  }
}

async function issueAdd(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      type: { type: 'string', short: 't' },
      severity: { type: 'string', default: 'Major' },
      subject: { type: 'string', short: 's' },
      area: { type: 'string', short: 'a' },
      disciplines: { type: 'string' },
      drawings: { type: 'string' },
      specs: { type: 'string' },
      'discovered-by': { type: 'string' },
    },
    allowPositionals: false,
    strict: false,
  });

  const type = values.type as string | undefined;
  const subject = values.subject as string | undefined;

  if (!type || !subject) {
    throw new UsageError(
      'Usage: wai issue add --type "Drawing Conflict" --subject "..." [--severity Critical]\n\n' +
      '  Types: Drawing Conflict, Spec Conflict, Missing Information, Risk Item, Coordination Issue\n' +
      '  Severity: Critical, Major, Minor, Informational',
    );
  }

  const nsId = await resolveIssueNamespace(client);
  const id = await nextIssueId(client, nsId);
  const today = new Date().toISOString().split('T')[0];

  const content = buildIssuePage({
    id,
    type,
    severity: values.severity as string,
    status: 'Open',
    areas: values.area as string | undefined,
    disciplines: values.disciplines as string | undefined,
    discovered: today,
    discovered_by: values['discovered-by'] as string | undefined,
    drawings: values.drawings as string | undefined,
    specs: values.specs as string | undefined,
    description: subject,
  });

  const title = `Issue:${id}`;
  await client.createPage(title, content, `Create issue ${id}: ${type}`);

  if (globals.json) {
    outputJson({ id, title, type, status: 'created' });
  } else {
    console.log(`Created ${title}`);
  }
}

async function issueResolve(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      resolution: { type: 'string', short: 'r' },
      'resolved-by': { type: 'string' },
    },
    allowPositionals: true,
    strict: false,
  });

  const id = positionals[0];
  if (!id) throw new UsageError('Usage: wai issue resolve <id> --resolution "..."');

  const resolution = values.resolution as string | undefined;
  if (!resolution) throw new UsageError('Required: --resolution');

  const title = id.startsWith('Issue:') ? id : `Issue:${id}`;
  const page = await client.readPage(title);
  const today = new Date().toISOString().split('T')[0];

  let content = page.content;

  // Update status in infobox
  content = content.replace(
    /\|\s*status\s*=\s*[^\n|]+/,
    '| status        = Resolved',
  );

  // Add resolved_by and resolution_date to infobox
  const resolvedBy = values['resolved-by'] as string | undefined;
  if (resolvedBy) {
    content = content.replace(
      /\}\}/,
      `| resolved_by   = ${resolvedBy}\n| resolution_date = ${today}\n}}`,
    );
  } else {
    content = content.replace(
      /\}\}/,
      `| resolution_date = ${today}\n}}`,
    );
  }

  // Update resolution section
  content = content.replace(
    /== Resolution ==\s*''Pending''/,
    `== Resolution ==\n${resolution}`,
  );

  // Update categories
  content = content.replace(/\[\[Category:Open\]\]/, '[[Category:Resolved]]');

  await client.writePage(title, content, `Resolve issue ${id}`);

  if (globals.json) {
    outputJson({ title, status: 'Resolved' });
  } else {
    console.log(`Resolved ${title}`);
  }
}
