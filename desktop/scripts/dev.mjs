import { createServer } from 'vite';
import { execSync, spawn } from 'node:child_process';

execSync('tsc', { stdio: 'inherit' });

const vite = await createServer();
await vite.listen();
const url = vite.resolvedUrls.local[0];
console.log(`Vite dev server: ${url}`);

const electron = spawn('npx', ['electron', '.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});

electron.on('close', () => {
  vite.close();
  process.exit();
});
