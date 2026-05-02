import { resolve } from 'node:path';
import type { AuthorIdentity } from '@core/pages/index.ts';

export const WHOAMI_ROOT = process.env.WHOAMI_ROOT ?? resolve(process.env.HOME ?? '.', 'whoami');
export const PAGES_DIR = resolve(WHOAMI_ROOT, 'pages');
export const DATA_DIR = resolve(WHOAMI_ROOT, 'data');

export const DEFAULT_AUTHOR: AuthorIdentity = {
  name: process.env.WHOAMI_AUTHOR_NAME ?? 'whoami',
  email: process.env.WHOAMI_AUTHOR_EMAIL ?? 'whoami@local',
};
