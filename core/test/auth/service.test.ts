import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAuthService } from '../../src/auth/index.ts';
import { hashPassword } from '../../src/auth/passwords.ts';
import { saveUsers } from '../../src/auth/users.ts';
import { createPageStore } from '../../src/pages/index.ts';
import { makeTestRepo } from '../pages/helpers.ts';

async function makeAuth(dataDir: string, users: { username: string; password: string }[]) {
  const usersPath = join(dataDir, 'users.json');
  const sessionsPath = join(dataDir, 'sessions.db');
  await saveUsers(usersPath, await Promise.all(users.map(async u => ({
    username: u.username, passwordHash: await hashPassword(u.password),
  }))));
  return createAuthService({ usersPath, sessionsPath });
}

test('AuthService.login: succeeds with correct credentials', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'auth-'));
  try {
    const auth = await makeAuth(dir, [{ username: 'steven', password: 'hunter2' }]);
    const result = await auth.login('steven', 'hunter2', '1.2.3.4');
    assert.equal(result.kind, 'ok');
    if (result.kind === 'ok') {
      assert.equal(result.session.userId, 'steven');
      assert.match(result.session.id, /^[0-9a-f]{64}$/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AuthService.login: rejects wrong password', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'auth-'));
  try {
    const auth = await makeAuth(dir, [{ username: 'a', password: 'right' }]);
    const result = await auth.login('a', 'wrong', '1.1.1.1');
    assert.equal(result.kind, 'error');
    if (result.kind === 'error') assert.equal(result.reason, 'invalid-credentials');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AuthService.login: rate-limits after 5 failures', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'auth-'));
  try {
    const auth = await makeAuth(dir, [{ username: 'a', password: 'right' }]);
    for (let i = 0; i < 5; i++) await auth.login('a', 'wrong', '1.1.1.1');
    const result = await auth.login('a', 'right', '1.1.1.1');
    assert.equal(result.kind, 'error');
    if (result.kind === 'error') assert.equal(result.reason, 'rate-limited');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AuthService.requireOwnerOrEditor: allows owner', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'auth-'));
  const repo = await makeTestRepo();
  try {
    const auth = await makeAuth(dir, [{ username: 'steven', password: 'p' }]);
    const pages = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    await pages.write('s',
      { slug: 's', meta: { title: 'S', owner: 'steven', editors: [], type: 'person', aliases: [], categories: [], created: '2026-04-29' }, body: 'b' },
      { name: 'steven', email: 's@x' }, 'init',
    );
    await auth.requireOwnerOrEditor('s', { username: 'steven', passwordHash: '' }, pages);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    repo.cleanup();
  }
});

test('AuthService.requireOwnerOrEditor: rejects non-owner non-editor', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'auth-'));
  const repo = await makeTestRepo();
  try {
    const auth = await makeAuth(dir, [{ username: 'attacker', password: 'p' }]);
    const pages = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    await pages.write('s',
      { slug: 's', meta: { title: 'S', owner: 'steven', editors: [], type: 'person', aliases: [], categories: [], created: '2026-04-29' }, body: 'b' },
      { name: 'steven', email: 's@x' }, 'init',
    );
    await assert.rejects(
      auth.requireOwnerOrEditor('s', { username: 'attacker', passwordHash: '' }, pages),
      /forbidden/i,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
    repo.cleanup();
  }
});
