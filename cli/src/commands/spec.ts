import { parseArgs } from 'node:util';
import { type WikiClient } from '../wiki-client.js';
import { UsageError, WaiError } from '../errors.js';
import { type GlobalFlags, outputJson, outputTable, outputPage } from '../output.js';

// ── Dispatcher ─────────────────────────────────────────────────────────

export async function specCommand(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const sub = args[0];
  const subArgs = args.slice(1);

  switch (sub) {
    case 'list':
      return specList(subArgs, globals, client);
    case 'read':
      return specRead(subArgs, globals, client);
    case 'paragraph':
      return specParagraph(subArgs, globals, client);
    default:
      throw new UsageError(
        'Usage: wai spec <list|read|paragraph>\n\n' +
        '  list [--division N]               List spec pages\n' +
        '  read <section>                     Read a spec page\n' +
        '  paragraph <section> <para>         Read a specific paragraph',
      );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

async function resolveSpecNamespace(client: WikiClient): Promise<number> {
  const namespaces = await client.getNamespaces();
  const ns = namespaces.find((n) => n.name === 'Spec');
  if (!ns) {
    throw new WaiError('No "Spec" namespace found. Add NS_SPEC to LocalSettings.php.', 1);
  }
  return ns.id;
}

// ── Subcommands ────────────────────────────────────────────────────────

async function specList(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      division: { type: 'string', short: 'd' },
    },
    allowPositionals: false,
    strict: false,
  });

  const division = values.division as string | undefined;

  let titles: string[];

  if (division) {
    const category = `Division ${division.padStart(2, '0')}`;
    titles = await client.listCategories(category);
    titles = titles.filter((t) => t.startsWith('Spec:'));
  } else {
    const nsId = await resolveSpecNamespace(client);
    titles = await client.listAllPages(nsId);
  }

  if (globals.json) {
    outputJson(titles.map((t) => ({ title: t })));
  } else {
    if (titles.length === 0) {
      console.log('No spec sections found.');
      return;
    }
    outputTable(
      ['Spec Section'],
      titles.map((t) => [t]),
    );
  }
}

async function specRead(
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

  const section = positionals.join(' ');
  if (!section) throw new UsageError('Usage: wai spec read <section>');

  const title = section.startsWith('Spec:') ? section : `Spec:${section}`;
  const page = await client.readPage(title);

  if (globals.json) {
    outputJson({ title: page.title, revid: page.revid, content: page.content });
  } else {
    outputPage(page);
  }
}

async function specParagraph(
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

  if (positionals.length < 2) {
    throw new UsageError('Usage: wai spec paragraph <section> <paragraph>\n\n  Example: wai spec paragraph "03 30 00" 2.1.A');
  }

  const section = positionals[0];
  const paragraph = positionals[1];
  const title = section.startsWith('Spec:') ? section : `Spec:${section}`;

  // Read the full page and find the section matching the paragraph number
  const page = await client.readPage(title);
  const sections = await client.listSections(title);

  // Find the section whose heading matches the paragraph number
  const match = sections.find((s) => s.line.startsWith(paragraph));

  if (match) {
    const sectionContent = await client.readSection(title, parseInt(match.index, 10));
    if (globals.json) {
      outputJson({ title: page.title, paragraph, content: sectionContent.content });
    } else {
      console.log(`${title} §${paragraph}\n`);
      console.log(sectionContent.content);
    }
  } else {
    // Fallback: search page content for the paragraph reference
    const lines = page.content.split('\n');
    const paraLines: string[] = [];
    let found = false;
    for (const line of lines) {
      if (line.includes(paragraph)) {
        found = true;
      }
      if (found) {
        if (paraLines.length > 0 && /^={2,}/.test(line)) break;
        paraLines.push(line);
      }
    }

    if (paraLines.length > 0) {
      const content = paraLines.join('\n');
      if (globals.json) {
        outputJson({ title: page.title, paragraph, content });
      } else {
        console.log(`${title} §${paragraph}\n`);
        console.log(content);
      }
    } else {
      console.error(`Paragraph ${paragraph} not found in ${title}`);
      process.exitCode = 4;
    }
  }
}
