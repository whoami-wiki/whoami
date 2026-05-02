import type { GedcomNode, DerivedRecord, DatedEvent, IndividualRef } from './types.ts';
import type { ParseResult } from './parser.ts';

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

export function deriveIndividual(node: GedcomNode, record: string, ctx: ParseResult): DerivedRecord {
  return {
    record,
    name: deriveName(node),
    birth: deriveDatedEvent(node, 'BIRT'),
    death: deriveDatedEvent(node, 'DEAT'),
    parents: deriveParents(node, ctx),
    spouses: [],
    children: [],
    residences: [],
    occupations: [],
    sources: [],
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
