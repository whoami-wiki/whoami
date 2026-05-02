import { resolve } from 'node:path';

export const WHOAMI_ROOT = process.env.WHOAMI_ROOT ?? resolve(process.env.HOME ?? '.', 'whoami');
export const PAGES_DIR = resolve(WHOAMI_ROOT, 'pages');
export const DATA_DIR = resolve(WHOAMI_ROOT, 'data');
