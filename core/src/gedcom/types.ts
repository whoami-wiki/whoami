/** Internal parsed-tree types from parse-gedcom (the npm package). */
export interface GedcomNode {
  tag: string;
  pointer?: string;       // "@I123@" on top-level records
  data?: string;          // raw value (line tail)
  tree: GedcomNode[];     // children
}

/** Reference to another individual by GEDCOM record id. */
export interface IndividualRef {
  record: string;         // "I123" (without surrounding @)
  name: string;
}

/** Like IndividualRef but tagged with which side of a marriage they were on
 *  in the parent family record. Used for parents[] in a DerivedRecord. */
export interface ParentRef extends IndividualRef {
  role: 'father' | 'mother';
}

/** A dated event such as BIRT, DEAT, MARR. Date and place are both optional. */
export interface DatedEvent {
  date: string | null;          // raw GEDCOM DATE value, e.g. "12 JAN 1950" or "ABT 1880"
  place: string | null;
}

/** RESI event — when/where someone lived. */
export interface ResidenceEvent extends DatedEvent {}

/** OCCU event — occupation, with optional date range. */
export interface OccupationEvent {
  title: string;
  date: string | null;
}

/** Source citation — pointer to a SOUR record. */
export interface SourceRef {
  record: string;         // "S1"
}

/** The structured shape we emit per individual into `genealogy/derived/<record>.yml`. */
export interface DerivedRecord {
  record: string;                       // "I28906361734"
  name: string;                         // "Abby Rickelman"
  birth: DatedEvent | null;
  death: DatedEvent | null;
  parents: ParentRef[];
  spouses: { record: string; name: string; married: string | null }[];
  children: { record: string; name: string; born: string | null }[];
  residences: ResidenceEvent[];
  occupations: OccupationEvent[];
  sources: SourceRef[];
}

/** Snapshots manifest entry shape. Compatible with what tools/wikitext-to-md/
 *  wrote during the Plan B migration import (no extra fields added by Plan D).
 *  recite finds the corresponding commit via git log on `date` rather than a
 *  recorded SHA — avoids the chicken-and-egg of a commit knowing its own hash. */
export interface SnapshotEntry {
  hash: string;           // SHA-256 hex of the .ged file at sync time
  date: string;           // ISO 8601 timestamp — used by recite to find the commit
  file: string;           // e.g. "barash-tree.ged"
  notes: string;
}

/** Difference summary returned by syncGedcom. */
export interface SyncDiff {
  added: string[];        // record ids
  changed: string[];
  removed: string[];
}

/** Drift entry returned by reciteDrift. */
export interface ReciteEntry {
  slug: string;
  record: string;
  citedSnapshot: string;
  latestSnapshot: string;
  changedFields: string[];
}
