import { join } from 'node:path';
import { homedir, platform } from 'node:os';

export function getDataPath(): string {
  if (process.env.WAI_DATA_PATH) return process.env.WAI_DATA_PATH;
  const home = homedir();
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'whoami', 'data');
    case 'win32':
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'whoami', 'data');
    default:
      return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'whoami', 'data');
  }
}
