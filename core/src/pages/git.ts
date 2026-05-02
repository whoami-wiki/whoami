import { simpleGit, type SimpleGit } from 'simple-git';
import { existsSync, unlinkSync } from 'node:fs';
import type { AuthorIdentity, Revision } from './types.ts';

function client(repoRoot: string): SimpleGit {
  return simpleGit(repoRoot);
}

function validateEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw new Error(`invalid email format: ${email}`);
  }
}

export async function addAndCommit(
  repoRoot: string,
  paths: string[],
  author: AuthorIdentity,
  summary: string,
): Promise<string> {
  validateEmail(author.email);
  const git = client(repoRoot);
  await git.add(paths);
  const result = await git.commit(summary, paths, {
    '--author': `${author.name} <${author.email}>`,
  });
  return result.commit;
}

export async function fileHistory(
  repoRoot: string,
  path: string,
  limit: number,
): Promise<Revision[]> {
  const git = client(repoRoot);
  const log = await git.log({ file: path, maxCount: limit });
  return log.all.map((c) => ({
    sha: c.hash,
    author: c.author_name,
    email: c.author_email,
    date: c.date,
    summary: c.message,
  }));
}

/**
 * Restore a file to its state at HEAD. If the file was never tracked at HEAD,
 * remove it from the working tree (covers the rollback-after-failed-create case).
 */
export async function restoreFromIndex(repoRoot: string, path: string): Promise<void> {
  const git = client(repoRoot);
  try {
    await git.checkout(['HEAD', '--', path]);
  } catch {
    if (existsSync(path)) unlinkSync(path);
  }
}
