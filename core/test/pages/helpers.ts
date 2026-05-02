import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { simpleGit } from 'simple-git';

export interface TestRepo {
  root: string;
  pagesDir: string;
  cleanup: () => void;
}

/** Create a temp dir with a git-initialized empty wiki structure for tests. */
export async function makeTestRepo(): Promise<TestRepo> {
  const root = mkdtempSync(join(tmpdir(), 'pages-test-'));
  const pagesDir = join(root, 'pages');
  mkdirSync(pagesDir, { recursive: true });
  writeFileSync(join(root, '.gitignore'), '');

  const git = simpleGit(root);
  await git.init();
  await git.addConfig('user.name', 'Test Runner');
  await git.addConfig('user.email', 'test@example.com');
  await git.add('.gitignore');
  await git.commit('initial');

  return {
    root,
    pagesDir,
    cleanup: () => {
      try { rmSync(root, { recursive: true, force: true }); } catch {}
    },
  };
}
