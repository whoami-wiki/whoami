import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadUsers, saveUsers } from '../../src/auth/users.ts';

test('loadUsers: returns empty list when file does not exist', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'users-'));
  try {
    const users = await loadUsers(join(dir, 'users.json'));
    assert.deepEqual(users, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('saveUsers + loadUsers: round-trip', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'users-'));
  const path = join(dir, 'users.json');
  try {
    await saveUsers(path, [{ username: 'steven', passwordHash: 'h' }]);
    const users = await loadUsers(path);
    assert.equal(users.length, 1);
    assert.equal(users[0]!.username, 'steven');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('saveUsers: writes file with mode 0600', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'users-'));
  const path = join(dir, 'users.json');
  try {
    await saveUsers(path, [{ username: 'a', passwordHash: 'b' }]);
    const mode = statSync(path).mode & 0o777;
    assert.equal(mode, 0o600);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
