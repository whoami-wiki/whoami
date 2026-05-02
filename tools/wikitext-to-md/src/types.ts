export interface RawPage {
  namespace: number;
  title: string;
  text: string;
  createdAt: string;          // YYYYMMDDHHmmss
}

export type PageType = 'person' | 'family' | 'event' | 'tree' | 'meta';

export interface GedcomRef {
  file: string;
  record: string;
  snapshot: string;
}

export interface PageMeta {
  title: string;
  owner: string;
  editors: string[];
  type: PageType;
  aliases: string[];
  categories: string[];
  gedcom?: GedcomRef;
  created: string;            // YYYY-MM-DD
}

export interface Warning {
  page: string;
  kind: 'malformed-cite-vault' | 'unknown-template' | 'complex-table' | 'missing-frontmatter-field';
  detail: string;
}

export interface Report {
  pagesWritten: number;
  pagesSkipped: number;
  redirects: number;
  warnings: Warning[];
  snapshotHash: string;
}
