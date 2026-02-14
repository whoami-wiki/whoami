#!/usr/bin/env node

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
import { importCommand } from './commands/import.js';
import { exportCommand } from './commands/export.js';
import { checkForUpdate, updateCommand } from './update.js';

const VERSION = '1.0.4';

const HELP = `wai — personal wiki CLI

Usage:
  wai <command> [flags]

Pages:
  read <title>                Read a wiki page
  write <title>               Write (overwrite) entire page
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

Tasks:
  task list [--status X]      List tasks (default: pending)
  task read <id>              Read a task
  task create -m "msg"        Create a new task
  task claim <id>             Claim a pending task
  task complete <id> [-m]     Complete an in-progress task
  task fail <id> [-m]         Fail an in-progress task
  task requeue <id>           Requeue a failed task

Discovery:
  link <title>                Show page links (in/out)
  category [name]             List categories or pages in one
  changes                     Recent changes
  source list                 List pages in the Source namespace
  place <query>               Look up a place (Google Places)

Archive:
  export <file>               Export to MediaWiki XML dump
  import <file>               Import from MediaWiki XML dump
  snapshot <dir>              Archive a directory

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
    case 'update':
      return updateCommand();
  }

  // Validate command before attempting auth
  const wikiCommands = new Set([
    'read', 'write', 'edit', 'create', 'search',
    'section', 'talk', 'upload', 'link', 'category', 'changes', 'export', 'import', 'source',
    'snapshot', 'task',
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
      case 'export':
        return exportCommand(commandArgs, globals, client);
      case 'import':
        return importCommand(commandArgs, globals, client);
      case 'snapshot':
        return snapshotCommand(commandArgs, globals, client);
      case 'task':
        return taskCommand(commandArgs, globals, client);
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
