import { parseArgs } from 'node:util';
import { type WikiClient } from '../wiki-client.js';
import { UsageError } from '../errors.js';
import { type GlobalFlags, outputJson, outputTable } from '../output.js';

// ── Dispatcher ─────────────────────────────────────────────────────────

export async function verifyCommand(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      all: { type: 'boolean' },
      stale: { type: 'string' },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.all) {
    return verifyAll(values, globals, client);
  }

  const title = positionals.join(' ');
  if (!title) {
    throw new UsageError(
      'Usage: wai verify <title>              Check a single page\n' +
      '       wai verify --all [--stale N]    List all pages needing verification',
    );
  }

  return verifySingle(title, globals, client);
}

// ── Helpers ────────────────────────────────────────────────────────────

interface VerificationInfo {
  title: string;
  status: string;
  last_verified?: string;
  days_stale?: number;
  note?: string;
}

function parseVerificationStatus(talkContent: string): VerificationInfo | null {
  // Look for {{Verification|...}} template
  const match = talkContent.match(
    /\{\{Verification\s*((?:\|[^}]*?)*)?\}\}/s,
  );
  if (!match) return null;

  const params: Record<string, string> = {};
  const paramBlock = match[1] || '';
  for (const m of paramBlock.matchAll(/\|\s*(\w+)\s*=\s*(.*?)(?=\n\s*\||$)/gs)) {
    params[m[1].trim()] = m[2].trim();
  }

  const info: VerificationInfo = {
    title: '',
    status: params.status || 'unknown',
    last_verified: params.last_verified,
    note: params.note,
  };

  if (info.last_verified) {
    const verifiedDate = new Date(info.last_verified);
    const now = new Date();
    info.days_stale = Math.floor((now.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  return info;
}

// ── Single page verification ───────────────────────────────────────────

async function verifySingle(
  title: string,
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  // Read the talk page
  let talkContent: string;
  try {
    const talkPage = await client.readTalkPage(title);
    talkContent = talkPage.content;
  } catch {
    if (globals.json) {
      outputJson({ title, status: 'no-talk-page', message: 'No talk page found' });
    } else {
      console.log(`${title}: No talk page found`);
    }
    return;
  }

  const info = parseVerificationStatus(talkContent);

  if (!info) {
    if (globals.json) {
      outputJson({ title, status: 'no-verification', message: 'No Verification template found on talk page' });
    } else {
      console.log(`${title}: No verification status set`);
    }
    return;
  }

  info.title = title;

  if (globals.json) {
    outputJson(info);
  } else {
    const statusIcon = info.status === 'complete' ? '\u{1F7E2}' :
                       info.status === 'in-progress' ? '\u{1F7E1}' :
                       info.status === 'not-started' ? '\u{1F534}' :
                       info.status === 'issues' ? '\u26A0\uFE0F' : '\u2753';

    console.log(`${title}`);
    console.log(`  Status: ${statusIcon} ${info.status}`);
    if (info.last_verified) {
      console.log(`  Last verified: ${info.last_verified} (${info.days_stale} days ago)`);
    }
    if (info.note) {
      console.log(`  Note: ${info.note}`);
    }

    // Count open gaps
    const openGaps = (talkContent.match(/\{\{Open\}\}/g) || []).length;
    const closedGaps = (talkContent.match(/\{\{Closed\}\}/g) || []).length;
    if (openGaps > 0 || closedGaps > 0) {
      console.log(`  Gaps: ${openGaps} open, ${closedGaps} closed`);
    }
  }
}

// ── All-pages verification scan ────────────────────────────────────────

async function verifyAll(
  values: Record<string, unknown>,
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const staleDays = values.stale ? parseInt(values.stale as string, 10) : undefined;

  // Get all main namespace pages
  const titles = await client.listAllPages(0);

  const results: VerificationInfo[] = [];

  for (const title of titles) {
    // Skip special pages
    if (title === 'Main Page' || title.startsWith('Project Standards')) continue;

    let talkContent: string;
    try {
      const talkPage = await client.readTalkPage(title);
      talkContent = talkPage.content;
    } catch {
      results.push({ title, status: 'no-talk-page' });
      continue;
    }

    const info = parseVerificationStatus(talkContent);
    if (!info) {
      results.push({ title, status: 'no-verification' });
      continue;
    }

    info.title = title;
    results.push(info);
  }

  // Filter by staleness if requested
  let filtered = results;
  if (staleDays !== undefined) {
    filtered = results.filter((r) => {
      const s = r.status;
      return s !== 'complete' ||
        (r.days_stale !== undefined && r.days_stale > staleDays);
    });
  }

  if (globals.json) {
    outputJson(filtered);
  } else {
    if (filtered.length === 0) {
      console.log('All pages are verified and current.');
      return;
    }

    outputTable(
      ['Page', 'Status', 'Last Verified', 'Days'],
      filtered.map((r) => [
        r.title,
        r.status,
        r.last_verified || '—',
        r.days_stale !== undefined ? String(r.days_stale) : '—',
      ]),
    );
  }
}
