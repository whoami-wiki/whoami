import { parseArgs } from 'node:util';
import { type WikiClient } from '../wiki-client.js';
import { UsageError } from '../errors.js';
import { resolveContent } from '../content.js';
import { type GlobalFlags, outputJson, outputResult } from '../output.js';

export async function createCommand(
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
  if (!title) throw new UsageError('Usage: wai create <title> [-c content | -f file | stdin] [-m summary]');

  const content = await resolveContent({
    content: values.content as string | undefined,
    file: values.file as string | undefined,
  });

  const result = await client.createPage(title, content, values.summary as string | undefined);

  if (globals.json) {
    outputJson(result);
  } else {
    outputResult('Created', result.title, {
      rev: String(result.newRevid),
      summary: values.summary as string | undefined,
    });
  }
}
