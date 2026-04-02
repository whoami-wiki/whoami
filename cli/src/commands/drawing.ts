import { parseArgs } from 'node:util';
import { type WikiClient } from '../wiki-client.js';
import { UsageError, WaiError } from '../errors.js';
import { type GlobalFlags, outputJson, outputTable, outputPage } from '../output.js';

// ── Dispatcher ─────────────────────────────────────────────────────────

export async function drawingCommand(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const sub = args[0];
  const subArgs = args.slice(1);

  switch (sub) {
    case 'list':
      return drawingList(subArgs, globals, client);
    case 'read':
      return drawingRead(subArgs, globals, client);
    case 'xref':
      return drawingXref(subArgs, globals, client);
    default:
      throw new UsageError(
        'Usage: wai drawing <list|read|xref>\n\n' +
        '  list [--discipline X] [--area N]   List drawing pages\n' +
        '  read <number>                      Read a drawing analysis\n' +
        '  xref <number>                      Show cross-references to/from a drawing',
      );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

async function resolveDrawingNamespace(client: WikiClient): Promise<number> {
  const namespaces = await client.getNamespaces();
  const ns = namespaces.find((n) => n.name === 'Drawing');
  if (!ns) {
    throw new WaiError('No "Drawing" namespace found. Add NS_DRAWING to LocalSettings.php.', 1);
  }
  return ns.id;
}

// ── Subcommands ────────────────────────────────────────────────────────

async function drawingList(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      discipline: { type: 'string', short: 'd' },
      area: { type: 'string', short: 'a' },
    },
    allowPositionals: false,
    strict: false,
  });

  const discipline = values.discipline as string | undefined;
  const area = values.area as string | undefined;

  let titles: string[];

  if (discipline) {
    // Filter by discipline category (e.g., "Civil", "Structural")
    titles = await client.listCategories(discipline);
    // Only keep Drawing namespace pages
    titles = titles.filter((t) => t.startsWith('Drawing:'));
  } else if (area) {
    // Filter by area category (e.g., "Area 03")
    const category = area.match(/^\d+$/) ? `Area ${area.padStart(2, '0')}` : area;
    titles = await client.listCategories(category);
    titles = titles.filter((t) => t.startsWith('Drawing:'));
  } else {
    // List all drawings
    const nsId = await resolveDrawingNamespace(client);
    titles = await client.listAllPages(nsId);
  }

  if (globals.json) {
    outputJson(titles.map((t) => ({ title: t })));
  } else {
    if (titles.length === 0) {
      console.log('No drawings found.');
      return;
    }
    outputTable(
      ['Drawing'],
      titles.map((t) => [t]),
    );
  }
}

async function drawingRead(
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

  const number = positionals[0];
  if (!number) throw new UsageError('Usage: wai drawing read <number>');

  const title = number.startsWith('Drawing:') ? number : `Drawing:${number}`;
  const page = await client.readPage(title);

  if (globals.json) {
    outputJson({ title: page.title, revid: page.revid, content: page.content });
  } else {
    outputPage(page);
  }
}

async function drawingXref(
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

  const number = positionals[0];
  if (!number) throw new UsageError('Usage: wai drawing xref <number>');

  const title = number.startsWith('Drawing:') ? number : `Drawing:${number}`;
  const links = await client.getLinks(title, 'both');

  if (globals.json) {
    outputJson(links);
  } else {
    console.log(`Cross-references for ${title}\n`);
    if (links.incoming.length > 0) {
      console.log('Referenced by:');
      for (const l of links.incoming) console.log(`  ← ${l}`);
    } else {
      console.log('Referenced by: (none)');
    }
    console.log();
    if (links.outgoing.length > 0) {
      console.log('References:');
      for (const l of links.outgoing) console.log(`  → ${l}`);
    } else {
      console.log('References: (none)');
    }
  }
}
