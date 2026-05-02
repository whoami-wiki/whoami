export interface SearchDoc {
  // Index signature satisfies FlexSearch's DocumentData constraint.
  [key: string]: string;
  slug: string;
  title: string;
  type: string;
  body: string;
  aliases: string;
  categories: string;
  places: string;
  occupations: string;
  related: string;
}

export interface SearchHit {
  slug: string;
  score?: number;
}

export interface SearchResult {
  slug: string;
  title: string;
  type: string;
  snippet?: string;
}
