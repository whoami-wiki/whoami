import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { app } from 'electron';
import { net } from 'electron';

const HOST = '127.0.0.1';
const PORT = 8080;
const MAX_RETRIES = 3;
const HEALTH_POLL_MS = 200;
const HEALTH_TIMEOUT_MS = 15_000;

let phpProcess: ChildProcess | null = null;
let restartCount = 0;

function getPhpPath(): string {
  const resourcesPath = app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(app.getAppPath(), 'resources');
  return join(resourcesPath, 'php', 'bin', 'php');
}

function getMediaWikiPath(): string {
  const resourcesPath = app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(app.getAppPath(), 'resources');
  return join(resourcesPath, 'mediawiki');
}

export function getServerUrl(): string {
  return `http://${HOST}:${PORT}`;
}

export function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (phpProcess) {
      resolve();
      return;
    }

    const phpPath = getPhpPath();
    const docRoot = getMediaWikiPath();

    const router = join(docRoot, 'router.php');

    phpProcess = spawn(phpPath, [
      '-d', 'display_errors=Off',
      '-d', 'error_reporting=22527',
      '-d', 'upload_max_filesize=10M',
      '-d', 'post_max_size=10M',
      '-S', `${HOST}:${PORT}`,
      '-t', docRoot,
      router,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Point MediaWiki at user data directory
        MW_DATA_PATH: getDataPath(),
      },
    });

    phpProcess.on('error', (err) => {
      console.error('[php] spawn error:', err.message);
      phpProcess = null;
      reject(err);
    });

    phpProcess.on('exit', (code, signal) => {
      console.log(`[php] exited (code=${code}, signal=${signal})`);
      phpProcess = null;

      if (restartCount < MAX_RETRIES) {
        restartCount++;
        const delay = restartCount * 1000;
        console.log(`[php] restarting in ${delay}ms (attempt ${restartCount}/${MAX_RETRIES})`);
        setTimeout(() => {
          startServer().catch((err) =>
            console.error('[php] restart failed:', err.message),
          );
        }, delay);
      }
    });

    phpProcess.stdout?.on('data', (data: Buffer) => {
      // PHP built-in server logs requests to stdout
      process.stdout.write(`[php] ${data.toString()}`);
    });

    phpProcess.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(`[php] ${data.toString()}`);
    });

    // Poll until server responds
    waitForServer()
      .then(() => {
        restartCount = 0;
        resolve();
      })
      .catch(reject);
  });
}

export function stopServer(): void {
  if (phpProcess) {
    phpProcess.removeAllListeners('exit');
    phpProcess.kill('SIGTERM');
    phpProcess = null;
  }
}

export function isRunning(): boolean {
  return phpProcess !== null;
}

export function getDataPath(): string {
  return join(app.getPath('userData'), 'data');
}

function waitForServer(): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > HEALTH_TIMEOUT_MS) {
        reject(new Error('PHP server failed to start within timeout'));
        return;
      }

      const request = net.request(`http://${HOST}:${PORT}/api.php?action=query&meta=siteinfo&format=json`);
      request.on('response', (response) => {
        if (response.statusCode === 200) {
          resolve();
        } else {
          setTimeout(check, HEALTH_POLL_MS);
        }
      });
      request.on('error', () => {
        setTimeout(check, HEALTH_POLL_MS);
      });
      request.end();
    };
    check();
  });
}
