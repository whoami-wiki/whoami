import { parseArgs } from 'node:util';
import { type WikiClient } from '../wiki-client.js';
import { UsageError } from '../errors.js';
import { resolveContent } from '../content.js';
import { type GlobalFlags, outputJson, outputPage } from '../output.js';

export async function talkCommand(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const sub = args[0];
  const subArgs = args.slice(1);

  switch (sub) {
    case 'read':
      return talkRead(subArgs, globals, client);
    case 'create':
      return talkCreate(subArgs, globals, client);
    default:
      throw new UsageError('Usage: wai talk <read|create> <page>');
  }
}

async function talkRead(args: string[], globals: GlobalFlags, client: WikiClient): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      thread: { type: 'string' },
      raw: { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  const page = positionals[0];
  if (!page) throw new UsageError('Usage: wai talk read <page> [--thread <name>]');

  const result = await client.readTalkPage(page, values.thread as string | undefined);

  if (globals.json) {
    outputJson({
      title: result.title,
      revid: result.revid,
      content: result.content,
    });
  } else {
    outputPage(result, {
      raw: values.raw as boolean,
      quiet: globals.quiet,
    });
  }
}

async function talkCreate(args: string[], globals: GlobalFlags, client: WikiClient): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      subject: { type: 'string', short: 's' },
      content: { type: 'string', short: 'c' },
      file: { type: 'string', short: 'f' },
      summary: { type: 'string', short: 'm' },
    },
    allowPositionals: true,
    strict: false,
  });

  const page = positionals[0];
  const subject = values.subject as string | undefined;
  if (!page || !subject) {
    throw new UsageError('Usage: wai talk create <page> -s <subject> [-c content | -f file | stdin] [-m summary]');
  }

  const content = await resolveContent({
    content: values.content as string | undefined,
    file: values.file as string | undefined,
  });

  await client.createTalkThread(page, subject, content, values.summary as string | undefined);

  if (globals.json) {
    outputJson({ page, subject, status: 'created' });
  } else {
    console.log(`Created thread "${subject}" on Talk:${page}`);
  }
}
