import { readFileSync } from 'node:fs';
import * as parseGedcomLib from 'parse-gedcom';
import type { GedcomNode } from './types.ts';

export interface ParseResult {
  individuals: Map<string, GedcomNode>;   // "I123" → its tree
  families: Map<string, GedcomNode>;      // "F1" → its tree
  raw: GedcomNode[];                      // all top-level records (for sources, etc.)
}

/**
 * parse-gedcom 2.x emits a unist-style tree:
 *   { type: string, value?: string, children: RawNode[], data: { xref_id?: string, pointer?: string, ... } }
 * Older 0.1.x used { tag, data (string), tree }.
 * Normalize both to our internal GedcomNode shape (tag/data/tree).
 */
type RawNode = {
  // parse-gedcom 2.x fields
  type?: string;
  value?: string;
  children?: RawNode[];
  data?: { xref_id?: string; pointer?: string; [k: string]: unknown };
  // parse-gedcom 0.1.x / fallback fields
  tag?: string;
  pointer?: string;
  tree?: RawNode[];
};

/** Root node emitted by parse-gedcom 2.x */
type RootNode = {
  type: 'root';
  children: RawNode[];
};

function normalize(node: RawNode): GedcomNode {
  const tag = node.type ?? node.tag ?? '';
  // xref_id lives in node.data.xref_id in 2.x; older versions put it in node.pointer
  const pointer = node.data?.xref_id ?? node.pointer;
  // In 2.x, data is an object; value is the text after the tag.
  // For pointers (FAMC, HUSB, WIFE), the pointer is in node.data.pointer
  let data = node.value ?? (typeof (node as Record<string, unknown>).data === 'string' ? (node as unknown as { data: string }).data : undefined);
  if (!data && node.data?.pointer) {
    data = node.data.pointer;
  }
  const kids = node.children ?? node.tree ?? [];
  return {
    tag,
    pointer,
    data,
    tree: kids.map(normalize),
  };
}

/** Parse a GEDCOM 5.5.1 UTF-8 file. Throws on missing/unsupported CHAR. */
export async function parseGedcomFile(path: string): Promise<ParseResult> {
  const text = readFileSync(path, 'utf-8');

  // parse-gedcom may expose `parse` as a named export, default export, or
  // single-function module export. Try all three.
  const lib = parseGedcomLib as unknown as Record<string, unknown> & { default?: unknown };
  const candidates: unknown[] = [
    lib.parse,
    typeof lib.default === 'object' && lib.default !== null ? (lib.default as Record<string, unknown>).parse : undefined,
    lib.default,
  ];
  const parser = candidates.find(c => typeof c === 'function') as ((s: string) => RootNode | RawNode[]) | undefined;
  if (!parser) throw new Error('parse-gedcom: could not locate parse function (incompatible version?)');

  const rawResult = parser(text);

  // parse-gedcom 2.x returns a root node { type: 'root', children: [...] }
  // Older versions returned a flat RawNode[] array
  let topNodes: RawNode[];
  if (Array.isArray(rawResult)) {
    topNodes = rawResult;
  } else {
    const root = rawResult as RootNode;
    topNodes = root.children ?? [];
  }

  const top: GedcomNode[] = topNodes.map(normalize);

  const head = top.find(n => n.tag === 'HEAD');
  if (!head) throw new Error('GEDCOM: no HEAD record');
  const charNode = head.tree.find(n => n.tag === 'CHAR');
  if (!charNode) throw new Error('GEDCOM: missing CHAR (encoding); only UTF-8 is supported');
  const encoding = (charNode.data ?? '').trim().toUpperCase();
  if (encoding !== 'UTF-8' && encoding !== 'UTF8') {
    throw new Error(`GEDCOM: ${encoding} encoding not supported (this tool only accepts UTF-8); ANSEL and other encodings are out of scope`);
  }

  const gedcNode = head.tree.find(n => n.tag === 'GEDC');
  const versNode = gedcNode?.tree.find(n => n.tag === 'VERS');
  const version = (versNode?.data ?? '').trim();
  if (version && !version.startsWith('5.5')) {
    throw new Error(`GEDCOM: version ${version} not supported (this tool only accepts 5.5.x)`);
  }

  const individuals = new Map<string, GedcomNode>();
  const families = new Map<string, GedcomNode>();
  for (const record of top) {
    if (record.tag === 'INDI' && record.pointer) {
      individuals.set(stripPointer(record.pointer), record);
    } else if (record.tag === 'FAM' && record.pointer) {
      families.set(stripPointer(record.pointer), record);
    }
  }

  return { individuals, families, raw: top };
}

function stripPointer(p: string): string {
  return p.replace(/^@|@$/g, '');
}
