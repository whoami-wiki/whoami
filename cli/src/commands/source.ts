import { loadConfig } from '../auth.js';
import { UsageError } from '../errors.js';
import { type GlobalFlags, outputJson, outputTable } from '../output.js';

export async function sourceCommand(args: string[], globals: GlobalFlags): Promise<void> {
  const sub = args[0];
  if (sub !== 'list') {
    throw new UsageError('Usage: wai source list');
  }

  const config = loadConfig();
  const sources = config.sources ?? [];

  if (globals.json) {
    outputJson(sources);
  } else {
    if (sources.length === 0) {
      console.log('No sources configured. Edit ~/.whoami/config.json to add sources.');
      return;
    }
    outputTable(
      ['Path', 'Description'],
      sources.map((s) => [s.path, s.description]),
    );
  }
}
