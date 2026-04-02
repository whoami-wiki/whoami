#!/usr/bin/env node

// Suppress DEP0169 url.parse() deprecation emitted by proxy-from-env (axios dependency).
// proxy-from-env v2 fixes this, but axios still pins ^1.1.0.
const _emit = process.emit;
// @ts-expect-error — narrowing the overloaded signature is not worth the noise
process.emit = function (event: string, ...args: unknown[]) {
  if (event === 'warning' && (args[0] as any)?.code === 'DEP0169') return false;
  return _emit.apply(process, [event, ...args] as unknown as Parameters<typeof _emit>);
};

import { resolveCredentials } from './auth.js';
import { WikiClient } from './wiki-client.js';
import { WaiError, UsageError, AuthError } from './errors.js';
import { type GlobalFlags } from './output.js';

// Commands
import { authCommand } from './commands/auth.js';
import { readCommand } from './commands/read.js';
import { writeCommand } from './commands/write.js';
import { editCommand } from './commands/edit.js';
import { createCommand } from './commands/create.js';
import { searchCommand } from './commands/search.js';
import { sectionCommand } from './commands/section.js';
import { talkCommand } from './commands/talk.js';
import { uploadCommand } from './commands/upload.js';
import { linkCommand } from './commands/link.js';
import { categoryCommand } from './commands/category.js';
import { changesCommand } from './commands/changes.js';
import { sourceCommand } from './commands/source.js';
import { taskCommand } from './commands/task.js';
import { placeCommand } from './commands/place.js';
import { snapshotCommand } from './commands/snapshot.js';
import { exportCommand } from './commands/export.js';
import { importCommand } from './commands/import.js';
import { checkForUpdate, updateCommand } from './update.js';
import { drawingCommand } from './commands/drawing.js';
import { specCommand } from './commands/spec.js';
import { constructionCommand } from './commands/construction.js';
import { issueCommand } from './commands/issue.js';
import { verifyCommand } from './commands/verify.js';
import { projectCommand } from './commands/project.js';
import { ingestCommand } from './commands/ingest.js';

const VERSION = '1.2.1';

const HELP = `wai — construction project wiki CLI

Usage:
  wai <command> [flags]

Pages:
  read <title>                Read a wiki page
  write <title> [file]         Write (overwrite) entire page
  edit <title>                Edit a page (find and replace)
  create <title>              Create a new page
  search <query>              Full-text search
  upload <file>               Upload a file

Sections:
  section list <title>        List sections of a page
  section read <title> <n>    Read a specific section
  section update <title> <n>  Update a specific section

Talk Pages:
  talk read <page>            Read talk page
  talk create <page>          Create a new talk thread

Drawings:
  drawing list [--discipline X] [--area N]   List drawing pages
  drawing read <number>                      Read a drawing analysis
  drawing xref <number>                      Cross-references for a drawing

Specifications:
  spec list [--division N]                   List spec pages
  spec read <section>                        Read a spec page
  spec paragraph <section> <para>            Read a specific paragraph

Construction Documents:
  construction list [--type X] [--status X]  List RFIs, submittals, etc.
  construction read <number>                 Read a document
  construction add <type> --number N -s "…"  Create a new document
  construction update <number> --status X    Update document status

Issues:
  issue list [--status X] [--severity X]     List project issues
  issue read <id>                            Read an issue
  issue add --type X --subject "…"           Create a new issue
  issue resolve <id> --resolution "…"        Resolve an issue

Tasks:
  task list [--status X]      List tasks (default: pending)
  task read <id>              Read a task
  task create -m "msg"        Create a new task
  task claim <id>             Claim a pending task
  task complete <id> [-m]     Complete an in-progress task
  task fail <id> [-m]         Fail an in-progress task
  task requeue <id>           Requeue a failed task

Document Ingestion:
  ingest volume <path> [--type X] [--name N] Split and catalog a volume
  ingest status [name]                       Show ingestion progress
  ingest analyze <name> [--area N]           Create analysis tasks

Verification:
  verify <title>              Check verification status of a page
  verify --all [--stale N]    List all pages needing verification

Project:
  project status              Project dashboard
  project precedence          Show document order of precedence

Discovery:
  link <title>                Show page links (in/out)
  category [name]             List categories or pages in one
  changes                     Recent changes
  place <query>               Look up a place (Google Places)

Data:
  source list                 List pages in the Source namespace
  snapshot <dir>              Snapshot a directory into the vault

Backup:
  export <dir>                Export full wiki backup
  import <file>               Import from a backup

Auth:
  auth login                  Store wiki credentials
  auth logout                 Remove stored credentials
  auth status                 Show connection status
  update                      Update to latest version

Flags:
  -j, --json       Output as JSON
  -q, --quiet      Suppress non-essential output
  -h, --help       Show help
  -V, --version    Show version
`;

