export type PageType = 'person' | 'family' | 'event' | 'tree' | 'meta';

export interface GedcomRef {
  file: string;
  record: string;
  snapshot: string;
}

export interface PageMeta {
  /**
   * Schema version of this page's frontmatter. Always present after
   * parse — readers that encounter pages with no on-disk schemaVersion
   * field default it to 1 before validation.
   */
  schemaVersion: number;
  title: string;
  owner: string;
  editors: string[];
  type: PageType;
  aliases: string[];
  categories: string[];
  gedcom?: GedcomRef;
  portrait?: string;
  created: string;
  deletedAt?: string;
}

export interface Page {
  slug: string;
  meta: PageMeta;
  body: string;
}

export interface PageMetaSummary {
  slug: string;
  title: string;
  type: PageType;
  categories: string[];
  aliases: string[];
  gedcomRecord?: string;
  portrait?: string;
  isTalk: boolean;
  isArchived: boolean;
}

export interface Revision {
  sha: string;
  author: string;
  email: string;
  date: string;
  summary: string;
}

export interface AuthorIdentity {
  name: string;
  email: string;
}
