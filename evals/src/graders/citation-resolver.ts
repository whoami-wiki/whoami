import { parseCitations } from './citations.js';
import {
  readManifest,
  readObject,
  findInManifest,
  findAllInManifest,
  extractMessagesNearDate,
  type Manifest,
} from '../vault.js';

export interface ResolvedCitation {
  /** A textual representation of the citation (template + fields) */
  raw: string;
  /** Extracted source excerpt (messages near date, or confirmation of file existence) */
  sourceExcerpt: string;
  /** Whether the citation was successfully resolved */
  resolved: boolean;
  /** Error message if resolution failed */
  error?: string;
  /** Grouping key for batching (e.g. "snapshot:thread") */
  sourceKey?: string;
}

/**
 * Cache key for thread file reads: "snapshotId:threadDir"
 */
type CacheKey = string;

function renderRaw(template: string, fields: Record<string, string>): string {
  const attrs = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  return `::cite-${template}{${attrs}}`;
}

/**
 * Resolve citations from a markdown body against the vault.
 *
 * For message/voice-note templates: find the thread directory in the manifest,
 * read the message JSON, and filter by date.
 *
 * For photo/video templates: confirm the file exists in the manifest.
 *
 * For vault templates: confirm snapshot exists in manifest.
 */
export function resolveCitations(
  body: string,
  vaultPath: string,
): ResolvedCitation[] {
  const citations = parseCitations(body);
  const results: ResolvedCitation[] = [];

  // Cache: snapshotId:thread -> parsed JSON string
  const threadCache = new Map<CacheKey, string | null>();

  for (const citation of citations) {
    const { fields, template } = citation;
    const raw = renderRaw(template, fields);

    const snapshotId = fields['snapshot'];
    const date = fields['date'];
    const thread = fields['thread'];

    if (!snapshotId) {
      results.push({
        raw,
        sourceExcerpt: '',
        resolved: false,
        error: 'No snapshot field',
      });
      continue;
    }

    const manifest = readManifest(vaultPath, snapshotId);
    if (!manifest) {
      // For photo/video, fall back to treating snapshot as a direct object hash
      if (template === 'photo' || template === 'video') {
        const buf = readObject(vaultPath, snapshotId);
        if (buf) {
          results.push({
            raw,
            sourceExcerpt: buf.toString('utf-8').slice(0, 2000),
            resolved: true,
            sourceKey: `hash:${snapshotId}`,
          });
          continue;
        }
      }
      results.push({
        raw,
        sourceExcerpt: '',
        resolved: false,
        error: `Manifest not found: ${snapshotId}`,
      });
      continue;
    }

    if (template === 'message' || template === 'voice-note') {
      // Use date or timestamp field
      const dateField = date ?? fields['timestamp'];
      const excerpt = resolveMessageCitation(
        manifest,
        vaultPath,
        snapshotId,
        thread,
        dateField,
        threadCache,
      );

      // If thread-based resolution fails, try as a file path in the manifest
      if (excerpt === null && thread) {
        const fileResult = resolveFileCitation(manifest, vaultPath, thread, threadCache, snapshotId);
        if (fileResult) {
          results.push({
            raw,
            sourceExcerpt: fileResult,
            resolved: true,
            sourceKey: `${snapshotId}:${thread}`,
          });
          continue;
        }
      }

      results.push({
        raw,
        sourceExcerpt: excerpt ?? '',
        resolved: excerpt !== null,
        error: excerpt === null ? `Could not resolve message for thread=${thread}, date=${dateField}` : undefined,
        sourceKey: `${snapshotId}:${thread ?? 'unknown'}`,
      });
    } else if (template === 'photo' || template === 'video') {
      const mediaResolved = resolveMediaCitation(manifest, vaultPath, thread, fields['snapshot']);
      results.push({
        raw,
        sourceExcerpt: mediaResolved ? `[${template} file confirmed in manifest]` : '',
        resolved: mediaResolved,
        error: mediaResolved ? undefined : `Media file not found in manifest`,
        sourceKey: `${snapshotId}:media`,
      });
    } else if (template === 'vault') {
      // cite-vault: confirm snapshot exists in manifest (bibliographic reference)
      results.push({
        raw,
        sourceExcerpt: `[Vault reference confirmed: snapshot ${snapshotId}, ${manifest.files.length} files]`,
        resolved: true,
        sourceKey: `${snapshotId}:vault`,
      });
    } else {
      results.push({
        raw,
        sourceExcerpt: '',
        resolved: false,
        error: `Unknown citation template: ${template}`,
      });
    }
  }

  return results;
}

/**
 * Resolve a citation where thread= points to a file path in the manifest
 * (e.g. connections/followers_and_following, contacts.db/msgstore.db).
 * Reads the file and returns a truncated excerpt.
 */
function resolveFileCitation(
  manifest: Manifest,
  vaultPath: string,
  thread: string,
  cache: Map<CacheKey, string | null>,
  snapshotId: string,
): string | null {
  // Try exact path match and partial path match
  const files = findAllInManifest(manifest, (p) => {
    // Handle paths like "contacts.db/msgstore.db" — try each part
    const parts = thread.split('/');
    return parts.some((part) => p.endsWith(part) || p.includes(part));
  });

  if (files.length === 0) return null;

  const excerpts: string[] = [];
  for (const file of files.slice(0, 3)) {
    const cacheKey: CacheKey = `${snapshotId}:${file.hash}`;
    let content: string | null;

    if (cache.has(cacheKey)) {
      content = cache.get(cacheKey)!;
    } else {
      const buf = readObject(vaultPath, file.hash);
      content = buf ? buf.toString('utf-8') : null;
      cache.set(cacheKey, content);
    }

    if (content) {
      excerpts.push(`[${file.path}]\n${content.slice(0, 2000)}`);
    }
  }

  return excerpts.length > 0 ? excerpts.join('\n\n') : null;
}

function resolveMessageCitation(
  manifest: Manifest,
  vaultPath: string,
  snapshotId: string,
  thread: string | undefined,
  date: string | undefined,
  cache: Map<CacheKey, string | null>,
): string | null {
  if (!thread || !date) {
    return null;
  }

  // Find message files in the thread directory
  const threadFiles = findAllInManifest(manifest, (p) =>
    p.includes(thread) && p.endsWith('.json'),
  );

  if (threadFiles.length === 0) {
    return null;
  }

  // Try each message file in the thread
  for (const file of threadFiles) {
    const cacheKey: CacheKey = `${snapshotId}:${file.hash}`;
    let json: string | null;

    if (cache.has(cacheKey)) {
      json = cache.get(cacheKey)!;
    } else {
      const buf = readObject(vaultPath, file.hash);
      json = buf ? buf.toString('utf-8') : null;
      cache.set(cacheKey, json);
    }

    if (!json) continue;

    const excerpt = extractMessagesNearDate(json, date);
    if (excerpt) {
      return excerpt;
    }
  }

  return null;
}

function resolveMediaCitation(
  manifest: Manifest,
  vaultPath: string,
  thread: string | undefined,
  hash: string | undefined,
): boolean {
  // If we have a direct hash, check if the object exists
  if (hash) {
    const buf = readObject(vaultPath, hash);
    if (buf !== null) return true;
  }

  // Otherwise check if there are media files in the thread
  if (thread) {
    const mediaFile = findInManifest(manifest, (p) =>
      p.includes(thread) && /\.(jpg|jpeg|png|mp4|webm|ogg|mp3)$/i.test(p),
    );
    return mediaFile !== undefined;
  }

  return false;
}
