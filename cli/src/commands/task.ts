import { parseArgs } from 'node:util';
import { type WikiClient } from '../wiki-client.js';
import { UsageError, NotFoundError, WaiError } from '../errors.js';
import { type GlobalFlags, outputJson, outputTable } from '../output.js';

// ── Types ──────────────────────────────────────────────────────────────

interface TaskInfo {
  id: string;
  status: string;
  source?: string;
  created: string;
  claimed_by?: string;
  claimed_at?: string;
  completed_at?: string;
  description: string;
  output: string;
}

type TaskStatus = 'pending' | 'in-progress' | 'done' | 'failed';

// ── Dispatcher ─────────────────────────────────────────────────────────

export async function taskCommand(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const sub = args[0];
  const subArgs = args.slice(1);

  switch (sub) {
    case 'list':
      return taskList(subArgs, globals, client);
    case 'read':
      return taskRead(subArgs, globals, client);
    case 'create':
      return taskCreate(subArgs, globals, client);
    case 'claim':
      return taskClaim(subArgs, globals, client);
    case 'complete':
      return taskComplete(subArgs, globals, client);
    case 'fail':
      return taskFail(subArgs, globals, client);
    case 'requeue':
      return taskRequeue(subArgs, globals, client);
    default:
      throw new UsageError(
        'Usage: wai task <list|read|create|claim|complete|fail|requeue>',
      );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

const STATUS_CATEGORIES: Record<TaskStatus, string> = {
  'pending': 'Pending tasks',
  'in-progress': 'In-progress tasks',
  'done': 'Done tasks',
  'failed': 'Failed tasks',
};

function statusCategory(status: TaskStatus): string {
  return STATUS_CATEGORIES[status];
}

function parseTaskPage(title: string, content: string): TaskInfo {
  // Extract infobox params
  const infoboxMatch = content.match(
    /\{\{Infobox Task\s*((?:\|[^}]*?)*)?\}\}/s,
  );
  const params: Record<string, string> = {};
  if (infoboxMatch) {
    const paramBlock = infoboxMatch[1] || '';
    for (const m of paramBlock.matchAll(
      /\|\s*(\w+)\s*=\s*(.*?)(?=\n\s*\||$)/gs,
    )) {
      params[m[1].trim()] = m[2].trim();
    }
  }

  // Extract description (between infobox closing and == Output == or category)
  const afterInfobox = content.replace(/\{\{Infobox Task[^}]*\}\}\s*/s, '');
  const outputMatch = afterInfobox.match(/== Output ==\s*([\s\S]*?)(?=\n\[\[Category:|$)/);
  const descMatch = afterInfobox.match(/^([\s\S]*?)(?=\n== Output ==|\n\[\[Category:|$)/);

  const description = descMatch ? descMatch[1].trim() : '';
  const output = outputMatch ? outputMatch[1].trim() : '';

  // Extract ID from title (Task:0001 → 0001)
  const id = params.id || title.replace(/^Task:/, '');

  return {
    id,
    status: params.status || 'pending',
    source: params.source || undefined,
    created: params.created || '',
    claimed_by: params.claimed_by || undefined,
    claimed_at: params.claimed_at || undefined,
    completed_at: params.completed_at || undefined,
    description,
    output,
  };
}

function buildTaskPage(task: TaskInfo): string {
  const lines: string[] = ['{{Infobox Task'];
  lines.push(`| id          = ${task.id}`);
  lines.push(`| status      = ${task.status}`);
  if (task.source) lines.push(`| source      = ${task.source}`);
  lines.push(`| created     = ${task.created}`);
  if (task.claimed_by) lines.push(`| claimed_by  = ${task.claimed_by}`);
  if (task.claimed_at) lines.push(`| claimed_at  = ${task.claimed_at}`);
  if (task.completed_at) lines.push(`| completed_at = ${task.completed_at}`);
  lines.push('}}');
  lines.push(task.description);
  lines.push('');
  lines.push('== Output ==');
  if (task.output) {
    lines.push(task.output);
  }
  lines.push('');
  lines.push(`[[Category:${statusCategory(task.status as TaskStatus)}]]`);

  return lines.join('\n');
}

async function resolveTaskNamespace(
  client: WikiClient,
): Promise<number> {
  const namespaces = await client.getNamespaces();
  const taskNs = namespaces.find((n) => n.name === 'Task');
  if (!taskNs) {
    throw new WaiError(
      'No "Task" namespace found. Add NS_TASK to LocalSettings.php.',
      1,
    );
  }
  return taskNs.id;
}

async function nextTaskId(client: WikiClient, nsId: number): Promise<string> {
  const titles = await client.listAllPages(nsId);
  let maxId = 0;
  for (const t of titles) {
    const num = parseInt(t.replace(/^Task:/, ''), 10);
    if (!isNaN(num) && num > maxId) maxId = num;
  }
  return String(maxId + 1).padStart(4, '0');
}

// ── Subcommands ────────────────────────────────────────────────────────

async function taskList(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      status: { type: 'string', short: 's', default: 'pending' },
      limit: { type: 'string', short: 'n' },
    },
    allowPositionals: false,
    strict: false,
  });

  const status = (values.status as string) as TaskStatus;
  if (!STATUS_CATEGORIES[status]) {
    throw new UsageError(
      `Invalid status: ${status}. Must be one of: ${Object.keys(STATUS_CATEGORIES).join(', ')}`,
    );
  }

  const category = statusCategory(status);
  let titles = await client.listCategories(category);
  const limit = values.limit ? parseInt(values.limit as string, 10) : undefined;
  if (limit) titles = titles.slice(0, limit);

  if (globals.json) {
    outputJson(titles.map((t) => ({ title: t, status })));
  } else {
    if (titles.length === 0) {
      console.log(`No ${status} tasks.`);
      return;
    }
    outputTable(
      ['Task', 'Status'],
      titles.map((t) => [t, status]),
    );
  }
}

async function taskRead(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { positionals } = parseArgs({
    args,
    options: {},
    allowPositionals: true,
    strict: false,
  });

  const id = positionals[0];
  if (!id) throw new UsageError('Usage: wai task read <id>');

  const title = `Task:${id}`;
  const page = await client.readPage(title);
  const task = parseTaskPage(page.title, page.content);

  if (globals.json) {
    outputJson(task);
  } else {
    console.log(`Task:${task.id}`);
    console.log(`  status:  ${task.status}`);
    if (task.source) console.log(`  source:  ${task.source}`);
    console.log(`  created: ${task.created}`);
    if (task.claimed_by) console.log(`  claimed: ${task.claimed_by} (${task.claimed_at})`);
    if (task.completed_at) console.log(`  completed: ${task.completed_at}`);
    console.log();
    console.log(task.description);
    if (task.output) {
      console.log();
      console.log('== Output ==');
      console.log(task.output);
    }
  }
}

async function taskCreate(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      message: { type: 'string', short: 'm' },
      source: { type: 'string' },
    },
    allowPositionals: false,
    strict: false,
  });

  const message = values.message as string | undefined;
  if (!message) throw new UsageError('Usage: wai task create -m "description" [--source X]');

  const nsId = await resolveTaskNamespace(client);
  const id = await nextTaskId(client, nsId);

  const task: TaskInfo = {
    id,
    status: 'pending',
    source: values.source as string | undefined,
    created: new Date().toISOString(),
    description: message,
    output: '',
  };

  const content = buildTaskPage(task);
  const title = `Task:${id}`;
  await client.createPage(title, content, `Create task ${id}`);

  if (globals.json) {
    outputJson({ id, title, status: 'created' });
  } else {
    console.log(`Created ${title}`);
  }
}

