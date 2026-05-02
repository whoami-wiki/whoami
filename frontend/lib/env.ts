import { resolve, join } from 'node:path';
import type { AuthorIdentity } from '@core/pages/index.ts';

export const WHOAMI_ROOT = process.env.WHOAMI_ROOT ?? resolve(process.env.HOME ?? '.', 'whoami');
export const PAGES_DIR = resolve(WHOAMI_ROOT, 'pages');
export const DATA_DIR = resolve(WHOAMI_ROOT, 'data');

export const DEFAULT_AUTHOR: AuthorIdentity = {
  name: process.env.WHOAMI_AUTHOR_NAME ?? 'whoami',
  email: process.env.WHOAMI_AUTHOR_EMAIL ?? 'whoami@local',
};

export const SEARCH_INDEX_FILE = join(DATA_DIR, 'search.idx.json');

/** GEDCOM record id of the perspective person on /family. Hardcoded today;
 *  later versions will pick up the viewer from session/profile. */
export const SELF_RECORD = process.env.WHOAMI_SELF_RECORD ?? 'I28906360944';
export const GENEALOGY_DIR = join(WHOAMI_ROOT, 'genealogy');
export const DERIVED_DIR = join(GENEALOGY_DIR, 'derived');
