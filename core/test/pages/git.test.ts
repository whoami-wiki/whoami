import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { addAndCommit, fileHistory, restoreFromIndex } from '../../src/pages/git.ts';
import { makeTestRepo } from './helpers.ts';

test('addAndCommit: creates a commit with the given author', async () => {
  const repo = await makeTestRepo();
  try {
    const path = join(repo.pagesDir, 'a.md');
    writeFileSync(path, 'hello');
    const sha = await addAndCommit(repo.root, [path], { name: 'Steven', email: 'steven@example.com' }, 'add a.md');
    assert.match(sha, /^[0-9a-f]{40}$/);
    const log = await fileHistory(repo.root, path, 5);
    assert.equal(log[0]!.author, 'Steven');
    assert.equal(log[0]!.email, 'steven@example.com');
    assert.equal(log[0]!.summary, 'add a.md');
  } finally {
    repo.cleanup();
  }
});

test('fileHistory: returns commits oldest-first or newest-first by default', async () => {
  const repo = await makeTestRepo();
  try {
    const path = join(repo.pagesDir, 'a.md');
    writeFileSync(path, 'one');
    await addAndCommit(repo.root, [path], { name: 'A', email: 'a@x' }, 'one');
    writeFileSync(path, 'two');
    await addAndCommit(repo.root, [path], { name: 'B', email: 'b@x' }, 'two');
    const log = await fileHistory(repo.root, path, 5);
    assert.equal(log.length, 2);
    assert.equal(log[0]!.summary, 'two');
    assert.equal(log[1]!.summary, 'one');
  } finally {
    repo.cleanup();
  }
});

test('restoreFromIndex: drops uncommitted changes to a file', async () => {
  const repo = await makeTestRepo();
  try {
    const path = join(repo.pagesDir, 'a.md');
    writeFileSync(path, 'original');
    await addAndCommit(repo.root, [path], { name: 'A', email: 'a@x' }, 'original');
    writeFileSync(path, 'modified-but-not-committed');
    await restoreFromIndex(repo.root, path);
    assert.equal(readFileSync(path, 'utf-8'), 'original');
  } finally {
    repo.cleanup();
  }
});

test('restoreFromIndex: removes file when not previously tracked', async () => {
  const repo = await makeTestRepo();
  try {
    const path = join(repo.pagesDir, 'new.md');
    writeFileSync(path, 'transient');
    await restoreFromIndex(repo.root, path);
    assert.equal(existsSync(path), false);
  } finally {
    repo.cleanup();
  }
});
