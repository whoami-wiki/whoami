import type { GedcomRef, Warning } from '../types.ts';

const CITE_VAULT_RE = /\{\{Cite vault\s*\|([^}]+)\}\}/i;

/**
 * The legacy wiki uses `{{Cite vault|note=Barash Family Tree.ged record I…}}`
 * to cite a GEDCOM record. The first such citation on a page declares the
 * page's GEDCOM ref (lifted to frontmatter).
 *
 * Filename normalization: any human-readable label like "Barash Family
 * Tree.ged" maps to the canonical install path `barash-tree.ged`. Update
 * GED_FILE_ALIASES if you add additional .ged sources.
 */
const GED_FILE_ALIASES: Record<string, string> = {
  'barash family tree.ged': 'barash-tree.ged',
  'barash-tree.ged': 'barash-tree.ged',
};

const RECORD_RE = /([A-Za-z0-9 _-]+\.ged)\s+record\s+(I\d+)/i;

export function extractCiteVaultRef(
  text: string,
  snapshotHash: string,
): { ref: GedcomRef | null; warning: Warning | null } {
  const m = CITE_VAULT_RE.exec(text);
  if (!m) return { ref: null, warning: null };

  // Parse pipe-delimited args (only `note=` matters here)
  const args = parsePipeArgs(m[1]!);
  const note = args.note ?? '';
  const recMatch = RECORD_RE.exec(note);
  if (!recMatch) {
    return {
      ref: null,
      warning: { page: '', kind: 'malformed-cite-vault', detail: m[0]!.slice(0, 120) },
    };
  }

  const rawFile = recMatch[1]!.toLowerCase();
  const file = GED_FILE_ALIASES[rawFile] ?? rawFile.replace(/\s+/g, '-');
  return {
    ref: { file, record: recMatch[2]!, snapshot: snapshotHash },
    warning: null,
  };
}

/**
 * Parse `key1=value1|key2=value2` into a record. Whitespace around `=` and
 * `|` is preserved inside values; only the splitting characters are removed.
 */
function parsePipeArgs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of s.split('|')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}
