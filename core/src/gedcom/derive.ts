import type { GedcomNode, DerivedRecord, DatedEvent } from './types.ts';
import type { ParseResult } from './parser.ts';

export function deriveIndividual(node: GedcomNode, record: string, ctx: ParseResult): DerivedRecord {
  return {
    record,
    name: deriveName(node),
    birth: deriveDatedEvent(node, 'BIRT'),
    death: deriveDatedEvent(node, 'DEAT'),
    parents: [],
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
