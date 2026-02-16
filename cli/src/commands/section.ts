import { parseArgs } from 'node:util';
import { type WikiClient } from '../wiki-client.js';
import { UsageError } from '../errors.js';
import { resolveContent } from '../content.js';
import { type GlobalFlags, outputJson, outputPage, outputResult, outputTable } from '../output.js';

export async function sectionCommand(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const sub = args[0];
  const subArgs = args.slice(1);

  switch (sub) {
    case 'list':
      return sectionList(subArgs, globals, client);
    case 'read':
      return sectionRead(subArgs, globals, client);
    case 'update':
      return sectionUpdate(subArgs, globals, client);
    default:
      throw new UsageError('Usage: wai section <list|read|update> <title> [section]');
  }
}

async function sectionList(args: string[], globals: GlobalFlags, client: WikiClient): Promise<void> {
  const title = args[0];
  if (!title) throw new UsageError('Usage: wai section list <title>');

  const sections = await client.listSections(title);

  if (globals.json) {
    outputJson(sections);
  } else {
    if (sections.length === 0) {
      console.log(`No sections in "${title}"`);
      return;
    }
    outputTable(
      ['#', 'Level', 'Section'],
      sections.map((s) => [s.index, s.level, '  '.repeat(parseInt(s.level) - 2) + s.line]),
    );
  }
}

async function sectionRead(args: string[], globals: GlobalFlags, client: WikiClient): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      offset: { type: 'string' },
      limit: { type: 'string', short: 'n' },
      raw: { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  const title = positionals[0];
  const section = positionals[1];
  if (!title || section === undefined) {
    throw new UsageError('Usage: wai section read <title> <section>');
  }

  const page = await client.readSection(title, section);
  const offset = values.offset ? parseInt(values.offset as string, 10) : undefined;
  const limit = values.limit ? parseInt(values.limit as string, 10) : undefined;

  if (globals.json) {
    outputJson({
      title: page.title,
      revid: page.revid,
      section,
      content: page.content,
    });
  } else {
    outputPage(page, {
      raw: values.raw as boolean,
      quiet: globals.quiet,
      offset,
      limit,
    });
  }
}

async function sectionUpdate(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      content: { type: 'string', short: 'c' },
      file: { type: 'string', short: 'f' },
      summary: { type: 'string', short: 'm' },
    },
    allowPositionals: true,
    strict: false,
  });

  const title = positionals[0];
  const section = positionals[1];
  if (!title || section === undefined) {
    throw new UsageError('Usage: wai section update <title> <section> [-c content | -f file | stdin] [-m summary]');
  }

  const content = await resolveContent({
    content: values.content as string | undefined,
    file: values.file as string | undefined,
  });

  const result = await client.updateSection(title, section, content, values.summary as string | undefined);

  if (globals.json) {
    outputJson(result);
  } else {
    outputResult('Updated section', `${result.title} §${section}`, {
      rev: `${result.oldRevid} → ${result.newRevid}`,
      summary: values.summary as string | undefined,
    });
  }
}
