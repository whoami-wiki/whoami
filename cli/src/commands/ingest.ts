import { parseArgs } from 'node:util';
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { type WikiClient } from '../wiki-client.js';
import { UsageError, WaiError } from '../errors.js';
import { type GlobalFlags, outputJson, outputTable } from '../output.js';

// ── Types ──────────────────────────────────────────────────────────────

interface ManifestEntry {
  page: number;
  file: string;
  hash: string;
  detected_number?: string;
  detected_title?: string;
  type: 'drawing' | 'spec' | 'unknown';
  status: 'pending' | 'analyzed' | 'skipped';
}

interface VolumeManifest {
  name: string;
  source_file: string;
  type: 'drawings' | 'specs' | 'general';
  created: string;
  entries: ManifestEntry[];
}

// ── Dispatcher ─────────────────────────────────────────────────────────

export async function ingestCommand(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const sub = args[0];
  const subArgs = args.slice(1);

  switch (sub) {
    case 'volume':
      return ingestVolume(subArgs, globals);
    case 'status':
      return ingestStatus(subArgs, globals);
    case 'analyze':
      return ingestAnalyze(subArgs, globals, client);
    default:
      throw new UsageError(
        'Usage: wai ingest <volume|status|analyze>\n\n' +
        '  volume <path> [--type X] [--name N]  Split a PDF volume into pages and catalog\n' +
        '  status <name>                        Show ingestion status for a volume\n' +
        '  analyze <name> [--area N] [--range X] Create tasks to analyze pages',
      );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function getIngestDir(): string {
  const dir = join(process.env.HOME || process.env.USERPROFILE || '.', '.wai', 'ingest');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function manifestPath(name: string): string {
  return join(getIngestDir(), `${name}.json`);
}

function loadManifest(name: string): VolumeManifest {
  const path = manifestPath(name);
  if (!existsSync(path)) {
    throw new WaiError(`No manifest found for "${name}". Run "wai ingest volume" first.`, 4);
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function saveManifest(manifest: VolumeManifest): void {
  const path = manifestPath(manifest.name);
  writeFileSync(path, JSON.stringify(manifest, null, 2));
}

function hashFile(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/** Attempt to detect a drawing number from a filename. */
function detectDrawingNumber(filename: string): string | undefined {
  // Common patterns: C-301, S-302, M-401, E-101, I-201
  const match = filename.match(/([A-Z]{1,3})-?(\d{3,4})/i);
  return match ? `${match[1].toUpperCase()}-${match[2]}` : undefined;
}

/** Attempt to detect a CSI spec section from a filename or content hint. */
function detectSpecSection(filename: string): string | undefined {
  // Common pattern: 033000, 03-30-00, 03 30 00
  const match = filename.match(/(\d{2})\s*[-_]?\s*(\d{2})\s*[-_]?\s*(\d{2})/);
  return match ? `${match[1]} ${match[2]} ${match[3]}` : undefined;
}

// ── Subcommands ────────────────────────────────────────────────────────

async function ingestVolume(
  args: string[],
  globals: GlobalFlags,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      type: { type: 'string', short: 't', default: 'drawings' },
      name: { type: 'string', short: 'n' },
    },
    allowPositionals: true,
    strict: false,
  });

  const sourcePath = positionals[0];
  if (!sourcePath) {
    throw new UsageError('Usage: wai ingest volume <path> [--type drawings|specs|general] [--name "Volume 3"]');
  }

  if (!existsSync(sourcePath)) {
    throw new WaiError(`Path not found: ${sourcePath}`, 1);
  }

  const type = values.type as 'drawings' | 'specs' | 'general';
  const volumeName = (values.name as string) || basename(sourcePath, extname(sourcePath));

  const stat = statSync(sourcePath);
  const entries: ManifestEntry[] = [];

  if (stat.isDirectory()) {
    // Directory of individual files (pre-split PDFs or images)
    const files = readdirSync(sourcePath)
      .filter((f: string) => /\.(pdf|png|jpg|jpeg|tif|tiff)$/i.test(f))
      .sort();

    for (let i = 0; i < files.length; i++) {
      const filePath = join(sourcePath, files[i]);
      const hash = hashFile(filePath);
      const drawingNum = type === 'drawings' ? detectDrawingNumber(files[i]) : undefined;
      const specSection = type === 'specs' ? detectSpecSection(files[i]) : undefined;

      entries.push({
        page: i + 1,
        file: files[i],
        hash,
        detected_number: drawingNum || specSection,
        detected_title: undefined,
        type: type === 'drawings' ? 'drawing' :
              type === 'specs' ? 'spec' : 'unknown',
        status: 'pending',
      });
    }
  } else if (stat.isFile()) {
    // Single PDF — note that actual splitting requires external tooling
    const hash = hashFile(sourcePath);
    entries.push({
      page: 1,
      file: basename(sourcePath),
      hash,
      type: type === 'drawings' ? 'drawing' :
            type === 'specs' ? 'spec' : 'unknown',
      status: 'pending',
    });

    if (!globals.quiet) {
      console.log('Note: Single PDF detected. For multi-page volumes, split into');
      console.log('individual pages first (e.g., using pdftk or qpdf) and point');
      console.log('this command at the output directory.');
      console.log('');
      console.log('  pdftk volume.pdf burst output pages/page_%03d.pdf');
      console.log('  wai ingest volume pages/ --type drawings --name "Volume 3"');
      console.log('');
    }
  }

  const manifest: VolumeManifest = {
    name: volumeName,
    source_file: sourcePath,
    type,
    created: new Date().toISOString(),
    entries,
  };

  saveManifest(manifest);

  if (globals.json) {
    outputJson(manifest);
  } else {
    console.log(`Volume "${volumeName}" cataloged`);
    console.log(`  Source: ${sourcePath}`);
    console.log(`  Type: ${type}`);
    console.log(`  Pages: ${entries.length}`);

    const detected = entries.filter((e) => e.detected_number);
    if (detected.length > 0) {
      console.log(`  Auto-detected: ${detected.length} identifiers`);
    }

    const undetected = entries.filter((e) => !e.detected_number);
    if (undetected.length > 0) {
      console.log(`  Unrecognized: ${undetected.length} pages`);
    }

    console.log(`\nManifest saved to: ${manifestPath(volumeName)}`);
    console.log('Review and edit the manifest, then run:');
    console.log(`  wai ingest analyze "${volumeName}"`);
  }
}

async function ingestStatus(
  args: string[],
  globals: GlobalFlags,
): Promise<void> {
  const { positionals } = parseArgs({
    args,
    options: {},
    allowPositionals: true,
    strict: false,
  });

  const name = positionals.join(' ');

  if (!name) {
    // List all volumes
    const dir = getIngestDir();
    const files = existsSync(dir)
      ? readdirSync(dir).filter((f: string) => f.endsWith('.json'))
      : [];

    if (files.length === 0) {
      console.log('No volumes ingested. Run "wai ingest volume <path>" first.');
      return;
    }

    const manifests = files.map((f: string) => {
      const m = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as VolumeManifest;
      const analyzed = m.entries.filter((e) => e.status === 'analyzed').length;
      return {
        name: m.name,
        type: m.type,
        total: m.entries.length,
        analyzed,
        pending: m.entries.length - analyzed,
      };
    });

    if (globals.json) {
      outputJson(manifests);
    } else {
      outputTable(
        ['Volume', 'Type', 'Total', 'Analyzed', 'Pending'],
        manifests.map((m) => [m.name, m.type, String(m.total), String(m.analyzed), String(m.pending)]),
      );
    }
    return;
  }

  const manifest = loadManifest(name);

  if (globals.json) {
    outputJson(manifest);
  } else {
    console.log(`Volume: ${manifest.name}`);
    console.log(`Source: ${manifest.source_file}`);
    console.log(`Type: ${manifest.type}`);
    console.log(`Created: ${manifest.created}`);
    console.log(`Total pages: ${manifest.entries.length}`);
    console.log('');

    const analyzed = manifest.entries.filter((e) => e.status === 'analyzed');
    const pending = manifest.entries.filter((e) => e.status === 'pending');
    const skipped = manifest.entries.filter((e) => e.status === 'skipped');

    console.log(`  Analyzed: ${analyzed.length}`);
    console.log(`  Pending:  ${pending.length}`);
    console.log(`  Skipped:  ${skipped.length}`);

    if (pending.length > 0) {
      console.log('\nPending pages:');
      outputTable(
        ['Page', 'File', 'Detected'],
        pending.slice(0, 20).map((e) => [
          String(e.page),
          e.file,
          e.detected_number || '—',
        ]),
      );
      if (pending.length > 20) {
        console.log(`  ... and ${pending.length - 20} more`);
      }
    }
  }
}

async function ingestAnalyze(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      area: { type: 'string', short: 'a' },
      range: { type: 'string', short: 'r' },
      limit: { type: 'string', short: 'n' },
    },
    allowPositionals: true,
    strict: false,
  });

  const name = positionals.join(' ');
  if (!name) throw new UsageError('Usage: wai ingest analyze <volume> [--area N] [--range X:Y] [--limit N]');

  const manifest = loadManifest(name);
  let entries = manifest.entries.filter((e) => e.status === 'pending');

  // Filter by range if specified (e.g., C-301:C-310)
  const range = values.range as string | undefined;
  if (range && range.includes(':')) {
    const [start, end] = range.split(':');
    entries = entries.filter((e) => {
      const num = e.detected_number;
      if (!num) return false;
      return num >= start && num <= end;
    });
  }

  // Filter by area if specified
  const area = values.area as string | undefined;
  if (area) {
    const areaNum = area.padStart(2, '0');
    entries = entries.filter((e) => {
      // Check if detected number's numeric part matches area
      const num = e.detected_number;
      if (!num) return false;
      const match = num.match(/[A-Z]-(\d)/);
      return match && match[1] === areaNum[0];
    });
  }

  // Apply limit
  const limit = values.limit ? parseInt(values.limit as string, 10) : entries.length;
  entries = entries.slice(0, limit);

  if (entries.length === 0) {
    console.log('No pending pages match the specified criteria.');
    return;
  }

  // Create a task for each entry (or batch)
  const namespaces = await client.getNamespaces();
  const taskNs = namespaces.find((n) => n.name === 'Task');
  if (!taskNs) {
    throw new WaiError('No "Task" namespace found.', 1);
  }

  // Get next task ID
  const taskTitles = await client.listAllPages(taskNs.id);
  let maxTaskId = 0;
  for (const t of taskTitles) {
    const num = parseInt(t.replace(/^Task:/, ''), 10);
    if (!isNaN(num) && num > maxTaskId) maxTaskId = num;
  }

  const createdTasks: string[] = [];

  for (const entry of entries) {
    maxTaskId++;
    const taskId = String(maxTaskId).padStart(4, '0');
    const drawingNum = entry.detected_number || `page-${entry.page}`;
    const prefix = manifest.type === 'drawings' ? 'Drawing' : 'Spec';

    const taskContent = [
      '{{Infobox Task',
      `| id          = ${taskId}`,
      '| status      = pending',
      `| source      = ${manifest.name}`,
      `| created     = ${new Date().toISOString()}`,
      '}}',
      `Analyze ${manifest.type === 'drawings' ? 'drawing' : 'spec'} from volume "${manifest.name}".`,
      '',
      `Source file: ${entry.file}`,
      `Detected identifier: ${drawingNum}`,
      `Target page: ${prefix}:${drawingNum}`,
      '',
      '== Output ==',
      '',
      '[[Category:Pending tasks]]',
    ].join('\n');

    const taskTitle = `Task:${taskId}`;
    await client.createPage(taskTitle, taskContent, `Create analysis task for ${drawingNum}`);
    createdTasks.push(taskTitle);

    // Mark entry as having a task (but not yet analyzed)
    entry.status = 'pending'; // Will be marked analyzed when task completes
  }

  saveManifest(manifest);

  if (globals.json) {
    outputJson({ volume: name, tasks_created: createdTasks.length, tasks: createdTasks });
  } else {
    console.log(`Created ${createdTasks.length} analysis tasks for "${name}"`);
    for (const t of createdTasks) {
      console.log(`  ${t}`);
    }
    console.log('\nRun "wai task list" to see pending tasks.');
  }
}
