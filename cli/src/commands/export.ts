import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';
import { WikiClient } from '../wiki-client.js';
import { UsageError, WaiError } from '../errors.js';
import { type GlobalFlags, outputJson } from '../output.js';

const BATCH_SIZE = 50;

export async function exportCommand(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      ns: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  const outPath = positionals[0];
  if (!outPath) throw new UsageError('Usage: wai export <file> [--ns 0,1,10] [--dry-run]');

  const dryRun = values['dry-run'] as boolean;

  // Determine which namespaces to export
  let namespaceIds: number[];
  if (values.ns) {
    namespaceIds = (values.ns as string).split(',').map((n) => parseInt(n.trim(), 10));
  } else {
    const namespaces = await client.getNamespaces();
    namespaceIds = namespaces.map((n) => n.id);
  }

  // Collect all page titles
  const allTitles: string[] = [];
  for (const ns of namespaceIds) {
    const titles = await client.listAllPages(ns);
    allTitles.push(...titles);
  }

  if (!globals.quiet) {
    console.log(`Found ${allTitles.length} pages`);
  }

  if (dryRun) {
    if (globals.json) {
      outputJson(allTitles.map((t) => ({ title: t })));
    } else {
      for (const t of allTitles) {
        console.log(`  ${t}`);
      }
    }
    return;
  }

  // Export in batches, merging XML
  let xml = '';
  let exported = 0;

  for (let i = 0; i < allTitles.length; i += BATCH_SIZE) {
    const batch = allTitles.slice(i, i + BATCH_SIZE);
    const batchXml = await client.exportPages(batch);

    if (i === 0) {
      // First batch: keep everything except closing </mediawiki>
      xml = batchXml.replace(/<\/mediawiki>\s*$/, '\n');
    } else {
      // Subsequent batches: extract content between </siteinfo> and </mediawiki>
      const start = batchXml.indexOf('</siteinfo>');
      const end = batchXml.lastIndexOf('</mediawiki>');
      if (start >= 0 && end > start) {
        xml += batchXml.slice(start + '</siteinfo>'.length, end);
      }
    }

    exported += batch.length;
    if (!globals.quiet) {
      console.log(`  Exported ${exported}/${allTitles.length} pages`);
    }
  }

  xml += '</mediawiki>\n';

  try {
    writeFileSync(outPath, xml, 'utf-8');
  } catch (e: any) {
    throw new WaiError(`Cannot write file: ${outPath} (${e.message})`, 1);
  }

  if (globals.json) {
    outputJson({ file: outPath, pages: allTitles.length });
  } else if (!globals.quiet) {
    console.log(`\nWrote ${outPath} (${allTitles.length} pages)`);
  }
}