async function taskClaim(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { positionals } = parseArgs({
    args,
    options: {},
    allowPositionals: true,
    strict: false,
  });

  const id = positionals[0];
  if (!id) throw new UsageError('Usage: wai task claim <id>');

  const title = `Task:${id}`;
  const page = await client.readPage(title);
  const task = parseTaskPage(page.title, page.content);

  if (task.status !== 'pending') {
    throw new WaiError(`Cannot claim task ${id}: status is "${task.status}" (expected "pending")`, 1);
  }

  task.status = 'in-progress';
  task.claimed_by = 'cli';
  task.claimed_at = new Date().toISOString();

  await client.writePage(title, buildTaskPage(task), `Claim task ${id}`);

  if (globals.json) {
    outputJson({ id, status: 'in-progress' });
  } else {
    console.log(`Claimed ${title}`);
  }
}

async function taskComplete(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      message: { type: 'string', short: 'm' },
    },
    allowPositionals: true,
    strict: false,
  });

  const id = positionals[0];
  if (!id) throw new UsageError('Usage: wai task complete <id> [-m "output"]');

  const title = `Task:${id}`;
  const page = await client.readPage(title);
  const task = parseTaskPage(page.title, page.content);

  if (task.status !== 'in-progress') {
    throw new WaiError(
      `Cannot complete task ${id}: status is "${task.status}" (expected "in-progress")`,
      1,
    );
  }

  task.status = 'done';
  task.completed_at = new Date().toISOString();
  const msg = values.message as string | undefined;
  if (msg) {
    task.output = task.output ? `${task.output}\n${msg}` : msg;
  }

  await client.writePage(title, buildTaskPage(task), `Complete task ${id}`);

  if (globals.json) {
    outputJson({ id, status: 'done' });
  } else {
    console.log(`Completed ${title}`);
  }
}

async function taskFail(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      message: { type: 'string', short: 'm' },
    },
    allowPositionals: true,
    strict: false,
  });

  const id = positionals[0];
  if (!id) throw new UsageError('Usage: wai task fail <id> [-m "reason"]');

  const title = `Task:${id}`;
  const page = await client.readPage(title);
  const task = parseTaskPage(page.title, page.content);

  if (task.status !== 'in-progress') {
    throw new WaiError(
      `Cannot fail task ${id}: status is "${task.status}" (expected "in-progress")`,
      1,
    );
  }

  task.status = 'failed';
  task.completed_at = new Date().toISOString();
  const msg = values.message as string | undefined;
  if (msg) {
    task.output = task.output ? `${task.output}\n${msg}` : msg;
  }

  await client.writePage(title, buildTaskPage(task), `Fail task ${id}`);

  if (globals.json) {
    outputJson({ id, status: 'failed' });
  } else {
    console.log(`Failed ${title}`);
  }
}

async function taskRequeue(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { positionals } = parseArgs({
    args,
    options: {},
    allowPositionals: true,
    strict: false,
  });

  const id = positionals[0];
  if (!id) throw new UsageError('Usage: wai task requeue <id>');

  const title = `Task:${id}`;
  const page = await client.readPage(title);
  const task = parseTaskPage(page.title, page.content);

  if (task.status !== 'failed' && task.status !== 'in-progress') {
    throw new WaiError(
      `Cannot requeue task ${id}: status is "${task.status}" (expected "failed" or "in-progress")`,
      1,
    );
  }

  task.status = 'pending';
  task.claimed_by = undefined;
  task.claimed_at = undefined;
  task.completed_at = undefined;

  await client.writePage(title, buildTaskPage(task), `Requeue task ${id}`);

  if (globals.json) {
    outputJson({ id, status: 'pending' });
  } else {
    console.log(`Requeued ${title}`);
  }
}
