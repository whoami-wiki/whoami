import type { GedcomNode, DerivedRecord, DatedEvent, IndividualRef, ResidenceEvent, OccupationEvent, SourceRef } from './types.ts';
import type { ParseResult } from './parser.ts';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import yaml from 'js-yaml';

function deriveParents(node: GedcomNode, ctx: ParseResult): IndividualRef[] {
  const out: IndividualRef[] = [];
  for (const famc of node.tree.filter(n => n.tag === 'FAMC')) {
    const famPointer = (famc.data ?? '').replace(/^@|@$/g, '');
    const fam = ctx.families.get(famPointer);
    if (!fam) continue;
    for (const tag of ['HUSB', 'WIFE'] as const) {
      const link = fam.tree.find(n => n.tag === tag);
      if (!link?.data) continue;
      const parentRecord = link.data.replace(/^@|@$/g, '');
      const parent = ctx.individuals.get(parentRecord);
      if (!parent) continue;
      out.push({ record: parentRecord, name: deriveName(parent) });
    }
  }
  return out;
}

function deriveSpousesAndChildren(
  node: GedcomNode,
  selfRecord: string,
  ctx: ParseResult,
): Pick<DerivedRecord, 'spouses' | 'children'> {
  const spouses: DerivedRecord['spouses'] = [];
  const children: DerivedRecord['children'] = [];

  for (const fams of node.tree.filter(n => n.tag === 'FAMS')) {
    const famPointer = (fams.data ?? '').replace(/^@|@$/g, '');
    const fam = ctx.families.get(famPointer);
    if (!fam) continue;
    const married = fam.tree.find(n => n.tag === 'MARR')?.tree.find(n => n.tag === 'DATE')?.data?.trim() || null;

    for (const tag of ['HUSB', 'WIFE'] as const) {
      const link = fam.tree.find(n => n.tag === tag);
      if (!link?.data) continue;
      const partnerRecord = link.data.replace(/^@|@$/g, '');
      if (partnerRecord === selfRecord) continue;
      const partner = ctx.individuals.get(partnerRecord);
      if (!partner) continue;
      spouses.push({ record: partnerRecord, name: deriveName(partner), married });
    }

    for (const chil of fam.tree.filter(n => n.tag === 'CHIL')) {
      const childRecord = (chil.data ?? '').replace(/^@|@$/g, '');
      const child = ctx.individuals.get(childRecord);
      if (!child) continue;
      const born = child.tree.find(n => n.tag === 'BIRT')?.tree.find(n => n.tag === 'DATE')?.data?.trim() || null;
      children.push({ record: childRecord, name: deriveName(child), born });
    }
  }

  return { spouses, children };
}

function deriveResidences(node: GedcomNode): ResidenceEvent[] {
  return node.tree
    .filter(n => n.tag === 'RESI')
    .map(resi => ({
      date: resi.tree.find(n => n.tag === 'DATE')?.data?.trim() || null,
      place: resi.tree.find(n => n.tag === 'PLAC')?.data?.trim() || null,
    }))
    .filter(r => r.date || r.place);
}

function deriveOccupations(node: GedcomNode): OccupationEvent[] {
  return node.tree
    .filter(n => n.tag === 'OCCU')
    .map(occu => ({
      title: (occu.data ?? '').trim(),
      date: occu.tree.find(n => n.tag === 'DATE')?.data?.trim() || null,
    }))
    .filter(o => o.title);
}

function deriveSources(node: GedcomNode): SourceRef[] {
  return node.tree
    .filter(n => n.tag === 'SOUR' && n.data)
    .map(s => ({ record: (s.data ?? '').replace(/^@|@$/g, '') }));
}

export function deriveIndividual(node: GedcomNode, record: string, ctx: ParseResult): DerivedRecord {
  const sc = deriveSpousesAndChildren(node, record, ctx);
  return {
    record,
    name: deriveName(node),
    birth: deriveDatedEvent(node, 'BIRT'),
    death: deriveDatedEvent(node, 'DEAT'),
    parents: deriveParents(node, ctx),
    spouses: sc.spouses,
    children: sc.children,
    residences: deriveResidences(node),
    occupations: deriveOccupations(node),
    sources: deriveSources(node),
  };
}

function deriveName(node: GedcomNode): string {
  const nameNode = node.tree.find(n => n.tag === 'NAME');
  if (!nameNode?.data) return '';
  return nameNode.data.replace(/\//g, '').replace(/\s+/g, ' ').trim();
}

function deriveDatedEvent(node: GedcomNode, tag: string): DatedEvent | null {
  const eventNode = node.tree.find(n => n.tag === tag);
  if (!eventNode) return null;
  const dateNode = eventNode.tree.find(n => n.tag === 'DATE');
  const placeNode = eventNode.tree.find(n => n.tag === 'PLAC');
  const date = dateNode?.data?.trim() || null;
  const place = placeNode?.data?.trim() || null;
  if (!date && !place) return null;
  return { date, place };
}

export async function writeDerivedYaml(derivedDir: string, derived: DerivedRecord): Promise<string> {
  mkdirSync(derivedDir, { recursive: true });
  const path = join(derivedDir, `${derived.record}.yml`);
  const text = yaml.dump(derived, { lineWidth: 200, sortKeys: false, noRefs: true });
  writeFileSync(path, text);
  return path;
}

export async function hashGedcomFile(path: string): Promise<string> {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
