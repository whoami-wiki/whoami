#!/usr/bin/env node

import { ApiClient } from './api-client.js';
import { getServer, setServer } from './config.js';
import { toSlug } from './slug.js';
import { readFromFile, readFromStdin } from './body-input.js';
import { runRead } from './commands/read.js';
import { runWrite } from './commands/write.js';
import { runCreate } from './commands/create.js';
import { runEdit } from './commands/edit.js';
import { runDelete } from './commands/delete.js';
import { runSyncGedcom } from './commands/sync-gedcom.js';
import { runRebuildSearch } from './commands/rebuild-search.js';
import { runRecite } from './commands/recite.js';
import { runSearch } from './commands/search.js';
import { runHealthz } from './commands/healthz.js';
import { ApiError } from './api-client.js';

const VERSION = '2.0.0-pre.0';

const HELP = `wai — whoami.wiki cli (markdown migration)

Usage:
  wai <command> [args]

Pages:
  read <slug>                 Read a page (body to stdout; --json for full)
  write <slug> [--file F]     Write (overwrite) a page
                                body from --file F, --stdin, or positional arg
                                requires --summary
  create <slug> [--file F]    Create a new page (refuses if exists)
  edit <slug>                 Edit a page in $EDITOR
  delete <slug> --yes         Soft-delete a page (moves to _archived)
  search <query> [--limit N]  Search pages, body, aliases, categories,
                                and GEDCOM-derived fields

GEDCOM:
  sync-gedcom --ged-file F    Sync GEDCOM .ged → derived/ + commit
              --notes "..."
  recite                      Report stale snapshot pointers
  recite --apply              Advance pointers in pages

Search:
  rebuild-search              Rebuild the search index from disk
                                (use after editing pages outside the API)
  rebuild-search --check      Exit non-zero if the index is stale (no rebuild)

Server:
  healthz                     Ping the API
  config server <url>         Set server URL in ~/.whoami/config.json

Common flags:
  --json                      JSON output (where applicable)
  --summary <text>            Edit summary (required for write/create/edit)

Server URL: ${getServer()}  (override: WHOAMI_SERVER, ~/.whoami/config.json)

Removed in this migration (track future plans for replacements):
  upload, link, changes, category, source, task, place,
  snapshot, export, import, talk, section, auth
`;

interface Args {
  cmd: string | undefined;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let cmd: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        // --flag=value
        flags[a.slice(2, eq)] = a.slice(eq + 1);
        continue;
      }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (cmd === undefined) {
      cmd = a;
    } else {
      positional.push(a);
    }
  }
  return { cmd, positional, flags };
}

async function resolveBody(args: Args): Promise<string> {
  if (typeof args.flags.file === 'string') return readFromFile(args.flags.file);
  if (args.flags.stdin) return await readFromStdin();
  if (args.positional[1] !== undefined) return args.positional[1];
  // No body source given. If stdin is a TTY, the user probably forgot;
  // erroring is friendlier than hanging on a blank prompt forever.
  if (process.stdin.isTTY) {
    throw new Error('no body provided — pass --file F, --stdin, or pipe content via stdin');
  }
  return await readFromStdin();
}

const REMOVED = new Set([
  'upload', 'link', 'changes', 'category', 'source', 'task',
  'place', 'snapshot', 'export', 'import', 'talk', 'section', 'auth',
]);

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.version || args.cmd === 'version' || args.cmd === '--version') {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (!args.cmd || args.cmd === 'help' || args.flags.help) {
    process.stdout.write(HELP);
    return 0;
  }

  if (REMOVED.has(args.cmd)) {
    process.stderr.write(`wai: '${args.cmd}' is not yet supported in the markdown migration.\n`);
    return 2;
  }

  const client = new ApiClient(getServer());
  const write = (s: string) => process.stdout.write(s);

  try {
    switch (args.cmd) {
      case 'read': {
        const slug = toSlug(args.positional[0] ?? '');
        await runRead({ slug, json: !!args.flags.json, client, write });
        break;
      }
      case 'write': {
        const slug = toSlug(args.positional[0] ?? '');
        const body = await resolveBody(args);
        const summary = String(args.flags.summary ?? '');
        await runWrite({ slug, body, summary, client, write });
        break;
      }
      case 'create': {
        const slug = toSlug(args.positional[0] ?? '');
        const body = await resolveBody(args);
        const summary = String(args.flags.summary ?? '');
        await runCreate({ slug, body, summary, client, write });
        break;
      }
      case 'edit': {
        const slug = toSlug(args.positional[0] ?? '');
        const summary = String(args.flags.summary ?? '');
        await runEdit({ slug, summary, client, write });
        break;
      }
      case 'delete': {
        const slug = toSlug(args.positional[0] ?? '');
        await runDelete({ slug, yes: !!args.flags.yes, client, write });
        break;
      }
      case 'sync-gedcom': {
        const gedFile = String(args.flags['ged-file'] ?? '');
        const notes = String(args.flags.notes ?? '');
        await runSyncGedcom({ gedFile, notes, client, write });
        break;
      }
      case 'recite': {
        await runRecite({ apply: !!args.flags.apply, client, write });
        break;
      }
      case 'search': {
        const query = args.positional[0] ?? '';
        const limit = parseInt(String(args.flags.limit ?? '25'), 10) || 25;
        await runSearch({ query, limit, json: !!args.flags.json, client, write });
        break;
      }
      case 'rebuild-search': {
        await runRebuildSearch({
          check: !!args.flags.check,
          client,
          write,
        });
        break;
      }
      case 'healthz': {
        await runHealthz({ client, write });
        break;
      }
      case 'config': {
        if (args.positional[0] === 'server' && args.positional[1]) {
          setServer(args.positional[1]);
          write(`saved server=${args.positional[1]}\n`);
        } else {
          write(`server=${getServer()}\n`);
        }
        break;
      }
      default: {
        process.stderr.write(`wai: unknown command '${args.cmd}'. Run 'wai help' for usage.\n`);
        return 2;
      }
    }
    return 0;
  } catch (err) {
    if (err instanceof ApiError) {
      process.stderr.write(`wai: ${err.message}\n`);
      return 1;
    }
    process.stderr.write(`wai: ${(err as Error).message}\n`);
    return 1;
  }
}

main().then(code => process.exit(code));
