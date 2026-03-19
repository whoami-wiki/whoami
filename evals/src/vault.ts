import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ManifestFile {
  path: string;
  hash: string;
}

export interface Manifest {
  files: ManifestFile[];
}

/**
 * Read a snapshot manifest from the vault.
 * Returns null if the manifest doesn't exist or can't be parsed.
 */
export function readManifest(vaultPath: string, snapshotId: string): Manifest | null {
  try {
    const raw = readFileSync(join(vaultPath, 'snapshots', `${snapshotId}.json`), 'utf-8');
    return JSON.parse(raw) as Manifest;
  } catch {
    return null;
  }
}

/**
 * Read a raw object from the vault by its hash.
 * Objects are stored at objects/<2-char prefix>/<full hash>.
 */
export function readObject(vaultPath: string, hash: string): Buffer | null {
  const prefix = hash.slice(0, 2);
  try {
    return readFileSync(join(vaultPath, 'objects', prefix, hash));
  } catch {
    return null;
  }
}

/**
 * Find the first file in a manifest whose path matches a predicate.
 */
export function findInManifest(
  manifest: Manifest,
  predicate: (path: string) => boolean,
): ManifestFile | undefined {
  return manifest.files.find((f) => predicate(f.path));
}

/**
 * Find all files in a manifest whose path matches a predicate.
 */
export function findAllInManifest(
  manifest: Manifest,
  predicate: (path: string) => boolean,
): ManifestFile[] {
  return manifest.files.filter((f) => predicate(f.path));
}

interface InstagramMessage {
  sender_name: string;
  timestamp_ms: number;
  content?: string;
  photos?: { uri: string }[];
  videos?: { uri: string }[];
  audio_files?: { uri: string }[];
}

interface InstagramThread {
  participants: { name: string }[];
  messages: InstagramMessage[];
}

/**
 * Parse a date string which may be a single date or a range (start/end).
 * Returns { minTime, maxTime } in epoch milliseconds.
 *
 * Supported formats:
 * - "2019-11-14" (single date, +-windowDays)
 * - "2019-11-01/2020-02-07" (date range, used directly)
 * - "2019-11/2020-02" (month range, expanded to full range)
 */
function parseDateRange(dateStr: string, windowDays: number): { minTime: number; maxTime: number } | null {
  if (dateStr.includes('/')) {
    const [startStr, endStr] = dateStr.split('/');

    // Expand month-only strings: "2019-11" -> "2019-11-01"
    const expandDate = (s: string, end: boolean) => {
      if (/^\d{4}-\d{2}$/.test(s)) {
        if (end) {
          // Last day of month
          const [year, month] = s.split('-').map(Number);
          const lastDay = new Date(year, month, 0).getDate();
          return `${s}-${String(lastDay).padStart(2, '0')}`;
        }
        return `${s}-01`;
      }
      return s;
    };

    const start = new Date(expandDate(startStr, false));
    const end = new Date(expandDate(endStr, true));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    return { minTime: start.getTime(), maxTime: end.getTime() + 24 * 60 * 60 * 1000 - 1 };
  }

  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return { minTime: target.getTime() - windowMs, maxTime: target.getTime() + windowMs };
}

/**
 * Parse Instagram message JSON and extract messages within a date window.
 * Returns formatted text with sender, date, and content.
 * Caps at 50 messages to keep context manageable.
 *
 * Supports single dates ("2019-11-14") and date ranges ("2019-11-01/2020-02-07").
 */
export function extractMessagesNearDate(
  json: string,
  targetDate: string,
  windowDays: number = 1,
): string {
  let thread: InstagramThread;
  try {
    thread = JSON.parse(json) as InstagramThread;
  } catch {
    return '';
  }

  if (!thread.messages || !Array.isArray(thread.messages)) {
    return '';
  }

  const range = parseDateRange(targetDate, windowDays);
  if (!range) return '';

  const { minTime, maxTime } = range;

  const filtered = thread.messages
    .filter((m) => m.timestamp_ms >= minTime && m.timestamp_ms <= maxTime)
    .sort((a, b) => a.timestamp_ms - b.timestamp_ms)
    .slice(0, 50);

  if (filtered.length === 0) {
    return '';
  }

  const lines = filtered.map((m) => {
    const date = new Date(m.timestamp_ms).toISOString().slice(0, 19).replace('T', ' ');
    const content = m.content ?? '[media]';
    return `[${date}] ${m.sender_name}: ${content}`;
  });

  const participants = thread.participants?.map((p) => p.name).join(', ') ?? 'unknown';
  return `Thread participants: ${participants}\n\n${lines.join('\n')}`;
}
