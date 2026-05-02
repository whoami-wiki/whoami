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
