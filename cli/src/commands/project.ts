import { parseArgs } from 'node:util';
import { type WikiClient } from '../wiki-client.js';
import { UsageError, WaiError } from '../errors.js';
import { type GlobalFlags, outputJson } from '../output.js';

// ── Dispatcher ─────────────────────────────────────────────────────────

export async function projectCommand(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const sub = args[0];
  const subArgs = args.slice(1);

  switch (sub) {
    case 'status':
      return projectStatus(subArgs, globals, client);
    case 'precedence':
      return projectPrecedence(subArgs, globals, client);
    default:
      throw new UsageError(
        'Usage: wai project <status|precedence>\n\n' +
        '  status       Project dashboard — areas, issues, documents\n' +
        '  precedence   Show document order of precedence',
      );
  }
}

// ── Subcommands ────────────────────────────────────────────────────────

async function projectStatus(
  _args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const namespaces = await client.getNamespaces();

  // Count pages in each namespace
  const counts: Record<string, number> = {};
  for (const ns of namespaces) {
    if (['Drawing', 'Spec', 'Construction', 'Issue', 'Task'].includes(ns.name)) {
      const pages = await client.listAllPages(ns.id);
      counts[ns.name] = pages.length;
    }
  }

  // Count main namespace pages
  const mainPages = await client.listAllPages(0);
  counts['Main'] = mainPages.length;

  // Count open issues by severity
  const issueCategories: Record<string, number> = {};
  for (const severity of ['Critical', 'Major', 'Minor', 'Informational']) {
    try {
      const pages = await client.listCategories(severity);
      const issues = pages.filter((t) => t.startsWith('Issue:'));
      if (issues.length > 0) {
        issueCategories[severity] = issues.length;
      }
    } catch {
      // Category may not exist
    }
  }

  // Count open vs closed construction docs
  let openDocs = 0;
  let closedDocs = 0;
  try {
    const open = await client.listCategories('Open');
    openDocs = open.filter((t) => t.startsWith('Construction:')).length;
  } catch { /* empty */ }
  try {
    const closed = await client.listCategories('Closed');
    closedDocs = closed.filter((t) => t.startsWith('Construction:')).length;
  } catch { /* empty */ }

  const status = {
    pages: counts,
    issues: issueCategories,
    construction: { open: openDocs, closed: closedDocs },
  };

  if (globals.json) {
    outputJson(status);
  } else {
    console.log('Project Status\n');

    console.log('Pages:');
    for (const [ns, count] of Object.entries(counts)) {
      console.log(`  ${ns.padEnd(15)} ${count}`);
    }

    console.log('\nOpen Issues:');
    if (Object.keys(issueCategories).length === 0) {
      console.log('  (none)');
    } else {
      for (const [severity, count] of Object.entries(issueCategories)) {
        console.log(`  ${severity.padEnd(15)} ${count}`);
      }
    }

    console.log('\nConstruction Documents:');
    console.log(`  Open:   ${openDocs}`);
    console.log(`  Closed: ${closedDocs}`);
  }
}

async function projectPrecedence(
  _args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  // Read the Project Standards page for precedence info
  let content: string;
  try {
    const page = await client.readPage('Project Standards');
    content = page.content;
  } catch {
    throw new WaiError(
      'No "Project Standards" page found. Create it from Division 01 specs first.',
      4,
    );
  }

  // Try to find the precedence section
  const sections = await client.listSections('Project Standards');
  const precedenceSection = sections.find((s) =>
    s.line.toLowerCase().includes('precedence') || s.line.toLowerCase().includes('priority'),
  );

  if (precedenceSection) {
    const sectionContent = await client.readSection(
      'Project Standards',
      parseInt(precedenceSection.index, 10),
    );
    if (globals.json) {
      outputJson({ title: 'Project Standards', section: precedenceSection.line, content: sectionContent.content });
    } else {
      console.log(`Document Precedence (from Project Standards)\n`);
      console.log(sectionContent.content);
    }
  } else {
    if (globals.json) {
      outputJson({ title: 'Project Standards', content });
    } else {
      console.log('No precedence section found in Project Standards.');
      console.log('The full Project Standards page content is available via: wai read "Project Standards"');
    }
  }
}
