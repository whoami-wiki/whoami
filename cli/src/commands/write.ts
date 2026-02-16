import { parseArgs } from 'node:util';
import { type WikiClient } from '../wiki-client.js';
import { UsageError, WaiError } from '../errors.js';
import { resolveContent } from '../content.js';
import { type GlobalFlags, outputJson, outputResult } from '../output.js';

export async function writeCommand(
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
  if (!title) throw new UsageError('Usage: wai write <title> [-c content | -f file | -] [-m summary]');

  // Support positional file arg: wai write "Title" file.txt
  // Also support "-" as explicit stdin marker: wai write "Title" -
  const fileArg = positionals[1];
  const file = (values.file as string | undefined) ??
    (fileArg && fileArg !== '-' ? fileArg : undefined);

  const content = await resolveContent({
    content: values.content as string | undefined,
    file,
  });

  if (!content.trim()) {
    throw new WaiError('Refusing to write empty content. Use -c, -f, or pipe non-empty content to stdin.', 1);
  }

  const result = await client.writePage(title, content, values.summary as string | undefined);

  if (result.noChange) {
    if (globals.json) {
      outputJson(result);
    } else {
      console.error(`No changes to "${result.title}" (rev ${result.oldRevid})`);
    }
    process.exitCode = 1;
    return;
  }

  if (globals.json) {
    outputJson(result);
  } else {
    outputResult('Wrote', result.title, {
      rev: `${result.oldRevid} → ${result.newRevid}`,
      summary: values.summary as string | undefined,
    });
  }
}
