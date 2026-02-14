import { UsageError } from '../errors.js';
import { type GlobalFlags, outputJson, outputTable } from '../output.js';
import type { WikiClient } from '../wiki-client.js';

export async function sourceCommand(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const sub = args[0];
  if (sub !== 'list') {
    throw new UsageError('Usage: wai source list');
  }

  const namespaces = await client.getNamespaces();
  const sourceNs = namespaces.find((n) => n.name === 'Source');
  if (!sourceNs) {
    console.log('No "Source" namespace found on this wiki.');
    return;
  }

  const titles = await client.listAllPages(sourceNs.id);

  if (globals.json) {
    outputJson(titles);
  } else {
    if (titles.length === 0) {
      console.log('No source pages found.');
      return;
    }
    outputTable(['Source'], titles.map((t) => [t]));
  }
}
