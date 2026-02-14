import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { WikiClient } from '../wiki-client.js';
import { UsageError, WaiError } from '../errors.js';
import { type GlobalFlags, outputJson } from '../output.js';

export interface DumpPage {
  title: string;
  ns: number;
  text: string;
}

export interface ParseDumpResult {
  pages: DumpPage[];
  namespaces: Map<number, string>;
}

export function parseDump(xmlPath: string): ParseDumpResult {
  let xml: string;
  try {
    xml = readFileSync(xmlPath, 'utf-8');
  } catch (e: any) {
    throw new WaiError(`Cannot read file: ${xmlPath} (${e.message})`, 1);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: false,
    isArray: (tagName) => tagName === 'page' || tagName === 'namespace',
  });
  const doc = parser.parse(xml);

  // Parse namespace map from siteinfo
  const namespaces = new Map<number, string>();
  const rawNs = doc?.mediawiki?.siteinfo?.namespaces?.namespace ?? [];
  for (const ns of rawNs) {
    const id = typeof ns['@_key'] === 'number' ? ns['@_key'] : parseInt(ns['@_key'], 10);
    const name = typeof ns === 'string' ? ns : (ns['#text'] ?? '');
    if (!isNaN(id)) {
      namespaces.set(id, name);
    }
  }

  const rawPages = doc?.mediawiki?.page ?? [];
  const pages: DumpPage[] = [];

  for (const p of rawPages) {
    const title = p.title ?? '';
    const ns = typeof p.ns === 'number' ? p.ns : parseInt(p.ns, 10) || 0;
    const revs = p.revision;
    const rev = Array.isArray(revs) ? revs[revs.length - 1] : revs;
    const text = typeof rev?.text === 'string'
      ? rev.text
      : rev?.text?.['#text'] ?? '';
    pages.push({ title, ns, text });
  }

  return { pages, namespaces };
}

export async function importCommand(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      ns: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      m: { type: 'string' },
    },
    allowPositionals: true,
    strict: false,
  });

  const xmlPath = positionals[0];
  if (!xmlPath) throw new UsageError('Usage: wai import <file> [--ns 0,4] [--dry-run] [-m summary]');

  const summary = (values.m as string) || 'Imported from XML dump';
  const dryRun = values['dry-run'] as boolean;

  let nsFilter: Set<number> | null = null;
  if (values.ns) {
    nsFilter = new Set(
      (values.ns as string).split(',').map((n) => parseInt(n.trim(), 10)),
    );
  }

  const dump = parseDump(xmlPath);
  let pages = dump.pages;
  if (nsFilter) {
    pages = pages.filter((p) => nsFilter!.has(p.ns));
  }

  // Reconcile namespace prefixes for pages with ns > 0
  let wikiNamespaces: Map<number, string> | null = null;
  for (const p of pages) {
    if (p.ns === 0) continue;

    let prefix = dump.namespaces.get(p.ns);

    // Fallback to wiki API if siteinfo is missing this namespace
    if (prefix === undefined) {
      if (!wikiNamespaces) {
        const nsList = await client.getNamespaces();
        wikiNamespaces = new Map(nsList.map((n) => [n.id, n.name]));
      }
      prefix = wikiNamespaces.get(p.ns);
    }

    if (prefix && !p.title.startsWith(prefix + ':')) {
      const corrected = `${prefix}:${p.title}`;
      if (!globals.quiet) {
        console.warn(`  ⚠ Title corrected: "${p.title}" → "${corrected}"`);
      }
      p.title = corrected;
    }
  }

  if (dryRun) {
    if (globals.json) {
      outputJson(pages.map((p) => ({ title: p.title, ns: p.ns, size: p.text.length })));
    } else {
      console.log(`Dry run: ${pages.length} pages`);
      for (const p of pages) {
        console.log(`  [ns ${p.ns}] ${p.title} (${p.text.length} bytes)`);
      }
    }
    return;
  }

  const failures: { title: string; error: string }[] = [];
  let imported = 0;

  for (const p of pages) {
    try {
      await client.importPage(p.title, p.text, summary);
      imported++;
      if (!globals.quiet) {
        console.log(`  ✓ ${p.title}`);
      }
    } catch (e: any) {
      const msg = e.message ?? String(e);
      failures.push({ title: p.title, error: msg });
      if (!globals.quiet) {
        console.error(`  ✗ ${p.title}: ${msg}`);
      }
    }
  }

  if (globals.json) {
    outputJson({ imported, failed: failures.length, total: pages.length, failures });
  } else if (!globals.quiet) {
    console.log();
    console.log(`Imported ${imported}/${pages.length} pages`);
    if (failures.length > 0) {
      console.log(`Failed: ${failures.length}`);
    }
  }

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}