// ── Main ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const allArgs = process.argv.slice(2);

  // Handle --version / --help early
  if (allArgs.includes('--version') || allArgs.includes('-V')) {
    console.log(VERSION);
    return;
  }
  if (allArgs.length === 0 || allArgs.includes('--help') || allArgs.includes('-h')) {
    process.stdout.write(HELP);
    return;
  }

  // Extract global flags
  const globals: GlobalFlags = { json: false, quiet: false };
  const args: string[] = [];
  for (const arg of allArgs) {
    if (arg === '-j' || arg === '--json') globals.json = true;
    else if (arg === '-q' || arg === '--quiet') globals.quiet = true;
    else args.push(arg);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  // Start background update check (fire-and-forget)
  const updateNotice = checkForUpdate(VERSION);

  // Commands that don't need wiki auth
  switch (command) {
    case 'auth':
      return run(authCommand(commandArgs, globals), updateNotice);
    case 'place':
      return run(placeCommand(commandArgs, globals), updateNotice);
    case 'export':
      return run(exportCommand(commandArgs, globals), updateNotice);
    case 'import':
      return run(importCommand(commandArgs, globals), updateNotice);
    case 'update':
      return updateCommand();
  }

  // Validate command before attempting auth
  const wikiCommands = new Set([
    'read', 'write', 'edit', 'create', 'search',
    'section', 'talk', 'upload', 'link', 'category', 'changes', 'source',
    'snapshot', 'task',
    'drawing', 'spec', 'construction', 'issue', 'verify', 'project', 'ingest',
  ]);

  if (!wikiCommands.has(command)) {
    console.error(`Unknown command: ${command}`);
    console.error('Run `wai --help` for usage.');
    process.exitCode = 2;
    return;
  }

  // Wiki commands need credentials and a logged-in client
  const creds = resolveCredentials();
  const client = new WikiClient(creds.server);
  await client.login(creds.username, creds.password);

  const cmdPromise = ((): Promise<void> => {
    switch (command) {
      case 'read':
        return readCommand(commandArgs, globals, client);
      case 'write':
        return writeCommand(commandArgs, globals, client);
      case 'edit':
        return editCommand(commandArgs, globals, client);
      case 'create':
        return createCommand(commandArgs, globals, client);
      case 'search':
        return searchCommand(commandArgs, globals, client);
      case 'section':
        return sectionCommand(commandArgs, globals, client);
      case 'talk':
        return talkCommand(commandArgs, globals, client);
      case 'upload':
        return uploadCommand(commandArgs, globals, client);
      case 'link':
        return linkCommand(commandArgs, globals, client);
      case 'category':
        return categoryCommand(commandArgs, globals, client);
      case 'changes':
        return changesCommand(commandArgs, globals, client);
      case 'source':
        return sourceCommand(commandArgs, globals, client);
      case 'snapshot':
        return snapshotCommand(commandArgs, globals, client);
      case 'task':
        return taskCommand(commandArgs, globals, client);
      case 'drawing':
        return drawingCommand(commandArgs, globals, client);
      case 'spec':
        return specCommand(commandArgs, globals, client);
      case 'construction':
        return constructionCommand(commandArgs, globals, client);
      case 'issue':
        return issueCommand(commandArgs, globals, client);
      case 'verify':
        return verifyCommand(commandArgs, globals, client);
      case 'project':
        return projectCommand(commandArgs, globals, client);
      case 'ingest':
        return ingestCommand(commandArgs, globals, client);
      default:
        return Promise.resolve();
    }
  })();

  return run(cmdPromise, updateNotice);
}

/** Run a command, then print update notice to stderr if available. */
async function run(cmd: Promise<void>, updateNotice: Promise<string | null>): Promise<void> {
  await cmd;
  const notice = await updateNotice;
  if (notice) console.error(notice);
}

main().catch((err: unknown) => {
  if (err instanceof WaiError) {
    if (!((err instanceof UsageError) || (err instanceof AuthError))) {
      console.error(`Error: ${err.message}`);
    } else {
      console.error(err.message);
    }
    process.exitCode = err.exitCode;
  } else if (err instanceof Error) {
    // Axios errors
    const axiosErr = err as any;
    if (axiosErr.response?.data?.error) {
      console.error(`API error: ${axiosErr.response.data.error.info}`);
      process.exitCode = 1;
    } else if (axiosErr.code === 'ECONNREFUSED') {
      console.error(`Cannot connect to wiki server. Is it running?`);
      process.exitCode = 3;
    } else {
      console.error(`Error: ${err.message}`);
      process.exitCode = 1;
    }
  } else {
    console.error('Unexpected error');
    process.exitCode = 1;
  }
});
