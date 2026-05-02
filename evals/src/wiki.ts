import { spawn, type ChildProcess } from 'node:child_process';
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import net from 'node:net';
import http from 'node:http';
import matter from 'gray-matter';

const HEALTH_POLL_MS = 200;
const HEALTH_TIMEOUT_MS = 60_000;

const FRONTEND_ROOT = resolve(import.meta.dirname ?? '.', '..', '..', 'frontend');

export interface WikiInstance {
  url: string;
  port: number;
  vaultPath: string;
  env: Record<string, string>;
  stop: () => Promise<void>;
  destroy: () => Promise<void>;
}

// Mirror of core/src/pages/types.ts PageType. Kept inline so evals stays
// standalone (no relative imports from core).
export type PageType = 'person' | 'family' | 'event' | 'tree' | 'meta';

export interface PageMetaInput {
  title?: string;
  owner?: string;
  editors?: string[];
  type?: PageType;
  aliases?: string[];
  categories?: string[];
  gedcom?: { file: string; record: string; snapshot: string };
  created?: string;
}

export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      server.close(() => resolve(addr.port));
    });
    server.on('error', reject);
  });
}

function waitForServer(url: string): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > HEALTH_TIMEOUT_MS) {
        reject(new Error(`Wiki server failed to start within ${HEALTH_TIMEOUT_MS}ms`));
        return;
      }
      const req = http.get(`${url}/api/healthz`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else setTimeout(check, HEALTH_POLL_MS);
      });
      req.on('error', () => setTimeout(check, HEALTH_POLL_MS));
      req.end();
    };
    check();
  });
}

function gitInit(vault: string): void {
  execSync(`git init -q "${vault}"`, { stdio: 'ignore' });
  execSync(`git -C "${vault}" config user.email eval@local`, { stdio: 'ignore' });
  execSync(`git -C "${vault}" config user.name eval`, { stdio: 'ignore' });
  execSync(`git -C "${vault}" commit --allow-empty -q -m "init"`, { stdio: 'ignore' });
}

export async function startWiki(opts: { port?: number } = {}): Promise<WikiInstance> {
  const vaultPath = mkdtempSync(join(tmpdir(), 'whoami-eval-'));
  for (const sub of ['pages', 'genealogy', 'data', 'assets']) {
    mkdirSync(join(vaultPath, sub), { recursive: true });
  }
  gitInit(vaultPath);

  const port = opts.port ?? await findFreePort();
  const url = `http://127.0.0.1:${port}`;
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    WHOAMI_ROOT: vaultPath,
    PORT: String(port),
    NODE_ENV: 'development',
  };

  // detached: true puts the child in its own process group so we can signal
  // the whole tree (npm + the next dev grandchild). Without this, child.kill()
  // only signals npm and the grandchild keeps holding the port.
  const child: ChildProcess = spawn('npm', ['run', 'dev'], {
    cwd: FRONTEND_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  // Bound stderr capture so long-running tests don't leak memory.
  const STDERR_CAP = 4096;
  let stderrBuf = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    stderrBuf = (stderrBuf + chunk.toString()).slice(-STDERR_CAP);
  });

  // Signal the whole process group (npm + next dev grandchild). The negative
  // PID is the POSIX convention for "send to process group with this id".
  function killTree(signal: NodeJS.Signals): void {
    if (!child.pid) return;
    try { process.kill(-child.pid, signal); } catch { /* group may already be gone */ }
  }

  try {
    await waitForServer(url);
  } catch (err) {
    killTree('SIGTERM');
    rmSync(vaultPath, { recursive: true, force: true });
    throw new Error(`startWiki: ${(err as Error).message}\n--- stderr tail ---\n${stderrBuf.slice(-2000)}`);
  }

  const stop = async (): Promise<void> => {
    if (!child.killed) {
      killTree('SIGTERM');
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => { killTree('SIGKILL'); resolve(); }, 2000);
        t.unref();
        child.once('exit', () => { clearTimeout(t); resolve(); });
      });
    }
  };

  const destroy = async (): Promise<void> => {
    try { await stop(); }
    finally { rmSync(vaultPath, { recursive: true, force: true }); }
  };

  return {
    url,
    port,
    vaultPath,
    env: { WHOAMI_SERVER: url, WHOAMI_ROOT: vaultPath },
    stop,
    destroy,
  };
}

/**
 * Write a page directly to <vault>/pages/<slug>.md and commit. Bypasses the
 * API — used by tests to seed pages without going through the agent under test.
 */
export async function writePageDirect(
  vaultPath: string,
  slug: string,
  body: string,
  meta: PageMetaInput = {},
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const fullMeta = {
    title: meta.title ?? slug,
    owner: meta.owner ?? 'eval',
    editors: meta.editors ?? [],
    type: meta.type ?? 'meta',
    aliases: meta.aliases ?? [],
    categories: meta.categories ?? [],
    ...(meta.gedcom ? { gedcom: meta.gedcom } : {}),
    created: meta.created ?? today,
  };
  const file = matter.stringify(body, fullMeta);
  const path = join(vaultPath, 'pages', `${slug}.md`);
  writeFileSync(path, file, 'utf-8');
  execSync(`git -C "${vaultPath}" add "${path}"`, { stdio: 'ignore' });
  execSync(`git -C "${vaultPath}" commit -q -m "seed: ${slug}"`, { stdio: 'ignore' });
}
