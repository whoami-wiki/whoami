import { parseArgs } from 'node:util';
import { type WikiClient } from '../wiki-client.js';
import { UsageError } from '../errors.js';
import { type GlobalFlags, outputJson } from '../output.js';

export async function purgeCommand(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      'force-link-update': { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (positionals.length === 0) {
    throw new UsageError(
      'Usage: wai purge <title> [title2 ...] [--force-link-update]',
    );
  }

  const results = await client.purgePages(positionals, {
    forceLinkUpdate: values['force-link-update'] as boolean,
  });

  if (globals.json) {
    outputJson(results);
    return;
  }

  if (globals.quiet) return;

  for (const r of results) {
    if (r.missing) {
      console.log(`missing: ${r.title}`);
    } else if (r.purged) {
      console.log(`purged: ${r.title}`);
    } else {
      console.log(`unchanged: ${r.title}`);
    }
  }
}
