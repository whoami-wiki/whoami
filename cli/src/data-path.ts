import { join } from 'node:path';
import { homedir, platform } from 'node:os';

function getAppDir(): string {
  const home = homedir();
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'whoami');
    case 'win32':
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'whoami');
    default:
      return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'whoami');
  }
}

export function getDataPath(): string {
  if (process.env.WAI_DATA_PATH) return process.env.WAI_DATA_PATH;
  return join(getAppDir(), 'data');
}

export function getArchivePath(): string {
  if (process.env.WAI_ARCHIVE_PATH) return process.env.WAI_ARCHIVE_PATH;
  return join(getAppDir(), 'archive');
}
